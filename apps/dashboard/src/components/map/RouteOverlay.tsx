'use client'

import { Polyline, Tooltip } from 'react-leaflet'

interface RouteShape {
  direction: string
  geometry: [number, number][] // [lng, lat]
}

interface RouteOverlayData {
  id: string
  number: string
  name: string
  color: string | null
  shapes: RouteShape[]
}

interface RouteOverlayProps {
  routes: RouteOverlayData[]
}

export default function RouteOverlay({ routes }: RouteOverlayProps) {
  return (
    <>
      {routes.map(route =>
        route.shapes.map(shape => {
          // Convert [lng, lat] → [lat, lng] for Leaflet
          const positions: [number, number][] = shape.geometry.map(
            ([lng, lat]) => [lat, lng]
          )
          if (positions.length === 0) return null

          return (
            <Polyline
              key={`${route.id}-${shape.direction}`}
              positions={positions}
              pathOptions={{
                color: route.color || '#888',
                weight: 3,
                opacity: 0.7,
              }}
            >
              <Tooltip sticky>
                <span style={{ fontSize: '12px' }}>
                  <strong>{route.number}</strong> {route.name}
                  {shape.direction === 'INBOUND' ? ' (return)' : ''}
                </span>
              </Tooltip>
            </Polyline>
          )
        })
      )}
    </>
  )
}
