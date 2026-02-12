'use client'

import { CircleMarker, Tooltip, useMap } from 'react-leaflet'
import { useState, useEffect } from 'react'

interface StopData {
  id: string
  name: string
  latitude: number
  longitude: number
}

interface StopMarkersProps {
  stops: StopData[]
}

const MIN_ZOOM_FOR_STOPS = 14

export default function StopMarkers({ stops }: StopMarkersProps) {
  const map = useMap()
  const [visible, setVisible] = useState(map.getZoom() >= MIN_ZOOM_FOR_STOPS)

  useEffect(() => {
    const onZoom = () => {
      setVisible(map.getZoom() >= MIN_ZOOM_FOR_STOPS)
    }
    map.on('zoomend', onZoom)
    return () => {
      map.off('zoomend', onZoom)
    }
  }, [map])

  if (!visible) return null

  return (
    <>
      {stops.map(stop => (
        <CircleMarker
          key={stop.id}
          center={[stop.latitude, stop.longitude]}
          radius={4}
          pathOptions={{
            color: '#fff',
            weight: 1.5,
            fillColor: '#0f3460',
            fillOpacity: 0.9,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <span style={{ fontSize: '11px' }}>{stop.name}</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  )
}
