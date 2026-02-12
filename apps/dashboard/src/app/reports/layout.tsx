'use client'

import dynamic from 'next/dynamic'

const AppLayout = dynamic(() => import('@/components/layout/AppLayout'), { ssr: false })

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
