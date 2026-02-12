'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { useFavorites } from '@/hooks/useFavorites'
import type { StopArrival, StopInfo } from '@/lib/types'

interface ArrivalBoardProps {
  stopId: string
}

export default function ArrivalBoard({ stopId }: ArrivalBoardProps) {
  const { t } = useLocale()
  const { toggle: toggleFav, isFavorite } = useFavorites('stops')
  const [stop, setStop] = useState<StopInfo | null>(null)
  const [arrivals, setArrivals] = useState<StopArrival[]>([])
  const [loading, setLoading] = useState(true)

  const fetchArrivals = useCallback(async () => {
    try {
      const res = await fetch(`/api/stops/${stopId}/arrivals`)
      if (res.ok) setArrivals(await res.json())
    } catch { /* ignore */ }
  }, [stopId])

  useEffect(() => {
    // Fetch stop info
    fetch('/api/stops?limit=500')
      .then(r => r.json())
      .then(data => {
        const found = (data.stops || []).find((s: StopInfo) => s.id === stopId)
        if (found) setStop(found)
      })
      .catch(() => {})

    // Fetch arrivals
    fetchArrivals().finally(() => setLoading(false))

    // Auto-refresh every 15s
    const interval = setInterval(fetchArrivals, 15000)
    return () => clearInterval(interval)
  }, [stopId, fetchArrivals])

  return (
    <div className="px-4 pt-3 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/stops" className="text-[var(--text-muted)] text-sm">←</Link>
        <span className="w-9 h-9 rounded-full bg-[var(--accent)] bg-opacity-10 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {stop?.name || t('stop_detail')}
          </div>
        </div>
        <button
          onClick={() => toggleFav(stopId)}
          className="text-lg p-1"
        >
          {isFavorite(stopId) ? '★' : '☆'}
        </button>
      </div>

      {/* Departures */}
      <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">{t('departures')}</h2>

      {loading ? (
        <div className="text-center py-8 text-[var(--text-muted)]">{t('loading')}</div>
      ) : arrivals.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">{t('no_arrivals')}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {arrivals.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]"
            >
              <span
                className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                style={{ background: a.routeColor || '#666' }}
              >
                {a.routeNumber}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {a.routeName}
                </div>
                {a.deviceName && (
                  <div className="text-xs text-[var(--text-muted)]">{a.deviceName}</div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${
                  a.minutesAway <= 2 ? 'text-[var(--success)]' :
                  a.minutesAway <= 5 ? 'text-[var(--warning)]' :
                  'text-[var(--text-primary)]'
                }`}>
                  {a.minutesAway} {t('minutes_short')}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {a.isLive ? t('live') : t('scheduled')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
