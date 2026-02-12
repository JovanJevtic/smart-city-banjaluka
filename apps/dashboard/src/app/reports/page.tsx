'use client'

import { useState, useEffect, useCallback } from 'react'

interface DeviceOption {
  id: string
  imei: string
  name: string | null
}

export default function ReportsPage() {
  const [devices, setDevices] = useState<DeviceOption[]>([])
  const [exportType, setExportType] = useState<'telemetry' | 'alerts' | 'daily-stats'>('daily-stats')
  const [deviceId, setDeviceId] = useState('')
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])
  const [downloading, setDownloading] = useState(false)

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices')
      if (res.ok) setDevices(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchDevices() }, [fetchDevices])

  const handleExport = async () => {
    setDownloading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (deviceId) params.set('deviceId', deviceId)

      const res = await fetch(`/api/export/${exportType}?${params}`)
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `export-${exportType}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Reports & Export</h1>

      {/* CSV Export Section */}
      <div style={{
        background: '#111128', borderRadius: '8px', border: '1px solid #1e1e3a',
        padding: '24px', maxWidth: '600px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>CSV Export</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Export type */}
          <div>
            <label style={labelStyle}>Export Type</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { key: 'daily-stats' as const, label: 'Daily Stats' },
                { key: 'telemetry' as const, label: 'Telemetry' },
                { key: 'alerts' as const, label: 'Alerts' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setExportType(opt.key)}
                  style={{
                    padding: '6px 16px', borderRadius: '6px', border: 'none',
                    background: exportType === opt.key ? '#e94560' : '#16213e',
                    color: '#fff', cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Device selector (for telemetry export) */}
          {exportType === 'telemetry' && (
            <div>
              <label style={labelStyle}>Device (required for telemetry)</label>
              <select
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="">Select device...</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.imei}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={downloading || (exportType === 'telemetry' && !deviceId)}
            style={{
              padding: '10px 24px', borderRadius: '6px', border: 'none',
              background: downloading ? '#333' : '#0f3460',
              color: '#fff', cursor: downloading ? 'wait' : 'pointer',
              fontSize: '14px', fontWeight: 600,
            }}
          >
            {downloading ? 'Downloading...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Info text */}
      <div style={{ marginTop: '24px', color: '#666', fontSize: '13px', maxWidth: '600px' }}>
        <p>Export data as CSV for custom analysis in Excel, Google Sheets, or other tools.</p>
        <p style={{ marginTop: '8px' }}>
          <strong>Daily Stats</strong> — Aggregated daily metrics per vehicle (distance, trips, driving time, speed, alerts)
        </p>
        <p><strong>Telemetry</strong> — Raw GPS telemetry data for a specific device (timestamp, coordinates, speed, heading)</p>
        <p><strong>Alerts</strong> — Alert history with type, severity, and acknowledgment status</p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: '#aaa',
  marginBottom: '4px', textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: '6px',
  border: '1px solid #333', background: '#16213e',
  color: '#fff', fontSize: '13px', width: '100%',
}
