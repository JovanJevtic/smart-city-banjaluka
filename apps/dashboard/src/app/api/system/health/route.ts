import { NextResponse } from 'next/server'
import { db, devices, telemetryRecords, alerts, sql } from '@smart-city/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, unknown> = {}

  // Database check + stats
  try {
    const [deviceStats] = await db
      .select({
        total: sql<number>`count(*)`,
        online: sql<number>`count(*) filter (where ${devices.isOnline} = true)`,
      })
      .from(devices)

    const [telemetryStats] = await db
      .select({
        total: sql<number>`count(*)`,
        lastReceived: sql<string>`max(${telemetryRecords.timestamp})`,
      })
      .from(telemetryRecords)

    const [alertStats] = await db
      .select({
        total: sql<number>`count(*)`,
        unacknowledged: sql<number>`count(*) filter (where ${alerts.acknowledged} = false)`,
      })
      .from(alerts)

    checks.database = {
      status: 'ok',
      devices: { total: Number(deviceStats.total), online: Number(deviceStats.online) },
      telemetry: { total: Number(telemetryStats.total), lastReceived: telemetryStats.lastReceived },
      alerts: { total: Number(alertStats.total), unacknowledged: Number(alertStats.unacknowledged) },
    }
  } catch (e) {
    checks.database = { status: 'error', message: String(e) }
  }

  // API server health (try to reach the API's health endpoint)
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const res = await fetch(`${apiUrl}/api/system/health`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      checks.api = await res.json()
    } else {
      checks.api = { status: 'error', statusCode: res.status }
    }
  } catch {
    checks.api = { status: 'unreachable' }
  }

  const dbOk = (checks.database as Record<string, unknown>)?.status === 'ok'

  return NextResponse.json({
    status: dbOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    dashboard: {
      uptime: process.uptime(),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      nodeVersion: process.version,
    },
    ...checks,
  })
}
