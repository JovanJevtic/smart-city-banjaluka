'use client'

import dynamic from 'next/dynamic'
import { use } from 'react'

const RouteDetail = dynamic(() => import('@/components/routes/RouteDetail'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontSize: '1.2rem',
      color: '#555',
      background: '#0d0d1a',
    }}>
      Loading route details...
    </div>
  ),
})

export default function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <RouteDetail routeId={id} />
}
