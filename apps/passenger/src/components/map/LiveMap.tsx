'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import BusMarker from './BusMarker'
import { useLocale } from '@/hooks/useLocale'
import { useGeolocation } from '@/hooks/useGeolocation'
import type { LiveVehicle, StopInfo } from '@/lib/types'

interface LiveMapProps {
  fullScreen?: boolean
}

export default function LiveMap({ fullScreen = false }: LiveMapProps) {
  const { t } = useLocale()
  const geo = useGeolocation(true)
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([])
  const [stops, setStops] = useState<StopInfo[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<LiveVehicle | null>(null)

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles/live')
      if (res.ok) setVehicles(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchVehicles()
    const interval = setInterval(fetchVehicles, 10000)
    return () => clearInterval(interval)
  }, [fetchVehicles])

  useEffect(() => {
    fetch('/api/stops?limit=500')
      .then(r => r.json())
      .then(data => setStops(data.stops || []))
      .catch(() => {})
  }, [])

  const center: [number, number] = geo.latitude && geo.longitude
    ? [geo.latitude, geo.longitude]
    : [44.772, 17.191]

  return (
    <div className="relative" style={{ height: fullScreen ? '100%' : '300px' }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Bus markers */}
        {vehicles.map(v => (
          <BusMarker
            key={v.deviceId}
            vehicle={v}
            onClick={setSelectedVehicle}
          />
        ))}

        {/* Stop markers */}
        <StopLayer stops={stops} />

        {/* User location */}
        {geo.latitude && geo.longitude && (
          <CircleMarker
            center={[geo.latitude, geo.longitude]}
            radius={8}
            fillColor="#4285f4"
            fillOpacity={1}
            color="#fff"
            weight={3}
          />
        )}

        {geo.latitude && geo.longitude && <LocateButton lat={geo.latitude} lng={geo.longitude} />}
      </MapContainer>

      {/* Vehicle info panel */}
      {selectedVehicle && (
        <div className="absolute bottom-4 left-4 right-4 bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] shadow-lg p-3 z-[1000]">
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0"
              style={{ background: selectedVehicle.routeColor || '#666' }}
            >
              {selectedVehicle.routeNumber || '?'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Linija {selectedVehicle.routeNumber || '?'}
              </div>
              {selectedVehicle.name && (
                <div className="text-xs text-[var(--text-muted)]">{selectedVehicle.name}</div>
              )}
              <div className="text-xs text-[var(--text-muted)]">
                {t('speed')}: {selectedVehicle.speed} km/h
              </div>
            </div>
            <button
              onClick={() => setSelectedVehicle(null)}
              className="text-[var(--text-muted)] text-lg p-1"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StopLayer({ stops }: { stops: StopInfo[] }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())

  useEffect(() => {
    const handler = () => setZoom(map.getZoom())
    map.on('zoomend', handler)
    return () => { map.off('zoomend', handler) }
  }, [map])

  if (zoom < 15) return null

  return (
    <>
      {stops.map(s => (
        <CircleMarker
          key={s.id}
          center={[s.latitude, s.longitude]}
          radius={4}
          fillColor="#e94560"
          fillOpacity={0.7}
          color="#fff"
          weight={1}
        />
      ))}
    </>
  )
}

function LocateButton({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  return (
    <button
      onClick={() => map.flyTo([lat, lng], 16)}
      className="absolute top-3 right-3 z-[1000] w-9 h-9 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow flex items-center justify-center"
      style={{ position: 'absolute' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    </button>
  )
}
