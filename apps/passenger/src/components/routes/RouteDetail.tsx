'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useLocale } from '@/hooks/useLocale'
import type { TranslationKey } from '@/lib/i18n'
import type { RouteStop } from '@/lib/types'

const RouteMap = dynamic(() => import('@/components/map/RouteMap'), { ssr: false })

interface RouteData {
  id: string
  number: string
  name: string
  color: string | null
  operator: string | null
  intervalMinutes: number | null
  operatingHours: string | null
  distanceMeters: number | null
  stops: RouteStop[]
  shapes: { id: string; direction: string; coordinates: [number, number][] }[]
  schedules: { id: string; dayType: string; shift: string; departureTime: string }[]
}

type Tab = 'map' | 'stops' | 'timetable'

export default function RouteDetail({ routeId }: { routeId: string }) {
  const { t } = useLocale()
  const [route, setRoute] = useState<RouteData | null>(null)
  const [tab, setTab] = useState<Tab>('map')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/routes/${routeId}`)
      .then(r => r.json())
      .then(setRoute)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [routeId])

  if (loading) return <div className="text-center py-8 text-[var(--text-muted)]">{t('loading')}</div>
  if (!route) return <div className="text-center py-8 text-[var(--text-muted)]">{t('error')}</div>

  const outboundStops = route.stops.filter(s => s.direction === 'OUTBOUND')
  const inboundStops = route.stops.filter(s => s.direction === 'INBOUND')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/routes" className="text-[var(--text-muted)] text-sm">←</Link>
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-bold"
            style={{ background: route.color || '#666' }}
          >
            {route.number}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{route.name}</div>
            {route.operator && (
              <div className="text-xs text-[var(--text-muted)]">{route.operator}</div>
            )}
          </div>
        </div>
        <div className="flex gap-1 text-xs text-[var(--text-muted)]">
          {route.intervalMinutes && <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded">{route.intervalMinutes} min</span>}
          {route.distanceMeters && <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded">{(route.distanceMeters / 1000).toFixed(1)} km</span>}
          {route.operatingHours && <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded">{route.operatingHours}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {(['map', 'stops', 'timetable'] as Tab[]).map(t2 => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${
              tab === t2
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {t2 === 'map' ? t('map') : t2 === 'stops' ? t('stops') : t('timetable')}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'map' && (
          <RouteMap
            routeColor={route.color || '#666'}
            shapes={route.shapes}
            stops={route.stops}
          />
        )}
        {tab === 'stops' && (
          <div className="p-4">
            {outboundStops.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">{t('outbound')}</h3>
                <div className="flex flex-col gap-0 mb-4">
                  {outboundStops.map((s, i) => (
                    <Link
                      key={s.id}
                      href={`/stops/${s.stopId}`}
                      className="flex items-center gap-3 py-2 border-l-2 border-[var(--border)] pl-4 ml-2 hover:bg-[var(--bg-secondary)] -mt-px"
                    >
                      <span className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--border)] flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)] -ml-[23px] bg-[var(--bg-primary)]">
                        {i + 1}
                      </span>
                      <span className="text-sm text-[var(--text-primary)]">{s.name}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
            {inboundStops.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">{t('inbound')}</h3>
                <div className="flex flex-col gap-0">
                  {inboundStops.map((s, i) => (
                    <Link
                      key={s.id}
                      href={`/stops/${s.stopId}`}
                      className="flex items-center gap-3 py-2 border-l-2 border-[var(--border)] pl-4 ml-2 hover:bg-[var(--bg-secondary)] -mt-px"
                    >
                      <span className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--border)] flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)] -ml-[23px] bg-[var(--bg-primary)]">
                        {i + 1}
                      </span>
                      <span className="text-sm text-[var(--text-primary)]">{s.name}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {tab === 'timetable' && (
          <Timetable schedules={route.schedules} t={t} />
        )}
      </div>
    </div>
  )
}

function Timetable({ schedules, t }: { schedules: RouteData['schedules']; t: (key: TranslationKey) => string }) {
  if (schedules.length === 0) {
    return <div className="p-4 text-center text-[var(--text-muted)] text-sm">{t('no_service')}</div>
  }

  const grouped = schedules.reduce<Record<string, string[]>>((acc, s) => {
    const key = s.dayType
    if (!acc[key]) acc[key] = []
    acc[key].push(s.departureTime)
    return acc
  }, {})

  const dayLabels: Record<string, string> = {
    WEEKDAY: t('weekdays'),
    SATURDAY: t('saturday'),
    SUNDAY: t('sunday'),
  }

  return (
    <div className="p-4">
      {Object.entries(grouped).map(([dayType, times]) => (
        <div key={dayType} className="mb-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">
            {dayLabels[dayType] || dayType}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {times.sort().map((time, i) => (
              <span
                key={i}
                className="px-2.5 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] font-mono"
              >
                {time}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
