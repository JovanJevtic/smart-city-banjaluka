'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import StatCard from '../ui/StatCard'
import ChartContainer from '../ui/ChartContainer'

interface VehicleData {
  device: {
    id: string
    imei: string
    name: string | null
    isOnline: boolean
    assignedRouteId: string | null
    currentDirection: string | null
    lastSeen: string | null
  }
  summary: {
    totalDistance: number
    totalTrips: number
    totalDrivingTime: number
    totalIdleTime: number
    avgSpeed: number
    maxSpeed: number
    totalAlerts: number
    totalFuel: number
  }
  dailyStats: {
    date: string
    totalDistance: number
    tripCount: number
    drivingTime: number
    avgSpeed: number | null
    maxSpeed: number | null
    alertCount: number
  }[]
  recentAlerts: {
    id: string
    type: string
    severity: string
    message: string
    createdAt: string
  }[]
}

export default function VehicleDetail({ deviceId }: { deviceId: string }) {
  const [data, setData] = useState<VehicleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/vehicle/${deviceId}?days=${days}`)
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [deviceId, days])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return <div style={{ padding: '40px', color: '#666' }}>Loading...</div>
  }

  const { device, summary, dailyStats, recentAlerts } = data

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <Link href="/analytics/vehicles" style={{ color: '#aaa', textDecoration: 'none', fontSize: '14px' }}>
          ← Vehicles
        </Link>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>
          {device.name || device.imei}
        </h1>
        <span style={{
          padding: '2px 8px', borderRadius: '10px', fontSize: '12px',
          background: device.isOnline ? '#1a3a2e' : '#3a1a1e',
          color: device.isOnline ? '#4ade80' : '#f87171',
        }}>
          {device.isOnline ? 'Online' : 'Offline'}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '4px 10px', borderRadius: '4px', border: 'none',
              background: days === d ? '#e94560' : '#16213e', color: '#fff', cursor: 'pointer', fontSize: '12px',
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Distance" value={`${(summary.totalDistance / 1000).toFixed(1)} km`} />
        <StatCard label="Trips" value={summary.totalTrips} />
        <StatCard label="Driving" value={formatTime(summary.totalDrivingTime)} />
        <StatCard label="Idle" value={formatTime(summary.totalIdleTime)} />
        <StatCard label="Avg Speed" value={`${summary.avgSpeed.toFixed(1)} km/h`} />
        <StatCard label="Max Speed" value={`${summary.maxSpeed} km/h`} />
        <StatCard label="Alerts" value={summary.totalAlerts} color={summary.totalAlerts > 0 ? '#f59e0b' : '#4ade80'} />
      </div>

      {/* Daily distance chart */}
      <ChartContainer title="Daily Distance" loading={false} height={250}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dailyStats.map(d => ({
            date: d.date,
            km: Math.round(d.totalDistance / 1000),
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} />
            <YAxis tick={{ fill: '#666', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 6 }} />
            <Bar dataKey="km" fill="#2196F3" name="Distance (km)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Recent alerts */}
      <div style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px', fontWeight: 600 }}>
          Recent Alerts ({recentAlerts.length})
        </h3>
        {recentAlerts.length === 0 ? (
          <div style={{ color: '#666', fontSize: '13px' }}>No alerts in this period.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {recentAlerts.slice(0, 20).map(alert => (
              <div key={alert.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: '6px', background: '#111128',
                fontSize: '13px',
              }}>
                <span style={{
                  padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                  background: alert.severity === 'CRITICAL' ? '#3a1a1e' : alert.severity === 'WARNING' ? '#3a2e1a' : '#1a2e3a',
                  color: alert.severity === 'CRITICAL' ? '#f87171' : alert.severity === 'WARNING' ? '#f59e0b' : '#7eb8ff',
                }}>{alert.severity}</span>
                <span style={{ color: '#aaa' }}>{alert.type}</span>
                <span style={{ flex: 1 }}>{alert.message}</span>
                <span style={{ color: '#666', fontSize: '11px' }}>
                  {new Date(alert.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
