'use client'

import dynamic from 'next/dynamic'

const FleetAnalytics = dynamic(() => import('@/components/analytics/FleetAnalytics'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', background: '#0d0d1a' }}>
      Loading analytics...
    </div>
  ),
})

export default function AnalyticsPage() {
  return <FleetAnalytics />
}
