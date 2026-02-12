import { NextRequest, NextResponse } from 'next/server'
import { db, devices, routes, telemetryRecords, eq, desc } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const routeId = request.nextUrl.searchParams.get('routeId')

    // Get all online devices
    const allDevices = await db.select().from(devices).where(eq(devices.isOnline, true))

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    let onlineDevices = allDevices.filter(d => d.lastSeen && d.lastSeen > fiveMinAgo)

    if (routeId) {
      onlineDevices = onlineDevices.filter(d => d.assignedRouteId === routeId)
    }

    // Get latest telemetry for each device
    const vehicles = await Promise.all(
      onlineDevices.map(async (d) => {
        const [latest] = await db
          .select({
            latitude: telemetryRecords.latitude,
            longitude: telemetryRecords.longitude,
            speed: telemetryRecords.speed,
            heading: telemetryRecords.heading,
          })
          .from(telemetryRecords)
          .where(eq(telemetryRecords.deviceId, d.id))
          .orderBy(desc(telemetryRecords.timestamp))
          .limit(1)

        const route = d.assignedRouteId
          ? (await db.select({ number: routes.number, color: routes.color }).from(routes).where(eq(routes.id, d.assignedRouteId)).limit(1))[0]
          : null

        return {
          deviceId: d.id,
          imei: d.imei,
          name: d.name,
          latitude: latest?.latitude ?? 0,
          longitude: latest?.longitude ?? 0,
          speed: latest?.speed ?? 0,
          heading: latest?.heading ?? 0,
          routeId: d.assignedRouteId,
          routeNumber: route?.number || null,
          routeColor: route?.color || null,
          currentDirection: d.currentDirection,
          updatedAt: d.lastSeen?.toISOString() || '',
        }
      })
    )

    return NextResponse.json(vehicles.filter(v => v.latitude !== 0 || v.longitude !== 0))
  } catch (error) {
    console.error('Failed to fetch live vehicles:', error)
    return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 })
  }
}
