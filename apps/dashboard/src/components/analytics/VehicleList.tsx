'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface VehicleRow {
  deviceId: string
  totalDistance: number
  totalTrips: number
  avgSpeed: number
  maxSpeed: number
  drivingTime: number
  alertCount: number
  device: { imei: string; name: string | null } | null
}

export default function VehicleList() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const [sortKey, setSortKey] = useState<'totalDistance' | 'alertCount' | 'avgSpeed'>('totalDistance')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Reuse top-vehicles with a high limit
      const res = await fetch(`/api/analytics/top-vehicles?days=${days}`)
      if (res.ok) setVehicles(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  const sorted = [...vehicles].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Vehicle Analytics</h1>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '4px 10px', borderRadius: '4px', border: 'none',
              background: days === d ? '#e94560' : '#16213e', color: '#fff', cursor: 'pointer', fontSize: '12px',
            }}>{d}d</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span style={{ color: '#666', fontSize: '12px', alignSelf: 'center' }}>Sort:</span>
          {(['totalDistance', 'alertCount', 'avgSpeed'] as const).map(k => (
            <button key={k} onClick={() => setSortKey(k)} style={{
              padding: '4px 8px', borderRadius: '4px', border: 'none',
              background: sortKey === k ? '#0f3460' : '#16213e', color: '#fff', cursor: 'pointer', fontSize: '12px',
            }}>{k === 'totalDistance' ? 'Distance' : k === 'alertCount' ? 'Alerts' : 'Speed'}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No vehicle data for this period.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #2a2a4a' }}>
              <th style={thStyle}>Vehicle</th>
              <th style={thStyle}>Distance</th>
              <th style={thStyle}>Trips</th>
              <th style={thStyle}>Driving Time</th>
              <th style={thStyle}>Avg Speed</th>
              <th style={thStyle}>Max Speed</th>
              <th style={thStyle}>Alerts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(v => (
              <tr key={v.deviceId} style={{ borderBottom: '1px solid #1e1e3a' }}>
                <td style={tdStyle}>
                  <Link href={`/analytics/vehicles/${v.deviceId}`} style={{ color: '#7eb8ff', textDecoration: 'none' }}>
                    {v.device?.name || v.device?.imei || v.deviceId.slice(0, 8)}
                  </Link>
                </td>
                <td style={tdStyle}>{(v.totalDistance / 1000).toFixed(1)} km</td>
                <td style={tdStyle}>{v.totalTrips}</td>
                <td style={tdStyle}>{Math.floor(v.drivingTime / 3600)}h {Math.floor((v.drivingTime % 3600) / 60)}m</td>
                <td style={tdStyle}>{v.avgSpeed?.toFixed(1) || '—'} km/h</td>
                <td style={tdStyle}>{v.maxSpeed || '—'} km/h</td>
                <td style={tdStyle}>
                  <span style={{
                    color: v.alertCount > 5 ? '#f87171' : v.alertCount > 0 ? '#f59e0b' : '#4ade80',
                  }}>{v.alertCount}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', color: '#aaa', fontWeight: 600,
  fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em',
}
const tdStyle: React.CSSProperties = { padding: '10px 12px' }
