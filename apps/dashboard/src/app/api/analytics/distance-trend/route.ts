import { NextRequest, NextResponse } from 'next/server'
import { db, deviceDailyStats, sql, gte } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30', 10)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const data = await db.select({
      date: deviceDailyStats.date,
      totalDistance: sql<number>`sum(${deviceDailyStats.totalDistance})::float`,
      totalTrips: sql<number>`sum(${deviceDailyStats.tripCount})::int`,
      activeVehicles: sql<number>`count(distinct ${deviceDailyStats.deviceId})::int`,
    })
      .from(deviceDailyStats)
      .where(gte(deviceDailyStats.date, since))
      .groupBy(deviceDailyStats.date)
      .orderBy(deviceDailyStats.date)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch distance trend:', error)
    return NextResponse.json({ error: 'Failed to fetch distance trend' }, { status: 500 })
  }
}
