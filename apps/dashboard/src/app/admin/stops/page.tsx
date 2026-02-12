'use client'

import { useState, useEffect } from 'react'

interface Stop {
  id: string
  name: string
  latitude: number
  longitude: number
  zone: string | null
  wheelchairAccessible: boolean
}

export default function AdminStopsPage() {
  const [stops, setStops] = useState<Stop[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stops?limit=500')
      .then(r => r.json())
      .then(data => setStops(data.stops || data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? stops.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : stops

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Stop Management</h1>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search stops..."
        style={{
          padding: '8px 12px', background: '#16213e', border: '1px solid #333',
          color: '#fff', borderRadius: '6px', fontSize: '13px', width: '300px', marginBottom: '16px',
        }}
      />

      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Loading...</div>
      ) : (
        <div style={{ background: '#111128', borderRadius: '8px', border: '1px solid #1e1e3a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e3a' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Latitude</th>
                <th style={thStyle}>Longitude</th>
                <th style={thStyle}>Zone</th>
                <th style={thStyle}>Accessible</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                  <td style={tdStyle}>{s.name}</td>
                  <td style={tdStyle}>{s.latitude.toFixed(5)}</td>
                  <td style={tdStyle}>{s.longitude.toFixed(5)}</td>
                  <td style={tdStyle}>{s.zone || '—'}</td>
                  <td style={tdStyle}>{s.wheelchairAccessible ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div style={{ padding: '8px 12px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
              Showing 100 of {filtered.length} stops
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: '#aaa', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }
const tdStyle: React.CSSProperties = { padding: '8px 12px', color: '#ccc' }
