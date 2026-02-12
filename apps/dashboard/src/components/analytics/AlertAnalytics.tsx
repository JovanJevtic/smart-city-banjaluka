'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import StatCard from '../ui/StatCard'
import ChartContainer from '../ui/ChartContainer'

interface AlertTrends {
  trends: { date: string; severity: string; count: number }[]
  byType: { type: string; count: number }[]
  byVehicle: { deviceId: string; count: number }[]
}

const TYPE_COLORS = ['#e94560', '#0f3460', '#533483', '#2b9348', '#f77f00', '#d62828', '#457b9d', '#1d3557', '#a8dadc', '#264653']

export default function AlertAnalytics() {
  const [data, setData] = useState<AlertTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/alert-trends?days=${days}`)
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  // Aggregate trends by date (sum all severities)
  const dailyTotals = data ? Object.values(
    data.trends.reduce((acc, t) => {
      if (!acc[t.date]) acc[t.date] = { date: t.date, CRITICAL: 0, WARNING: 0, INFO: 0 }
      acc[t.date][t.severity as 'CRITICAL' | 'WARNING' | 'INFO'] = t.count
      return acc
    }, {} as Record<string, { date: string; CRITICAL: number; WARNING: number; INFO: number }>)
  ) : []

  const totalAlerts = data ? data.byType.reduce((s, t) => s + t.count, 0) : 0
  const criticalCount = data ? data.trends.filter(t => t.severity === 'CRITICAL').reduce((s, t) => s + t.count, 0) : 0

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Alert Analytics</h1>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '4px 10px', borderRadius: '4px', border: 'none',
              background: days === d ? '#e94560' : '#16213e', color: '#fff', cursor: 'pointer', fontSize: '12px',
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Total Alerts" value={totalAlerts} />
        <StatCard label="Critical" value={criticalCount} color="#ef4444" />
        <StatCard label="Alert Types" value={data?.byType.length || 0} />
        <StatCard label="Vehicles with Alerts" value={data?.byVehicle.length || 0} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ChartContainer title="Alerts Over Time" loading={loading} height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyTotals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
              <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 6 }} />
              <Bar dataKey="CRITICAL" stackId="a" fill="#ef4444" name="Critical" />
              <Bar dataKey="WARNING" stackId="a" fill="#f59e0b" name="Warning" />
              <Bar dataKey="INFO" stackId="a" fill="#3b82f6" name="Info" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title="Alerts by Type" loading={loading} height={280}>
          {data && data.byType.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byType} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label>
                  {data.byType.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
              No data
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Top alerting vehicles */}
      <ChartContainer title="Top Alerting Vehicles" loading={loading} height={250}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={(data?.byVehicle || []).map(v => ({
            id: v.deviceId.slice(0, 8),
            count: v.count,
          }))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} />
            <YAxis type="category" dataKey="id" tick={{ fill: '#aaa', fontSize: 11 }} width={80} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 6 }} />
            <Bar dataKey="count" fill="#e94560" name="Alerts" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
