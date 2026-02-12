'use client'

import dynamic from 'next/dynamic'

const RouteAnalytics = dynamic(() => import('@/components/analytics/RouteAnalytics'), {
  ssr: false,
  loading: () => <div style={{ padding: '40px', color: '#666' }}>Loading route analytics...</div>,
})

export default function RouteAnalyticsPage() {
  return <RouteAnalytics />
}
