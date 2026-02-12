'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useFavorites } from '@/hooks/useFavorites'
import type { StopInfo } from '@/lib/types'

export default function StopSearch() {
  const { t } = useLocale()
  const geo = useGeolocation()
  const { toggle: toggleFav, isFavorite } = useFavorites('stops')
  const [search, setSearch] = useState('')
  const [allStops, setAllStops] = useState<StopInfo[]>([])
  const [nearbyStops, setNearbyStops] = useState<StopInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stops?limit=500')
      .then(r => r.json())
      .then(data => setAllStops(data.stops || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!geo.latitude || !geo.longitude) return
    fetch(`/api/stops/nearby?lat=${geo.latitude}&lng=${geo.longitude}&radius=500&limit=10`)
      .then(r => r.json())
      .then(setNearbyStops)
      .catch(() => {})
  }, [geo.latitude, geo.longitude])

  const filtered = search
    ? allStops.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : []

  const displayStops = search ? filtered : nearbyStops

  return (
    <div className="px-4 pt-4 pb-4">
      <h1 className="text-lg font-bold mb-3 text-[var(--text-primary)]">{t('stops')}</h1>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t('search_stops')}
        className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-50 mb-3"
      />

      {!search && nearbyStops.length > 0 && (
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">{t('nearby_stops')}</h2>
      )}

      {loading ? (
        <div className="text-center py-8 text-[var(--text-muted)]">{t('loading')}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {displayStops.map(stop => (
            <Link
              key={stop.id}
              href={`/stops/${stop.id}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-[var(--accent)] bg-opacity-10 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{stop.name}</div>
                {stop.distance != null && (
                  <div className="text-xs text-[var(--text-muted)]">{stop.distance} m</div>
                )}
              </div>
              <button
                onClick={e => { e.preventDefault(); toggleFav(stop.id) }}
                className="text-lg shrink-0 p-1"
              >
                {isFavorite(stop.id) ? '★' : '☆'}
              </button>
            </Link>
          ))}
          {displayStops.length === 0 && !loading && (
            <div className="text-center py-8 text-[var(--text-muted)] text-sm">
              {search ? t('no_results') : t('nearby_stops')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
