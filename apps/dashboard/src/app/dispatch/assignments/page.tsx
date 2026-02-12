'use client'

import { useState, useEffect, useCallback } from 'react'

interface Assignment {
  id: string
  vehicleId: string
  routeId: string
  shift: string
  startDate: string
  endDate: string | null
  isActive: boolean
  routeNumber: string
  routeName: string
  deviceName: string | null
  deviceImei: string | null
}

interface RouteOption { id: string; number: string; name: string }
interface DeviceOption { id: string; imei: string; name: string | null; vehicleId: string | null }

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [devices, setDevices] = useState<DeviceOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ vehicleId: '', routeId: '', shift: 'ALL_DAY' })
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [aRes, rRes, dRes] = await Promise.all([
        fetch('/api/dispatch/assignments?active=true'),
        fetch('/api/routes'),
        fetch('/api/devices'),
      ])
      if (aRes.ok) setAssignments(await aRes.json())
      if (rRes.ok) setRoutes(await rRes.json())
      if (dRes.ok) setDevices(await dRes.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleCreate = async () => {
    if (!formData.vehicleId || !formData.routeId) return
    try {
      const res = await fetch('/api/dispatch/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowForm(false)
        setFormData({ vehicleId: '', routeId: '', shift: 'ALL_DAY' })
        fetchAll()
      }
    } catch { /* ignore */ }
  }

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Route Assignments</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 16px', background: '#0f3460', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
        >
          {showForm ? 'Cancel' : '+ New Assignment'}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: '#111128', border: '1px solid #1e1e3a', borderRadius: '8px',
          padding: '16px', marginBottom: '16px', maxWidth: '500px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Vehicle</label>
              <select value={formData.vehicleId} onChange={e => setFormData(f => ({ ...f, vehicleId: e.target.value }))}
                style={{ width: '100%', padding: '8px', background: '#16213e', border: '1px solid #333', color: '#fff', borderRadius: '6px', fontSize: '13px' }}>
                <option value="">Select vehicle...</option>
                {devices.filter(d => d.vehicleId).map(d => (
                  <option key={d.id} value={d.vehicleId!}>{d.name || d.imei}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Route</label>
              <select value={formData.routeId} onChange={e => setFormData(f => ({ ...f, routeId: e.target.value }))}
                style={{ width: '100%', padding: '8px', background: '#16213e', border: '1px solid #333', color: '#fff', borderRadius: '6px', fontSize: '13px' }}>
                <option value="">Select route...</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>Linija {r.number} — {r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Shift</label>
              <select value={formData.shift} onChange={e => setFormData(f => ({ ...f, shift: e.target.value }))}
                style={{ width: '100%', padding: '8px', background: '#16213e', border: '1px solid #333', color: '#fff', borderRadius: '6px', fontSize: '13px' }}>
                <option value="ALL_DAY">All Day</option>
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
              </select>
            </div>
            <button onClick={handleCreate}
              style={{ padding: '10px', background: '#e94560', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              Create Assignment
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#666', padding: '20px', textAlign: 'center' }}>Loading...</div>
      ) : (
        <div style={{ background: '#111128', borderRadius: '8px', border: '1px solid #1e1e3a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e3a' }}>
                <th style={thStyle}>Vehicle</th>
                <th style={thStyle}>Route</th>
                <th style={thStyle}>Shift</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Start Date</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                  <td style={tdStyle}>{a.deviceName || a.deviceImei || a.vehicleId}</td>
                  <td style={tdStyle}>Linija {a.routeNumber} — {a.routeName}</td>
                  <td style={tdStyle}>{a.shift}</td>
                  <td style={tdStyle}>
                    <span style={{ color: a.isActive ? '#22c55e' : '#666' }}>
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={tdStyle}>{new Date(a.startDate).toLocaleDateString()}</td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#666' }}>No active assignments</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: '#aaa', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }
const tdStyle: React.CSSProperties = { padding: '8px 12px', color: '#ccc' }
