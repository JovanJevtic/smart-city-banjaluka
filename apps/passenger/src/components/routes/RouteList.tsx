'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { useFavorites } from '@/hooks/useFavorites'
import type { RouteInfo } from '@/lib/types'

export default function RouteList() {
  const { t } = useLocale()
  const { ids: favIds, toggle: toggleFav, isFavorite } = useFavorites('routes')
  const [routes, setRoutes] = useState<RouteInfo[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(setRoutes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? routes.filter(r =>
        r.number.toLowerCase().includes(search.toLowerCase()) ||
        r.name.toLowerCase().includes(search.toLowerCase())
      )
    : routes

  // Show favorites first
  const sorted = [...filtered].sort((a, b) => {
    const aFav = isFavorite(a.id) ? 0 : 1
    const bFav = isFavorite(b.id) ? 0 : 1
    return aFav - bFav
  })

  return (
    <div className="px-4 pt-4 pb-4">
      <h1 className="text-lg font-bold mb-3 text-[var(--text-primary)]">{t('all_routes')}</h1>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t('search_routes')}
        className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-50 mb-3"
      />

      {loading ? (
        <div className="text-center py-8 text-[var(--text-muted)]">{t('loading')}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(route => (
            <Link
              key={route.id}
              href={`/routes/${route.id}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-bold shrink-0"
                style={{ background: route.color || '#666' }}
              >
                {route.number}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {route.name}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                  {route.operator && <span>{route.operator}</span>}
                  {route.intervalMinutes && <span>{route.intervalMinutes} {t('every_min')}</span>}
                  {route.stopCount != null && <span>{route.stopCount} {t('stops').toLowerCase()}</span>}
                </div>
              </div>
              <button
                onClick={e => { e.preventDefault(); toggleFav(route.id) }}
                className="text-lg shrink-0 p-1"
              >
                {isFavorite(route.id) ? '★' : '☆'}
              </button>
            </Link>
          ))}
          {sorted.length === 0 && (
            <div className="text-center py-8 text-[var(--text-muted)]">{t('no_results')}</div>
          )}
        </div>
      )}
    </div>
  )
}
