import { NextRequest, NextResponse } from 'next/server'
import { db, deviceDailyStats, devices, alerts, eq, and, gte, sql, desc } from '@smart-city/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30', 10)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const sinceDate = since.toISOString().split('T')[0]

    // Device info
    const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Daily stats
    const dailyStats = await db.select()
      .from(deviceDailyStats)
      .where(and(
        eq(deviceDailyStats.deviceId, deviceId),
        gte(deviceDailyStats.date, sinceDate),
      ))
      .orderBy(deviceDailyStats.date)

    // Summary
    const [summary] = await db.select({
      totalDistance: sql<number>`coalesce(sum(${deviceDailyStats.totalDistance}), 0)::float`,
      totalTrips: sql<number>`coalesce(sum(${deviceDailyStats.tripCount}), 0)::int`,
      totalDrivingTime: sql<number>`coalesce(sum(${deviceDailyStats.drivingTime}), 0)::int`,
      totalIdleTime: sql<number>`coalesce(sum(${deviceDailyStats.idleTime}), 0)::int`,
      avgSpeed: sql<number>`coalesce(avg(${deviceDailyStats.avgSpeed}), 0)::float`,
      maxSpeed: sql<number>`coalesce(max(${deviceDailyStats.maxSpeed}), 0)::int`,
      totalAlerts: sql<number>`coalesce(sum(${deviceDailyStats.alertCount}), 0)::int`,
      totalFuel: sql<number>`coalesce(sum(${deviceDailyStats.fuelConsumed}), 0)::float`,
    }).from(deviceDailyStats).where(and(
      eq(deviceDailyStats.deviceId, deviceId),
      gte(deviceDailyStats.date, sinceDate),
    ))

    // Recent alerts
    const recentAlerts = await db.select()
      .from(alerts)
      .where(and(
        eq(alerts.deviceId, deviceId),
        gte(alerts.createdAt, since),
      ))
      .orderBy(desc(alerts.createdAt))
      .limit(50)

    return NextResponse.json({
      device,
      summary,
      dailyStats,
      recentAlerts,
      days,
    })
  } catch (error) {
    console.error('Failed to fetch vehicle analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch vehicle analytics' }, { status: 500 })
  }
}
