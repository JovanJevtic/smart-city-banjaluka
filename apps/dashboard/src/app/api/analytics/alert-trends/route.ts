import { NextRequest, NextResponse } from 'next/server'
import { db, alerts, sql, gte } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30', 10)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Daily alert counts by severity
    const trends = await db.select({
      date: sql<string>`date(${alerts.createdAt})`,
      severity: alerts.severity,
      count: sql<number>`count(*)::int`,
    })
      .from(alerts)
      .where(gte(alerts.createdAt, since))
      .groupBy(sql`date(${alerts.createdAt})`, alerts.severity)
      .orderBy(sql`date(${alerts.createdAt})`)

    // By type
    const byType = await db.select({
      type: alerts.type,
      count: sql<number>`count(*)::int`,
    }).from(alerts).where(gte(alerts.createdAt, since)).groupBy(alerts.type)
      .orderBy(sql`count(*) desc`)

    // By vehicle (top 10)
    const byVehicle = await db.select({
      deviceId: alerts.deviceId,
      count: sql<number>`count(*)::int`,
    }).from(alerts).where(gte(alerts.createdAt, since)).groupBy(alerts.deviceId)
      .orderBy(sql`count(*) desc`).limit(10)

    return NextResponse.json({ trends, byType, byVehicle })
  } catch (error) {
    console.error('Failed to fetch alert trends:', error)
    return NextResponse.json({ error: 'Failed to fetch alert trends' }, { status: 500 })
  }
}
