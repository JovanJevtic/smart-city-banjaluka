import { NextRequest, NextResponse } from 'next/server'
import { db, deviceDailyStats, devices, alerts, sql, gte, and } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7', 10)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const sinceDate = since.toISOString().split('T')[0]

    const [stats] = await db.select({
      totalDistance: sql<number>`coalesce(sum(${deviceDailyStats.totalDistance}), 0)::float`,
      totalTrips: sql<number>`coalesce(sum(${deviceDailyStats.tripCount}), 0)::int`,
      totalDrivingTime: sql<number>`coalesce(sum(${deviceDailyStats.drivingTime}), 0)::int`,
      totalIdleTime: sql<number>`coalesce(sum(${deviceDailyStats.idleTime}), 0)::int`,
      avgSpeed: sql<number>`coalesce(avg(${deviceDailyStats.avgSpeed}), 0)::float`,
      maxSpeed: sql<number>`coalesce(max(${deviceDailyStats.maxSpeed}), 0)::int`,
      totalFuel: sql<number>`coalesce(sum(${deviceDailyStats.fuelConsumed}), 0)::float`,
      totalAlerts: sql<number>`coalesce(sum(${deviceDailyStats.alertCount}), 0)::int`,
    }).from(deviceDailyStats).where(gte(deviceDailyStats.date, sinceDate))

    const [deviceCount] = await db.select({
      total: sql<number>`count(*)::int`,
      online: sql<number>`count(*) filter (where ${devices.isOnline} = true)::int`,
    }).from(devices)

    const alertsByType = await db.select({
      type: alerts.type,
      count: sql<number>`count(*)::int`,
    }).from(alerts).where(gte(alerts.createdAt, since)).groupBy(alerts.type)

    const alertsBySeverity = await db.select({
      severity: alerts.severity,
      count: sql<number>`count(*)::int`,
    }).from(alerts).where(gte(alerts.createdAt, since)).groupBy(alerts.severity)

    return NextResponse.json({
      ...stats,
      devices: deviceCount,
      alertsByType,
      alertsBySeverity,
      days,
    })
  } catch (error) {
    console.error('Failed to fetch fleet analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch fleet analytics' }, { status: 500 })
  }
}
