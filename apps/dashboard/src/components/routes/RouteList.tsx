'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface RouteInfo {
  id: string
  number: string
  name: string
  description: string | null
  color: string | null
  isActive: boolean
  operator: string | null
  intervalMinutes: number | null
  operatingHours: string | null
  distanceMeters: number | null
  stopCount: number
}

export default function RouteList() {
  const [routes, setRoutes] = useState<RouteInfo[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/routes?${params}`)
      if (!res.ok) throw new Error('Failed to fetch routes')
      const data: RouteInfo[] = await res.json()
      setRoutes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 20px',
        background: '#1a1a2e',
        borderBottom: '1px solid #2a2a4a',
      }}>
        <Link href="/" style={{ color: '#aaa', textDecoration: 'none', fontSize: '14px' }}>
          ← Dashboard
        </Link>
        <strong style={{ fontSize: '18px' }}>Bus Routes</strong>
        <span style={{ color: '#aaa', fontSize: '13px' }}>
          {routes.length} routes
        </span>
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Search routes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #444',
            background: '#16213e',
            color: '#fff',
            fontSize: '13px',
            width: '220px',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {error && (
          <div style={{ color: '#ff6b6b', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>Loading routes...</div>
        ) : routes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
            No routes found. Run the OSM import script to populate route data.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #2a2a4a' }}>
                  <th style={thStyle}>Route</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Operator</th>
                  <th style={thStyle}>Stops</th>
                  <th style={thStyle}>Interval</th>
                  <th style={thStyle}>Distance</th>
                  <th style={thStyle}>Hours</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(route => (
                  <tr
                    key={route.id}
                    style={{
                      borderBottom: '1px solid #1e1e3a',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={tdStyle}>
                      <Link href={`/routes/${route.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                          <span style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            background: route.color || '#666',
                          }} />
                          <strong>{route.number}</strong>
                        </div>
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/routes/${route.id}`} style={{ textDecoration: 'none', color: '#7eb8ff' }}>
                        {route.name}
                      </Link>
                    </td>
                    <td style={{ ...tdStyle, color: '#aaa' }}>{route.operator || '—'}</td>
                    <td style={tdStyle}>{route.stopCount}</td>
                    <td style={tdStyle}>
                      {route.intervalMinutes ? `${route.intervalMinutes} min` : '—'}
                    </td>
                    <td style={tdStyle}>
                      {route.distanceMeters ? `${(route.distanceMeters / 1000).toFixed(1)} km` : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: '#aaa', fontSize: '12px' }}>
                      {route.operatingHours || '—'}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        background: route.isActive ? '#1a3a2e' : '#3a1a1e',
                        color: route.isActive ? '#4ade80' : '#f87171',
                      }}>
                        {route.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: '#aaa',
  fontWeight: 600,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
}
