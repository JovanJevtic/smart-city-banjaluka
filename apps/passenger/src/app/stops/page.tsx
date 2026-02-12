'use client'

import dynamic from 'next/dynamic'
import AppShell from '@/components/layout/AppShell'

const StopSearch = dynamic(() => import('@/components/stops/StopSearch'), { ssr: false })

export default function StopsPage() {
  return (
    <AppShell>
      <StopSearch />
    </AppShell>
  )
}
