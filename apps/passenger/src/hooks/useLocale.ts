'use client'

import { useState, useCallback } from 'react'
import { type Locale, type TranslationKey, getLocale, setLocale, t as translate } from '@/lib/i18n'

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(getLocale)

  const switchLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale)
    setLocaleState(newLocale)
  }, [])

  const t = useCallback((key: TranslationKey) => {
    return translate(key, locale)
  }, [locale])

  return { locale, switchLocale, t }
}
