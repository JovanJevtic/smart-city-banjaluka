'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import AppShell from '@/components/layout/AppShell'

const RouteDetail = dynamic(() => import('@/components/routes/RouteDetail'), { ssr: false })

export default function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <AppShell>
      <RouteDetail routeId={id} />
    </AppShell>
  )
}
