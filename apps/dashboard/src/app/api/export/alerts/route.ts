import { NextRequest, NextResponse } from 'next/server'
import { db, alerts, devices, eq, and, gte, lte, desc } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const deviceId = searchParams.get('deviceId')
    const limit = parseInt(searchParams.get('limit') || '10000', 10)

    const conditions = []
    if (from) conditions.push(gte(alerts.createdAt, new Date(from)))
    if (to) conditions.push(lte(alerts.createdAt, new Date(to)))
    if (deviceId) conditions.push(eq(alerts.deviceId, deviceId))

    const records = await db.select({
      createdAt: alerts.createdAt,
      deviceId: alerts.deviceId,
      type: alerts.type,
      severity: alerts.severity,
      message: alerts.message,
      latitude: alerts.latitude,
      longitude: alerts.longitude,
      acknowledged: alerts.acknowledged,
      acknowledgedBy: alerts.acknowledgedBy,
      acknowledgedAt: alerts.acknowledgedAt,
    })
      .from(alerts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alerts.createdAt))
      .limit(limit)

    const header = 'timestamp,device_id,type,severity,message,latitude,longitude,acknowledged,acknowledged_by,acknowledged_at\n'
    const rows = records.map(r => [
      r.createdAt.toISOString(),
      r.deviceId,
      r.type,
      r.severity,
      `"${(r.message || '').replace(/"/g, '""')}"`,
      r.latitude ?? '', r.longitude ?? '',
      r.acknowledged,
      r.acknowledgedBy ?? '',
      r.acknowledgedAt?.toISOString() ?? '',
    ].join(',')).join('\n')

    const csv = header + rows
    const filename = `alerts-${new Date().toISOString().split('T')[0]}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Failed to export alerts:', error)
    return NextResponse.json({ error: 'Failed to export alerts' }, { status: 500 })
  }
}
