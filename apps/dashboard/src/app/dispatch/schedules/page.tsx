'use client'

import { useState, useEffect } from 'react'

interface Schedule {
  id: string
  routeId: string
  daysOfWeek: number[]
  departureTime: string
  direction: string
  isActive: boolean
}

interface RouteOption { id: string; number: string; name: string }

export default function SchedulesPage() {
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [selectedRoute, setSelectedRoute] = useState('')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/routes').then(r => r.json()).then(setRoutes).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedRoute) return
    fetch(`/api/routes/${selectedRoute}`)
      .then(r => r.json())
      .then(data => setSchedules(data.schedules || []))
      .catch(() => {})
  }, [selectedRoute])

  const weekdaySchedules = schedules.filter(s => s.daysOfWeek?.includes(1))
  const saturdaySchedules = schedules.filter(s => s.daysOfWeek?.includes(6))
  const sundaySchedules = schedules.filter(s => s.daysOfWeek?.includes(0))

  const outbound = (list: Schedule[]) => list.filter(s => s.direction === 'OUTBOUND').sort((a, b) => a.departureTime.localeCompare(b.departureTime))
  const inbound = (list: Schedule[]) => list.filter(s => s.direction === 'INBOUND').sort((a, b) => a.departureTime.localeCompare(b.departureTime))

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schedule Management</h1>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Select Route</label>
        <select
          value={selectedRoute}
          onChange={e => setSelectedRoute(e.target.value)}
          style={{ padding: '8px 12px', background: '#16213e', border: '1px solid #333', color: '#fff', borderRadius: '6px', fontSize: '13px', minWidth: '300px' }}
        >
          <option value="">Choose a route...</option>
          {routes.map(r => (
            <option key={r.id} value={r.id}>Linija {r.number} — {r.name}</option>
          ))}
        </select>
      </div>

      {selectedRoute && schedules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px' }}>
          <ScheduleBlock title="Weekdays — Outbound" times={outbound(weekdaySchedules)} />
          <ScheduleBlock title="Weekdays — Inbound" times={inbound(weekdaySchedules)} />
          <ScheduleBlock title="Saturday — Outbound" times={outbound(saturdaySchedules)} />
          <ScheduleBlock title="Saturday — Inbound" times={inbound(saturdaySchedules)} />
          <ScheduleBlock title="Sunday — Outbound" times={outbound(sundaySchedules)} />
          <ScheduleBlock title="Sunday — Inbound" times={inbound(sundaySchedules)} />
        </div>
      )}

      {selectedRoute && schedules.length === 0 && !loading && (
        <div style={{ color: '#666', padding: '20px', textAlign: 'center' }}>No schedules found for this route</div>
      )}
    </div>
  )
}

function ScheduleBlock({ title, times }: { title: string; times: Schedule[] }) {
  if (times.length === 0) return null
  return (
    <div style={{ background: '#111128', borderRadius: '8px', border: '1px solid #1e1e3a', padding: '16px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#aaa', marginBottom: '8px' }}>{title}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {times.map(s => (
          <span key={s.id} style={{
            padding: '4px 10px', background: '#16213e', borderRadius: '4px',
            fontSize: '12px', fontFamily: 'monospace', color: '#fff',
          }}>
            {s.departureTime}
          </span>
        ))}
      </div>
    </div>
  )
}
