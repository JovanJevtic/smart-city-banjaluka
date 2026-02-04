'use client'

import dynamic from 'next/dynamic'

const MapDashboard = dynamic(() => import('@/components/MapDashboard'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontSize: '1.2rem',
      color: '#555',
    }}>
      Loading map...
    </div>
  ),
})

export default function Home() {
  return <MapDashboard />
}
