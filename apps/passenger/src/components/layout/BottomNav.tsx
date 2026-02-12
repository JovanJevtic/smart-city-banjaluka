'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/hooks/useLocale'

const tabs = [
  { key: 'home' as const, href: '/', icon: HomeIcon },
  { key: 'map' as const, href: '/map', icon: MapIcon },
  { key: 'routes' as const, href: '/routes', icon: BusIcon },
  { key: 'stops' as const, href: '/stops', icon: StopIcon },
] as const

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useLocale()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border)] z-50">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {tabs.map(tab => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 py-1 px-3"
            >
              <tab.icon active={active} />
              <span className={`text-[10px] ${active ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                {t(tab.key)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function MapIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

function BusIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6v6" /><path d="M16 6v6" />
      <rect x="4" y="2" width="16" height="16" rx="3" />
      <path d="M4 12h16" />
      <path d="M8 18v2" /><path d="M16 18v2" />
      <circle cx="7.5" cy="15" r="0.5" fill={active ? 'var(--accent)' : 'var(--text-muted)'} />
      <circle cx="16.5" cy="15" r="0.5" fill={active ? 'var(--accent)' : 'var(--text-muted)'} />
    </svg>
  )
}

function StopIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z" />
    </svg>
  )
}
