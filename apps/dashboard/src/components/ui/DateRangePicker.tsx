'use client'

import { useState } from 'react'

export interface DateRange {
  from: Date
  to: Date
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState(7)

  const selectPreset = (days: number) => {
    setActivePreset(days)
    const to = new Date()
    const from = days === 0
      ? new Date(to.getFullYear(), to.getMonth(), to.getDate())
      : new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
    onChange({ from, to })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {PRESETS.map(p => (
        <button
          key={p.days}
          onClick={() => selectPreset(p.days)}
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            border: 'none',
            background: activePreset === p.days ? '#e94560' : '#16213e',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={value.from.toISOString().split('T')[0]}
        onChange={(e) => onChange({ from: new Date(e.target.value), to: value.to })}
        style={inputStyle}
      />
      <span style={{ color: '#666', fontSize: '12px' }}>to</span>
      <input
        type="date"
        value={value.to.toISOString().split('T')[0]}
        onChange={(e) => onChange({ from: value.from, to: new Date(e.target.value) })}
        style={inputStyle}
      />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '4px',
  border: '1px solid #333',
  background: '#16213e',
  color: '#fff',
  fontSize: '12px',
}
