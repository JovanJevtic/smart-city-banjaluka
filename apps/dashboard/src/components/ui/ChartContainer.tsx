'use client'

interface ChartContainerProps {
  title: string
  loading?: boolean
  children: React.ReactNode
  height?: number
}

export default function ChartContainer({ title, loading, children, height = 300 }: ChartContainerProps) {
  return (
    <div style={{
      background: '#111128',
      borderRadius: '8px',
      border: '1px solid #1e1e3a',
      padding: '16px',
    }}>
      <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px', fontWeight: 600 }}>
        {title}
      </h3>
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
          Loading...
        </div>
      ) : (
        <div style={{ height }}>
          {children}
        </div>
      )}
    </div>
  )
}
