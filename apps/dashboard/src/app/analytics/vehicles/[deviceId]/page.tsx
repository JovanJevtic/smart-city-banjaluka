'use client'

import dynamic from 'next/dynamic'
import { use } from 'react'

const VehicleDetail = dynamic(() => import('@/components/analytics/VehicleDetail'), {
  ssr: false,
  loading: () => <div style={{ padding: '40px', color: '#666' }}>Loading vehicle details...</div>,
})

export default function VehicleDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = use(params)
  return <VehicleDetail deviceId={deviceId} />
}
