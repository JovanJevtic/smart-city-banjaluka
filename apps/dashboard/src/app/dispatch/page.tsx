'use client'

import dynamic from 'next/dynamic'

const DispatchCenter = dynamic(() => import('@/components/dispatch/DispatchCenter'), { ssr: false })

export default function DispatchPage() {
  return <DispatchCenter />
}
