'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale } from '@/hooks/useLocale'
import type { RouteInfo, StopInfo } from '@/lib/types'

interface SearchResult {
  type: 'route' | 'stop'
  id: string
  label: string
  sublabel: string
  color?: string | null
}

interface SearchBarProps {
  onSelect: (result: SearchResult) => void
}

export default function SearchBar({ onSelect }: SearchBarProps) {
  const { t } = useLocale()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const ctrl = new AbortController()

    Promise.all([
      fetch(`/api/routes?search=${encodeURIComponent(query)}`, { signal: ctrl.signal }).then(r => r.json()).catch(() => []),
      fetch(`/api/stops?search=${encodeURIComponent(query)}&limit=5`, { signal: ctrl.signal }).then(r => r.json()).catch(() => ({ stops: [] })),
    ]).then(([routes, stopsData]) => {
      const routeResults: SearchResult[] = (routes as RouteInfo[]).slice(0, 5).map(r => ({
        type: 'route', id: r.id, label: `Linija ${r.number}`, sublabel: r.name, color: r.color,
      }))
      const stopResults: SearchResult[] = ((stopsData.stops || stopsData) as StopInfo[]).slice(0, 5).map(s => ({
        type: 'stop', id: s.id, label: s.name, sublabel: s.zone || '',
      }))
      setResults([...routeResults, ...stopResults])
    })

    return () => ctrl.abort()
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={t('search_placeholder')}
        className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-50"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden">
          {results.map(r => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => { onSelect(r); setQuery(''); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-[var(--bg-secondary)] flex items-center gap-3 border-b border-[var(--border)] last:border-b-0"
            >
              {r.type === 'route' && (
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold shrink-0"
                  style={{ background: r.color || '#666' }}
                >
                  {r.label.replace('Linija ', '')}
                </span>
              )}
              {r.type === 'stop' && (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z"/></svg>
                </span>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{r.label}</div>
                {r.sublabel && <div className="text-xs text-[var(--text-muted)] truncate">{r.sublabel}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
