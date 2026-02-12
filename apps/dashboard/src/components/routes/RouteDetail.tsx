'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import RouteMap from './RouteMap'

interface StopInfo {
  id: string
  sequence: number
  direction: string
  avgTimeFromStart: number | null
  distanceFromStart: number | null
  stop: {
    id: string
    name: string
    code: string | null
    latitude: number
    longitude: number
  }
}

interface ShapeInfo {
  id: string
  direction: string
  geometry: [number, number][] // [lng, lat]
  distanceMeters: number | null
}

interface RouteDetailData {
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
  avgDurationMinutes: number | null
  osmRelationId: number | null
  stops: StopInfo[]
  shapes: ShapeInfo[]
  schedules: { id: string; departureTime: string; direction: string; daysOfWeek: number[] }[]
}

export default function RouteDetail({ routeId }: { routeId: string }) {
  const [route, setRoute] = useState<RouteDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeDirection, setActiveDirection] = useState<string>('OUTBOUND')

  const fetchRoute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/routes/${routeId}`)
      if (!res.ok) throw new Error('Failed to fetch route')
      const data: RouteDetailData = await res.json()
      setRoute(data)
      // Set active direction to first available
      if (data.shapes.length > 0) {
        setActiveDirection(data.shapes[0].direction)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [routeId])

  useEffect(() => {
    fetchRoute()
  }, [fetchRoute])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d1a', color: '#aaa' }}>
        Loading route details...
      </div>
    )
  }

  if (error || !route) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d1a', color: '#ff6b6b' }}>
        {error || 'Route not found'}
      </div>
    )
  }

  const filteredStops = route.stops.filter(s => s.direction === activeDirection)
  const activeShape = route.shapes.find(s => s.direction === activeDirection)
  const directions = [...new Set(route.stops.map(s => s.direction))]

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
        <Link href="/routes" style={{ color: '#aaa', textDecoration: 'none', fontSize: '14px' }}>
          ← Routes
        </Link>
        <span style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          borderRadius: '3px',
          background: route.color || '#666',
        }} />
        <strong style={{ fontSize: '18px' }}>Route {route.number}</strong>
        <span style={{ color: '#aaa', fontSize: '14px' }}>{route.name}</span>
        <div style={{ flex: 1 }} />
        {/* Direction toggle */}
        {directions.length > 1 && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {directions.map(dir => (
              <button
                key={dir}
                onClick={() => setActiveDirection(dir)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  background: activeDirection === dir ? '#e94560' : '#16213e',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {dir === 'OUTBOUND' ? 'Outbound' : 'Inbound'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content: 2-column layout */}
      <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>
        {/* Left panel: Route info + stops */}
        <div style={{
          width: '380px',
          minWidth: '380px',
          overflowY: 'auto',
          borderRight: '1px solid #2a2a4a',
          background: '#111128',
        }}>
          {/* Route info cards */}
          <div style={{ padding: '16px', borderBottom: '1px solid #2a2a4a' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <InfoCard label="Operator" value={route.operator || '—'} />
              <InfoCard label="Interval" value={route.intervalMinutes ? `${route.intervalMinutes} min` : '—'} />
              <InfoCard label="Distance" value={route.distanceMeters ? `${(route.distanceMeters / 1000).toFixed(1)} km` : '—'} />
              <InfoCard label="Duration" value={route.avgDurationMinutes ? `${route.avgDurationMinutes} min` : '—'} />
              <InfoCard label="Hours" value={route.operatingHours || '—'} />
              <InfoCard label="Stops" value={String(filteredStops.length)} />
            </div>
          </div>

          {/* Stop list */}
          <div style={{ padding: '12px 16px' }}>
            <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px', fontWeight: 600 }}>
              Stops ({activeDirection === 'OUTBOUND' ? 'Outbound' : 'Inbound'})
            </h3>
            {filteredStops.length === 0 ? (
              <div style={{ color: '#666', fontSize: '13px' }}>No stops for this direction</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {filteredStops.map((rs, idx) => (
                  <div
                    key={rs.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: idx % 2 === 0 ? '#1a1a2e' : 'transparent',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: route.color || '#444',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {rs.sequence}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rs.stop.name}
                      </div>
                      {rs.distanceFromStart != null && (
                        <div style={{ color: '#666', fontSize: '11px' }}>
                          {(rs.distanceFromStart / 1000).toFixed(1)} km from start
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Map */}
        <div style={{ flex: 1 }}>
          <RouteMap
            shape={activeShape?.geometry || null}
            stops={filteredStops.map(rs => ({
              name: rs.stop.name,
              latitude: rs.stop.latitude,
              longitude: rs.stop.longitude,
              sequence: rs.sequence,
            }))}
            color={route.color || '#2196F3'}
          />
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: '6px',
      background: '#1a1a2e',
    }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '14px' }}>{value}</div>
    </div>
  )
}
