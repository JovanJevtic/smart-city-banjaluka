'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface StopMarker {
  name: string
  latitude: number
  longitude: number
  sequence: number
}

interface RouteMapProps {
  shape: [number, number][] | null // [[lng, lat], ...]
  stops: StopMarker[]
  color: string
}

function FitToRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [map, positions])

  return null
}

const BANJA_LUKA_CENTER: [number, number] = [44.7722, 17.191]

export default function RouteMap({ shape, stops, color }: RouteMapProps) {
  // Convert shape from [lng, lat] to [lat, lng] for Leaflet
  const polylinePositions: [number, number][] = shape
    ? shape.map(([lng, lat]) => [lat, lng])
    : []

  // Stop positions for bounds
  const allPositions: [number, number][] = polylinePositions.length > 0
    ? polylinePositions
    : stops.map(s => [s.latitude, s.longitude])

  return (
    <MapContainer
      center={BANJA_LUKA_CENTER}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route polyline */}
      {polylinePositions.length > 0 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{ color, weight: 4, opacity: 0.85 }}
        />
      )}

      {/* Stop markers */}
      {stops.map((stop) => (
        <CircleMarker
          key={`${stop.sequence}-${stop.name}`}
          center={[stop.latitude, stop.longitude]}
          radius={6}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <span style={{ fontSize: '12px' }}>
              <strong>{stop.sequence}.</strong> {stop.name}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}

      {allPositions.length > 0 && <FitToRoute positions={allPositions} />}
    </MapContainer>
  )
}
