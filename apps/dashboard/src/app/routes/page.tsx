'use client'

import dynamic from 'next/dynamic'

const RouteList = dynamic(() => import('@/components/routes/RouteList'), {
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
      Loading routes...
    </div>
  ),
})

export default function RoutesPage() {
  return <RouteList />
}
