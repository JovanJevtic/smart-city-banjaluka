import { NextRequest, NextResponse } from 'next/server'
import { db, deviceDailyStats, devices, eq, sql, gte } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7', 10)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const data = await db.select({
      deviceId: deviceDailyStats.deviceId,
      totalDistance: sql<number>`sum(${deviceDailyStats.totalDistance})::float`,
      totalTrips: sql<number>`sum(${deviceDailyStats.tripCount})::int`,
      avgSpeed: sql<number>`avg(${deviceDailyStats.avgSpeed})::float`,
      maxSpeed: sql<number>`max(${deviceDailyStats.maxSpeed})::int`,
      drivingTime: sql<number>`sum(${deviceDailyStats.drivingTime})::int`,
      alertCount: sql<number>`sum(${deviceDailyStats.alertCount})::int`,
    })
      .from(deviceDailyStats)
      .where(gte(deviceDailyStats.date, since))
      .groupBy(deviceDailyStats.deviceId)
      .orderBy(sql`sum(${deviceDailyStats.totalDistance}) desc`)
      .limit(10)

    // Enrich with device names
    const enriched = await Promise.all(
      data.map(async (row) => {
        const [device] = await db.select({ imei: devices.imei, name: devices.name })
          .from(devices).where(eq(devices.id, row.deviceId)).limit(1)
        return { ...row, device: device || null }
      })
    )

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Failed to fetch top vehicles:', error)
    return NextResponse.json({ error: 'Failed to fetch top vehicles' }, { status: 500 })
  }
}
