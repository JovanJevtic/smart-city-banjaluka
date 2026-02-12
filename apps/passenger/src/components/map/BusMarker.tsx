'use client'

import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { LiveVehicle } from '@/lib/types'

interface BusMarkerProps {
  vehicle: LiveVehicle
  onClick?: (vehicle: LiveVehicle) => void
}

function createBusIcon(routeNumber: string | null, color: string | null, heading: number): L.DivIcon {
  const bg = color || '#666'
  const rotation = heading || 0
  return L.divIcon({
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 36],
    html: `
      <div style="
        display:flex;flex-direction:column;align-items:center;
        transform:rotate(${rotation}deg);
        filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        <div style="
          width:28px;height:28px;border-radius:50%;
          background:${bg};border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-size:10px;font-weight:700;
          line-height:1;
        ">${routeNumber || '?'}</div>
        <div style="
          width:0;height:0;
          border-left:5px solid transparent;
          border-right:5px solid transparent;
          border-top:8px solid ${bg};
          margin-top:-2px;
        "></div>
      </div>
    `,
  })
}

export default function BusMarker({ vehicle, onClick }: BusMarkerProps) {
  const icon = createBusIcon(vehicle.routeNumber, vehicle.routeColor, vehicle.heading)

  return (
    <Marker
      position={[vehicle.latitude, vehicle.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => onClick?.(vehicle),
      }}
    >
      <Tooltip direction="top" offset={[0, -40]}>
        <div style={{ fontSize: '12px' }}>
          <strong>Linija {vehicle.routeNumber || '?'}</strong>
          {vehicle.name && <div>{vehicle.name}</div>}
          <div>{vehicle.speed} km/h</div>
        </div>
      </Tooltip>
    </Marker>
  )
}
