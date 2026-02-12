'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteStop } from '@/lib/types'

interface RouteMapProps {
  routeColor: string
  shapes: { id: string; direction: string; coordinates: [number, number][] }[]
  stops: RouteStop[]
}

export default function RouteMap({ routeColor, shapes, stops }: RouteMapProps) {
  return (
    <MapContainer
      center={[44.772, 17.191]}
      zoom={13}
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {shapes.map(shape => {
        const positions = shape.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
        return (
          <Polyline
            key={shape.id}
            positions={positions}
            color={routeColor}
            weight={4}
            opacity={shape.direction === 'INBOUND' ? 0.5 : 0.9}
          />
        )
      })}
      {stops.map(stop => (
        <CircleMarker
          key={stop.id}
          center={[stop.latitude, stop.longitude]}
          radius={6}
          fillColor="#fff"
          fillOpacity={1}
          color={routeColor}
          weight={2}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <span style={{ fontSize: '12px' }}>{stop.name}</span>
          </Tooltip>
        </CircleMarker>
      ))}
      <FitBounds shapes={shapes} stops={stops} />
    </MapContainer>
  )
}

function FitBounds({ shapes, stops }: { shapes: RouteMapProps['shapes']; stops: RouteStop[] }) {
  const map = useMap()

  useEffect(() => {
    const points: [number, number][] = []
    shapes.forEach(s => s.coordinates.forEach(([lng, lat]) => points.push([lat, lng])))
    stops.forEach(s => points.push([s.latitude, s.longitude]))
    if (points.length > 0) {
      map.fitBounds(points, { padding: [30, 30] })
    }
  }, [map, shapes, stops])

  return null
}
