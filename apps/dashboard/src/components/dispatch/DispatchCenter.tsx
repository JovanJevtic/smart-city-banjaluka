'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface DispatchVehicle {
  deviceId: string
  imei: string
  name: string | null
  isOnline: boolean
  latitude: number
  longitude: number
  speed: number
  heading: number
  routeId: string | null
  routeNumber: string | null
  routeColor: string | null
  routeName: string | null
  currentDirection: string | null
  adherenceSeconds: number
  status: string
  lastSeen: string | null
}

interface AlertItem {
  id: string
  type: string
  severity: string
  message: string
  deviceId: string
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  'on-time': '#22c55e',
  'slightly-late': '#f59e0b',
  'late': '#f97316',
  'very-late': '#ef4444',
  'offline': '#6b7280',
  'unassigned': '#d1d5db',
}

export default function DispatchCenter() {
  const [vehicles, setVehicles] = useState<DispatchVehicle[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [filterRoute, setFilterRoute] = useState<string>('')

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/dispatch/vehicles')
      if (res.ok) setVehicles(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/alert-trends?from=' + new Date(Date.now() - 3600000).toISOString().split('T')[0])
      if (res.ok) {
        const data = await res.json()
        if (data.byVehicle) setAlerts(data.byVehicle.slice(0, 10))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchVehicles()
    fetchAlerts()
    const interval = setInterval(fetchVehicles, 10000)
    return () => clearInterval(interval)
  }, [fetchVehicles, fetchAlerts])

  const filtered = filterRoute
    ? vehicles.filter(v => v.routeId === filterRoute)
    : vehicles

  const online = vehicles.filter(v => v.isOnline).length
  const total = vehicles.length
  const onTime = vehicles.filter(v => v.status === 'on-time').length
  const late = vehicles.filter(v => ['late', 'very-late'].includes(v.status)).length

  // Group by route for the panel
  const byRoute = new Map<string, DispatchVehicle[]>()
  const unassigned: DispatchVehicle[] = []
  for (const v of filtered) {
    if (!v.routeId) { unassigned.push(v); continue }
    const key = v.routeId
    if (!byRoute.has(key)) byRoute.set(key, [])
    byRoute.get(key)!.push(v)
  }

  const uniqueRoutes = [...new Set(vehicles.filter(v => v.routeId).map(v => ({
    id: v.routeId!, number: v.routeNumber!, color: v.routeColor,
  })))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 0px)', color: '#fff' }}>
      {/* Top bar */}
      <div style={{
        padding: '8px 16px', background: '#111128', borderBottom: '1px solid #1e1e3a',
        display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px',
      }}>
        <strong style={{ fontSize: '15px' }}>Dispatch Console</strong>
        <span style={{ color: '#22c55e' }}>{online}/{total} online</span>
        <span style={{ color: '#22c55e' }}>{onTime} on time</span>
        {late > 0 && <span style={{ color: '#ef4444' }}>{late} late</span>}
        <div style={{ marginLeft: 'auto' }}>
          <select
            value={filterRoute}
            onChange={e => setFilterRoute(e.target.value)}
            style={{ background: '#16213e', border: '1px solid #333', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
          >
            <option value="">All routes</option>
            {uniqueRoutes.map(r => (
              <option key={r.id} value={r.id}>Linija {r.number}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main content: map + panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={[44.772, 17.191]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
            <TileLayer
              attribution='&copy; OSM'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.filter(v => v.latitude !== 0).map(v => (
              <Marker
                key={v.deviceId}
                position={[v.latitude, v.longitude]}
                icon={createVehicleIcon(v)}
                eventHandlers={{ click: () => setSelectedVehicle(v.deviceId) }}
              >
                <Tooltip direction="top" offset={[0, -20]}>
                  <div style={{ fontSize: '11px' }}>
                    <strong>{v.name || v.imei}</strong>
                    {v.routeNumber && <div>Linija {v.routeNumber}</div>}
                    <div>{v.speed} km/h</div>
                    <div style={{ color: STATUS_COLORS[v.status] }}>{formatStatus(v.status, v.adherenceSeconds)}</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Vehicle list panel */}
        <div style={{
          width: '280px', minWidth: '280px', background: '#0d0d1a',
          borderLeft: '1px solid #1e1e3a', overflowY: 'auto', fontSize: '12px',
        }}>
          {[...byRoute.entries()].map(([routeId, vlist]) => {
            const first = vlist[0]
            return (
              <div key={routeId}>
                <div style={{
                  padding: '8px 12px', background: '#111128', borderBottom: '1px solid #1e1e3a',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700,
                    background: first.routeColor || '#666', color: '#fff',
                  }}>{first.routeNumber}</span>
                  <span style={{ color: '#aaa' }}>{first.routeName}</span>
                </div>
                {vlist.map(v => (
                  <VehicleRow
                    key={v.deviceId}
                    vehicle={v}
                    selected={selectedVehicle === v.deviceId}
                    onClick={() => setSelectedVehicle(v.deviceId)}
                  />
                ))}
              </div>
            )
          })}
          {unassigned.length > 0 && (
            <div>
              <div style={{ padding: '8px 12px', background: '#111128', borderBottom: '1px solid #1e1e3a', color: '#666' }}>
                Unassigned ({unassigned.length})
              </div>
              {unassigned.map(v => (
                <VehicleRow
                  key={v.deviceId}
                  vehicle={v}
                  selected={selectedVehicle === v.deviceId}
                  onClick={() => setSelectedVehicle(v.deviceId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alert ticker */}
      <div style={{
        padding: '6px 16px', background: '#111128', borderTop: '1px solid #1e1e3a',
        display: 'flex', gap: '16px', overflow: 'hidden', fontSize: '11px', color: '#aaa',
      }}>
        {vehicles.filter(v => v.status === 'very-late' || v.status === 'late').slice(0, 5).map(v => (
          <span key={v.deviceId} style={{ whiteSpace: 'nowrap', color: STATUS_COLORS[v.status] }}>
            {v.name || v.imei}: {formatStatus(v.status, v.adherenceSeconds)} (R{v.routeNumber})
          </span>
        ))}
        {vehicles.filter(v => ['late', 'very-late'].includes(v.status)).length === 0 && (
          <span style={{ color: '#22c55e' }}>All vehicles operating normally</span>
        )}
      </div>
    </div>
  )
}

function VehicleRow({ vehicle: v, selected, onClick }: { vehicle: DispatchVehicle; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 12px', borderBottom: '1px solid #1a1a2e', cursor: 'pointer',
        background: selected ? '#1a1a3e' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px',
      }}
    >
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: STATUS_COLORS[v.status] || '#666', flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {v.name || v.imei}
        </div>
        <div style={{ color: '#666', fontSize: '10px' }}>
          {formatStatus(v.status, v.adherenceSeconds)}
        </div>
      </div>
      {v.isOnline && <span style={{ color: '#666', fontSize: '10px' }}>{v.speed} km/h</span>}
    </div>
  )
}

function formatStatus(status: string, seconds: number): string {
  if (status === 'offline') return 'Offline'
  if (status === 'unassigned') return 'No route'
  if (status === 'on-time') return 'On time'
  const min = Math.round(Math.abs(seconds) / 60)
  if (seconds > 0) return `Late ${min}m`
  return `Early ${min}m`
}

function createVehicleIcon(v: DispatchVehicle): L.DivIcon {
  const color = STATUS_COLORS[v.status] || '#666'
  const label = v.routeNumber || '?'
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="
      width:24px;height:24px;border-radius:50%;
      background:${color};border:2px solid #fff;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:9px;font-weight:700;
      box-shadow:0 2px 4px rgba(0,0,0,0.3);
    ">${label}</div>`,
  })
}
