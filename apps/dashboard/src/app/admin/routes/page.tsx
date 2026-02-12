'use client'

import { useState, useEffect } from 'react'

interface Route {
  id: string
  number: string
  name: string
  color: string | null
  operator: string | null
  intervalMinutes: number | null
  isActive: boolean
  stopCount?: number
}

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(setRoutes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Route Management</h1>

      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Loading...</div>
      ) : (
        <div style={{ background: '#111128', borderRadius: '8px', border: '1px solid #1e1e3a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e3a' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Operator</th>
                <th style={thStyle}>Interval</th>
                <th style={thStyle}>Stops</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: r.color || '#666', color: '#fff', fontSize: '11px', fontWeight: 700,
                    }}>
                      {r.number}
                    </span>
                  </td>
                  <td style={tdStyle}>{r.name}</td>
                  <td style={tdStyle}>{r.operator || '—'}</td>
                  <td style={tdStyle}>{r.intervalMinutes ? `${r.intervalMinutes} min` : '—'}</td>
                  <td style={tdStyle}>{r.stopCount ?? '—'}</td>
                  <td style={tdStyle}>
                    <span style={{ color: r.isActive ? '#22c55e' : '#ef4444' }}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: '#aaa', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }
const tdStyle: React.CSSProperties = { padding: '8px 12px', color: '#ccc' }
