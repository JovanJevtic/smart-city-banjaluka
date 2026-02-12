'use client'

import dynamic from 'next/dynamic'

const AlertAnalytics = dynamic(() => import('@/components/analytics/AlertAnalytics'), {
  ssr: false,
  loading: () => <div style={{ padding: '40px', color: '#666' }}>Loading alert analytics...</div>,
})

export default function AlertsPage() {
  return <AlertAnalytics />
}
