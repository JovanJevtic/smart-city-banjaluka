'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import DateRangePicker, { type DateRange } from '../ui/DateRangePicker'
import StatCard from '../ui/StatCard'
import ChartContainer from '../ui/ChartContainer'

interface FleetStats {
  totalDistance: number
  totalTrips: number
  totalDrivingTime: number
  totalIdleTime: number
  avgSpeed: number
  maxSpeed: number
  totalFuel: number
  totalAlerts: number
  devices: { total: number; online: number }
  alertsByType: { type: string; count: number }[]
  alertsBySeverity: { severity: string; count: number }[]
}

interface DistanceTrend {
  date: string
  totalDistance: number
  totalTrips: number
  activeVehicles: number
}

interface TopVehicle {
  deviceId: string
  totalDistance: number
  totalTrips: number
  avgSpeed: number
  drivingTime: number
  alertCount: number
  device: { imei: string; name: string | null } | null
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',
}

const TYPE_COLORS = ['#e94560', '#0f3460', '#16213e', '#533483', '#2b9348', '#f77f00', '#d62828', '#457b9d', '#1d3557', '#a8dadc']

export default function FleetAnalytics() {
  const [days, setDays] = useState(7)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  })
  const [stats, setStats] = useState<FleetStats | null>(null)
  const [distanceTrend, setDistanceTrend] = useState<DistanceTrend[]>([])
  const [topVehicles, setTopVehicles] = useState<TopVehicle[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, trendRes, topRes] = await Promise.all([
        fetch(`/api/analytics/fleet?days=${days}`),
        fetch(`/api/analytics/distance-trend?days=${days}`),
        fetch(`/api/analytics/top-vehicles?days=${days}`),
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (trendRes.ok) setDistanceTrend(await trendRes.json())
      if (topRes.ok) setTopVehicles(await topRes.json())
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDateChange = (range: DateRange) => {
    setDateRange(range)
    const diffDays = Math.ceil((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000))
    setDays(Math.max(1, diffDays))
  }

  const formatDistance = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Fleet Analytics</h1>
        <DateRangePicker value={dateRange} onChange={handleDateChange} />
      </div>

      {/* Stat cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <StatCard label="Total Distance" value={formatDistance(stats.totalDistance)} />
          <StatCard label="Active Vehicles" value={stats.devices.online} subtext={`of ${stats.devices.total}`} />
          <StatCard label="Total Trips" value={stats.totalTrips} />
          <StatCard label="Avg Speed" value={`${stats.avgSpeed.toFixed(1)} km/h`} />
          <StatCard label="Driving Time" value={formatTime(stats.totalDrivingTime)} />
          <StatCard label="Alerts" value={stats.totalAlerts} color={stats.totalAlerts > 0 ? '#f59e0b' : '#4ade80'} />
        </div>
      )}

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ChartContainer title="Distance Trend" loading={loading} height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={distanceTrend.map(d => ({ ...d, km: d.totalDistance / 1000 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
              <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 6 }} />
              <Line type="monotone" dataKey="km" stroke="#2196F3" strokeWidth={2} dot={false} name="Distance (km)" />
              <Line type="monotone" dataKey="activeVehicles" stroke="#4ade80" strokeWidth={2} dot={false} name="Vehicles" />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title="Alert Distribution" loading={loading} height={280}>
          {stats && stats.alertsByType.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.alertsByType} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label>
                  {stats.alertsByType.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
              No alerts in this period
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Charts row 2: Top vehicles */}
      <ChartContainer title="Top 10 Vehicles by Distance" loading={loading} height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topVehicles.map(v => ({
            name: v.device?.name || v.device?.imei || v.deviceId.slice(0, 8),
            km: Math.round(v.totalDistance / 1000),
            trips: v.totalTrips,
          }))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} width={120} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 6 }} />
            <Bar dataKey="km" fill="#e94560" name="Distance (km)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
