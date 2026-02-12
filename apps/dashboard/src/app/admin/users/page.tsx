'use client'

import { useState } from 'react'

export default function AdminUsersPage() {
  const [message] = useState('User management connects to the Fastify API auth system. Configure users via the API endpoints at /api/auth/register.')

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>User Management</h1>

      <div style={{
        background: '#111128', borderRadius: '8px', border: '1px solid #1e1e3a',
        padding: '24px', maxWidth: '600px',
      }}>
        <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
        <p style={{ color: '#666', fontSize: '13px', marginTop: '12px' }}>
          Available roles: ADMIN, DISPATCHER, ANALYST, VIEWER
        </p>
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ padding: '12px', background: '#16213e', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#ccc' }}>
            POST /api/auth/register — Create new user
          </div>
          <div style={{ padding: '12px', background: '#16213e', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#ccc' }}>
            POST /api/auth/login — Authenticate user
          </div>
        </div>
      </div>
    </div>
  )
}
