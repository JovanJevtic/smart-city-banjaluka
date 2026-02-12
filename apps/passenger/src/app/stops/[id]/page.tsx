'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import AppShell from '@/components/layout/AppShell'

const ArrivalBoard = dynamic(() => import('@/components/stops/ArrivalBoard'), { ssr: false })

export default function StopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <AppShell>
      <ArrivalBoard stopId={id} />
    </AppShell>
  )
}
