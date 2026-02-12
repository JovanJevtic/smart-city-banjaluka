'use client'

import { useLocale } from '@/hooks/useLocale'

export default function LanguageSwitcher() {
  const { locale, switchLocale } = useLocale()

  return (
    <button
      onClick={() => switchLocale(locale === 'bs' ? 'en' : 'bs')}
      className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
    >
      {locale === 'bs' ? 'EN' : 'BS'}
    </button>
  )
}
