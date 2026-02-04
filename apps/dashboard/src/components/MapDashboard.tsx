'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons (bundler breaks the default paths)
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface TelemetryPoint {
  id: number
  deviceId: string
  timestamp: string
  latitude: number
  longitude: number
  altitude: number | null
  speed: number | null
  heading: number | null
  satellites: number | null
  ignition: boolean | null
  movement: boolean | null
  externalVoltage: number | null
  batteryVoltage: number | null
}

interface DeviceInfo {
  id: string
  imei: string
  name: string | null
  model: string | null
  isOnline: boolean
  lastSeen: string | null
}

const BANJA_LUKA_CENTER: [number, number] = [44.7722, 17.191]
const TIME_RANGES = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '7d', hours: 168 },
]

function FitBoundsHelper({ positions }: { positions: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [map, positions])

  return null
}

export default function MapDashboard() {
  const [points, setPoints] = useState<TelemetryPoint[]>([])
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices')
      if (!res.ok) throw new Error('Failed to fetch devices')
      const data: DeviceInfo[] = await res.json()
      setDevices(data)
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err)
    }
  }, [selectedDevice])

  const fetchTelemetry = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ hours: String(hours) })
      if (selectedDevice) params.set('deviceId', selectedDevice)
      const res = await fetch(`/api/telemetry?${params}`)
      if (!res.ok) throw new Error('Failed to fetch telemetry')
      const data = await res.json()
      setPoints(data.records || [])
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setPoints([])
    } finally {
      setLoading(false)
    }
  }, [hours, selectedDevice])

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  // Fetch telemetry when device or time range changes
  useEffect(() => {
    if (selectedDevice) {
      fetchTelemetry()
    }
  }, [selectedDevice, hours, fetchTelemetry])

  // Auto-refresh every 30s
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (selectedDevice) fetchTelemetry()
    }, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [selectedDevice, fetchTelemetry])

  const positions: [number, number][] = points
    .filter(p => p.latitude !== 0 && p.longitude !== 0)
    .map(p => [p.latitude, p.longitude])

  const latestPoint = points.length > 0 ? points[points.length - 1] : null

  const selectedDeviceInfo = devices.find(d => d.id === selectedDevice)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: '#1a1a2e',
        color: '#fff',
        fontSize: '14px',
        flexWrap: 'wrap',
      }}>
        <strong style={{ fontSize: '16px' }}>GPS Dashboard</strong>

        {/* Device selector */}
        {devices.length > 0 && (
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #444',
              background: '#16213e',
              color: '#fff',
              fontSize: '13px',
            }}
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.name || d.imei} {d.isOnline ? '(online)' : '(offline)'}
              </option>
            ))}
          </select>
        )}

        {/* Time range buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {TIME_RANGES.map(r => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: hours === r.hours ? '#e94560' : '#16213e',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchTelemetry}
          disabled={loading}
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            border: 'none',
            background: '#0f3460',
            color: '#fff',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '13px',
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>

        {/* Stats */}
        <span style={{ color: '#aaa', fontSize: '12px' }}>
          {points.length} points
          {selectedDeviceInfo && ` | ${selectedDeviceInfo.imei}`}
          {lastRefresh && ` | Updated ${lastRefresh.toLocaleTimeString()}`}
        </span>

        {error && (
          <span style={{ color: '#ff6b6b', fontSize: '12px' }}>{error}</span>
        )}
      </div>

      {/* Map */}
      <div style={{ flex: 1 }}>
        <MapContainer
          center={BANJA_LUKA_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {positions.length > 0 && (
            <>
              <Polyline
                positions={positions}
                pathOptions={{ color: '#2196F3', weight: 3, opacity: 0.8 }}
              />
              <FitBoundsHelper positions={positions} />
            </>
          )}

          {latestPoint && latestPoint.latitude !== 0 && (
            <Marker
              position={[latestPoint.latitude, latestPoint.longitude]}
              icon={defaultIcon}
            >
              <Popup>
                <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                  <strong>Latest Position</strong><br />
                  <strong>Time:</strong> {new Date(latestPoint.timestamp).toLocaleString()}<br />
                  <strong>Speed:</strong> {latestPoint.speed ?? 'N/A'} km/h<br />
                  <strong>Heading:</strong> {latestPoint.heading ?? 'N/A'}&deg;<br />
                  <strong>Altitude:</strong> {latestPoint.altitude ?? 'N/A'} m<br />
                  <strong>Satellites:</strong> {latestPoint.satellites ?? 'N/A'}<br />
                  <strong>Ignition:</strong> {latestPoint.ignition === null ? 'N/A' : latestPoint.ignition ? 'ON' : 'OFF'}<br />
                  <strong>Ext Voltage:</strong> {latestPoint.externalVoltage ? `${(latestPoint.externalVoltage / 1000).toFixed(1)}V` : 'N/A'}<br />
                  <strong>Coords:</strong> {latestPoint.latitude.toFixed(6)}, {latestPoint.longitude.toFixed(6)}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
