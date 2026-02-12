'use client'

import dynamic from 'next/dynamic'

const VehicleList = dynamic(() => import('@/components/analytics/VehicleList'), {
  ssr: false,
  loading: () => <div style={{ padding: '40px', color: '#666' }}>Loading vehicles...</div>,
})

export default function VehiclesPage() {
  return <VehicleList />
}
