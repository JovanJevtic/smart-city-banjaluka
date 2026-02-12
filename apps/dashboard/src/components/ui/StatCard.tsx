'use client'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  color?: string
}

export default function StatCard({ label, value, subtext, color }: StatCardProps) {
  return (
    <div style={{
      background: '#111128',
      borderRadius: '8px',
      border: '1px solid #1e1e3a',
      padding: '16px',
    }}>
      <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: color || '#fff' }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
          {subtext}
        </div>
      )}
    </div>
  )
}
