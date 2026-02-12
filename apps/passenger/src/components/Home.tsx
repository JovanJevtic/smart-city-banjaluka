'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SearchBar from '@/components/ui/SearchBar'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { useLocale } from '@/hooks/useLocale'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useFavorites } from '@/hooks/useFavorites'
import type { StopInfo, StopArrival, RouteInfo } from '@/lib/types'

export default function Home() {
  const { t } = useLocale()
  const router = useRouter()
  const geo = useGeolocation()
  const { ids: favRouteIds } = useFavorites('routes')
  const { ids: favStopIds } = useFavorites('stops')
  const [nearbyStops, setNearbyStops] = useState<(StopInfo & { arrivals: StopArrival[] })[]>([])
  const [favRoutes, setFavRoutes] = useState<RouteInfo[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch nearby stops with arrivals
  useEffect(() => {
    if (!geo.latitude || !geo.longitude) { setLoading(false); return }

    fetch(`/api/stops/nearby?lat=${geo.latitude}&lng=${geo.longitude}&radius=500&limit=5`)
      .then(r => r.json())
      .then(async (stops: StopInfo[]) => {
        const withArrivals = await Promise.all(
          stops.map(async (stop) => {
            try {
              const res = await fetch(`/api/stops/${stop.id}/arrivals`)
              const arrivals = res.ok ? await res.json() : []
              return { ...stop, arrivals: arrivals.slice(0, 3) }
            } catch {
              return { ...stop, arrivals: [] }
            }
          })
        )
        setNearbyStops(withArrivals)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [geo.latitude, geo.longitude])

  // Fetch favorite routes
  useEffect(() => {
    if (favRouteIds.length === 0) return
    fetch('/api/routes')
      .then(r => r.json())
      .then((routes: RouteInfo[]) => {
        setFavRoutes(routes.filter(r => favRouteIds.includes(r.id)))
      })
      .catch(() => {})
  }, [favRouteIds])

  const handleSearchSelect = (result: { type: string; id: string }) => {
    if (result.type === 'route') router.push(`/routes/${result.id}`)
    else router.push(`/stops/${result.id}`)
  }

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">{t('app_name')}</h1>
        <LanguageSwitcher />
      </div>

      {/* Search */}
      <div className="mb-5">
        <SearchBar onSelect={handleSearchSelect} />
      </div>

      {/* Nearby Stops */}
      {(nearbyStops.length > 0 || loading) && (
        <section className="mb-5">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">{t('nearby_stops')}</h2>
          {loading ? (
            <div className="text-center py-4 text-[var(--text-muted)] text-sm">{t('loading')}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {nearbyStops.map(stop => (
                <Link
                  key={stop.id}
                  href={`/stops/${stop.id}`}
                  className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                      <circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">{stop.name}</span>
                    {stop.distance != null && (
                      <span className="text-xs text-[var(--text-muted)] ml-auto shrink-0">{stop.distance}m</span>
                    )}
                  </div>
                  {stop.arrivals.length > 0 && (
                    <div className="flex flex-col gap-0.5 pl-5">
                      {stop.arrivals.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span
                            className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                            style={{ background: a.routeColor || '#666' }}
                          >
                            {a.routeNumber}
                          </span>
                          <span className="text-[var(--text-secondary)] truncate">{a.routeName}</span>
                          <span className={`ml-auto font-semibold shrink-0 ${
                            a.minutesAway <= 2 ? 'text-[var(--success)]' :
                            a.minutesAway <= 5 ? 'text-[var(--warning)]' :
                            'text-[var(--text-primary)]'
                          }`}>
                            {a.minutesAway} {t('minutes_short')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* See Full Map */}
      <section className="mb-5">
        <Link
          href="/map"
          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          {t('see_full_map')}
        </Link>
      </section>

      {/* Favorite Routes */}
      {favRoutes.length > 0 && (
        <section className="mb-5">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">{t('favorite_routes')}</h2>
          <div className="flex flex-wrap gap-2">
            {favRoutes.map(r => (
              <Link
                key={r.id}
                href={`/routes/${r.id}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
              >
                <span
                  className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center"
                  style={{ background: r.color || '#666' }}
                >
                  {r.number}
                </span>
                <span className="text-xs text-[var(--text-primary)] font-medium">{r.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All Routes link */}
      <section>
        <Link
          href="/routes"
          className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
        >
          <span className="text-sm font-medium text-[var(--text-primary)]">{t('all_routes')}</span>
          <span className="text-[var(--text-muted)]">→</span>
        </Link>
      </section>
    </div>
  )
}
