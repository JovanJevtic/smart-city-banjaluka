'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface RouteInfo {
  id: string
  number: string
  name: string
  color: string | null
  operator: string | null
  stopCount: number
  isActive: boolean
  distanceMeters: number | null
  intervalMinutes: number | null
}

export default function RouteAnalytics() {
  const [routes, setRoutes] = useState<RouteInfo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/routes')
      if (res.ok) setRoutes(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Route Analytics</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading...</div>
      ) : routes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No routes found. Import routes from OSM first.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #2a2a4a' }}>
              <th style={thStyle}>Route</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Operator</th>
              <th style={thStyle}>Stops</th>
              <th style={thStyle}>Distance</th>
              <th style={thStyle}>Interval</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {routes.map(route => (
              <tr key={route.id} style={{ borderBottom: '1px solid #1e1e3a' }}>
                <td style={tdStyle}>
                  <Link href={`/routes/${route.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        display: 'inline-block', width: '12px', height: '12px',
                        borderRadius: '3px', background: route.color || '#666',
                      }} />
                      <strong>{route.number}</strong>
                    </div>
                  </Link>
                </td>
                <td style={tdStyle}>
                  <Link href={`/routes/${route.id}`} style={{ color: '#7eb8ff', textDecoration: 'none' }}>
                    {route.name}
                  </Link>
                </td>
                <td style={{ ...tdStyle, color: '#aaa' }}>{route.operator || '—'}</td>
                <td style={tdStyle}>{route.stopCount}</td>
                <td style={tdStyle}>
                  {route.distanceMeters ? `${(route.distanceMeters / 1000).toFixed(1)} km` : '—'}
                </td>
                <td style={tdStyle}>
                  {route.intervalMinutes ? `${route.intervalMinutes} min` : '—'}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '12px',
                    background: route.isActive ? '#1a3a2e' : '#3a1a1e',
                    color: route.isActive ? '#4ade80' : '#f87171',
                  }}>{route.isActive ? 'Active' : 'Inactive'}</span>
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
