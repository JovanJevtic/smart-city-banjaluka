'use client'

import { useState, useCallback } from 'react'

function getStored(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

export function useFavorites(type: 'routes' | 'stops') {
  const key = `fav-${type}`
  const [ids, setIds] = useState<string[]>(() => getStored(key))

  const toggle = useCallback((id: string) => {
    setIds(prev => {
      const next = prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }, [key])

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids])

  return { ids, toggle, isFavorite }
}
