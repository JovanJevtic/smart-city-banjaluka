'use client'

import dynamic from 'next/dynamic'
import AppShell from '@/components/layout/AppShell'

const RouteList = dynamic(() => import('@/components/routes/RouteList'), { ssr: false })

export default function RoutesPage() {
  return (
    <AppShell>
      <RouteList />
    </AppShell>
  )
}
