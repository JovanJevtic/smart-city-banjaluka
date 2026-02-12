'use client'

import { useState, useEffect } from 'react'

interface HealthData {
  status: string
  timestamp: string
  dashboard: {
    uptime: number
    memory: { rss: number; heapUsed: number }
    nodeVersion: string
  }
  database: {
    status: string
    devices?: { total: number; online: number }
    telemetry?: { total: number; lastReceived: string }
    alerts?: { total: number; unacknowledged: number }
  }
  api?: {
    status: string
    uptime?: number
    memory?: { rss: number; heapUsed: number; heapTotal: number }
    database?: { status: string; pool: { total: number; idle: number; waiting: number } }
    redis?: { status: string; usedMemory?: string }
    http?: { totalRequests: number; totalErrors: number }
  }
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchHealth = () => {
    setLoading(true)
    fetch('/api/system/health')
      .then(r => r.json())
      .then(data => { setHealth(data); setLastRefresh(new Date()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <span style={{
      display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
      background: ok ? '#22c55e' : '#ef4444', marginRight: '8px',
    }} />
  )

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>System Health</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchHealth}
            style={{
              padding: '6px 14px', background: '#16213e', border: '1px solid #333',
              color: '#fff', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && !health ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : health ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', maxWidth: '1200px' }}>

          {/* Overall Status */}
          <Card title="Overall Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{
                padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
                background: health.status === 'healthy' ? '#14532d' : '#7f1d1d',
                color: health.status === 'healthy' ? '#22c55e' : '#ef4444',
              }}>
                {health.status.toUpperCase()}
              </span>
            </div>
            <Row label="Timestamp" value={new Date(health.timestamp).toLocaleString()} />
          </Card>

          {/* Dashboard Process */}
          <Card title="Dashboard (Next.js)">
            <Row label="Node.js" value={health.dashboard.nodeVersion} />
            <Row label="Uptime" value={formatUptime(health.dashboard.uptime)} />
            <Row label="Memory (RSS)" value={`${health.dashboard.memory.rss} MB`} />
            <Row label="Heap Used" value={`${health.dashboard.memory.heapUsed} MB`} />
          </Card>

          {/* Database */}
          <Card title="Database (PostgreSQL)">
            <Row label="Status" value={<><StatusDot ok={health.database.status === 'ok'} />{health.database.status}</>} />
            {health.database.devices && (
              <>
                <Row label="Total Devices" value={String(health.database.devices.total)} />
                <Row label="Online Devices" value={<span style={{ color: '#22c55e' }}>{health.database.devices.online}</span>} />
              </>
            )}
            {health.database.telemetry && (
              <>
                <Row label="Telemetry Records" value={Number(health.database.telemetry.total).toLocaleString()} />
                <Row label="Last Received" value={health.database.telemetry.lastReceived
                  ? new Date(health.database.telemetry.lastReceived).toLocaleString()
                  : 'Never'
                } />
              </>
            )}
            {health.database.alerts && (
              <>
                <Row label="Total Alerts" value={String(health.database.alerts.total)} />
                <Row label="Unacknowledged" value={
                  <span style={{ color: health.database.alerts.unacknowledged > 0 ? '#f59e0b' : '#22c55e' }}>
                    {health.database.alerts.unacknowledged}
                  </span>
                } />
              </>
            )}
          </Card>

          {/* API Server */}
          <Card title="API Server (Fastify)">
            {health.api ? (
              <>
                <Row label="Status" value={<><StatusDot ok={health.api.status === 'healthy'} />{health.api.status}</>} />
                {health.api.uptime !== undefined && <Row label="Uptime" value={formatUptime(health.api.uptime)} />}
                {health.api.memory && (
                  <>
                    <Row label="Memory (RSS)" value={`${health.api.memory.rss} MB`} />
                    <Row label="Heap Used" value={`${health.api.memory.heapUsed} MB`} />
                  </>
                )}
                {health.api.http && (
                  <>
                    <Row label="Total Requests" value={health.api.http.totalRequests.toLocaleString()} />
                    <Row label="Total Errors" value={
                      <span style={{ color: health.api.http.totalErrors > 0 ? '#ef4444' : '#22c55e' }}>
                        {health.api.http.totalErrors}
                      </span>
                    } />
                  </>
                )}
              </>
            ) : (
              <Row label="Status" value={<><StatusDot ok={false} />unreachable</>} />
            )}
          </Card>

          {/* Redis */}
          <Card title="Redis">
            {health.api?.redis ? (
              <>
                <Row label="Status" value={<><StatusDot ok={health.api.redis.status === 'ok'} />{health.api.redis.status}</>} />
                {health.api.redis.usedMemory && <Row label="Memory Used" value={health.api.redis.usedMemory} />}
              </>
            ) : (
              <Row label="Status" value={<><StatusDot ok={false} />unknown</>} />
            )}
          </Card>

          {/* DB Pool */}
          <Card title="Connection Pool">
            {health.api?.database?.pool ? (
              <>
                <Row label="Total Connections" value={String(health.api.database.pool.total)} />
                <Row label="Idle" value={String(health.api.database.pool.idle)} />
                <Row label="Waiting" value={
                  <span style={{ color: health.api.database.pool.waiting > 0 ? '#f59e0b' : '#22c55e' }}>
                    {health.api.database.pool.waiting}
                  </span>
                } />
              </>
            ) : (
              <Row label="Status" value="Data unavailable" />
            )}
          </Card>

        </div>
      ) : null}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#111128', borderRadius: '8px', border: '1px solid #1e1e3a', padding: '16px',
    }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', marginBottom: '12px' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: '#ddd' }}>{value}</span>
    </div>
  )
}
