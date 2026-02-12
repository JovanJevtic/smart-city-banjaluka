'use client'

import dynamic from 'next/dynamic'
import BottomNav from '@/components/layout/BottomNav'

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), { ssr: false })

export default function MapPage() {
  return (
    <div className="flex flex-col h-[100dvh]">
      <div className="flex-1">
        <LiveMap fullScreen />
      </div>
      <BottomNav />
    </div>
  )
}
