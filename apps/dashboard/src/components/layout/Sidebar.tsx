'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  children?: { label: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Routes', href: '/routes' },
  {
    label: 'Analytics',
    href: '/analytics',
    children: [
      { label: 'Fleet', href: '/analytics' },
      { label: 'Vehicles', href: '/analytics/vehicles' },
      { label: 'Routes', href: '/analytics/routes' },
      { label: 'Alerts', href: '/analytics/alerts' },
    ],
  },
  { label: 'Reports', href: '/reports' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div style={{
      width: collapsed ? '60px' : '220px',
      minWidth: collapsed ? '60px' : '220px',
      height: '100vh',
      background: '#0d0d1a',
      borderRight: '1px solid #1e1e3a',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s, min-width 0.2s',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '16px 12px' : '16px 20px',
        borderBottom: '1px solid #1e1e3a',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ fontSize: '20px' }}>🚌</span>
        {!collapsed && <strong style={{ fontSize: '14px', color: '#fff', whiteSpace: 'nowrap' }}>Smart City</strong>}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => (
          <div key={item.href}>
            <Link
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '10px 14px' : '8px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '13px',
                color: isActive(item.href) ? '#fff' : '#888',
                background: isActive(item.href) && !item.children ? '#1a1a3e' : 'transparent',
                marginBottom: '2px',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </Link>
            {/* Children */}
            {!collapsed && item.children && isActive(item.href) && (
              <div style={{ paddingLeft: '20px' }}>
                {item.children.map(child => (
                  <Link
                    key={child.href}
                    href={child.href}
                    style={{
                      display: 'block',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      fontSize: '12px',
                      color: pathname === child.href ? '#fff' : '#666',
                      background: pathname === child.href ? '#1a1a3e' : 'transparent',
                      marginBottom: '1px',
                    }}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        style={{
          padding: '12px',
          border: 'none',
          borderTop: '1px solid #1e1e3a',
          background: 'transparent',
          color: '#666',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        {collapsed ? '>>' : '<<'}
      </button>
    </div>
  )
}
