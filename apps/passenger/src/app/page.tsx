'use client'

import dynamic from 'next/dynamic'
import AppShell from '@/components/layout/AppShell'

const HomePage = dynamic(() => import('@/components/Home'), { ssr: false })

export default function Page() {
  return (
    <AppShell>
      <HomePage />
    </AppShell>
  )
}
