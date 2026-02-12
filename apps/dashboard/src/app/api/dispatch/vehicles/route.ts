import { NextResponse } from 'next/server'
import { db, devices, routes, telemetryRecords, eq, desc } from '@smart-city/database'

export async function GET() {
  try {
    const allDevices = await db.select().from(devices)
    const allRoutes = await db.select({ id: routes.id, number: routes.number, color: routes.color, name: routes.name }).from(routes)
    const routeMap = new Map(allRoutes.map(r => [r.id, r]))

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

    const vehicles = await Promise.all(allDevices.map(async (d) => {
      const isOnline = d.isOnline && d.lastSeen && d.lastSeen > fiveMinAgo

      // Get latest position for online devices
      let lat = 0, lng = 0, speed = 0, heading = 0
      if (isOnline) {
        const [latest] = await db
          .select({ latitude: telemetryRecords.latitude, longitude: telemetryRecords.longitude, speed: telemetryRecords.speed, heading: telemetryRecords.heading })
          .from(telemetryRecords)
          .where(eq(telemetryRecords.deviceId, d.id))
          .orderBy(desc(telemetryRecords.timestamp))
          .limit(1)
        if (latest) {
          lat = latest.latitude
          lng = latest.longitude
          speed = latest.speed ?? 0
          heading = latest.heading ?? 0
        }
      }

      const route = d.assignedRouteId ? routeMap.get(d.assignedRouteId) : null
      const adherence = d.scheduleAdherenceSeconds ?? 0
      let status: string
      if (!isOnline) status = 'offline'
      else if (!d.assignedRouteId) status = 'unassigned'
      else if (Math.abs(adherence) <= 120) status = 'on-time'
      else if (adherence <= 300) status = 'slightly-late'
      else if (adherence <= 600) status = 'late'
      else status = 'very-late'

      return {
        deviceId: d.id,
        imei: d.imei,
        name: d.name,
        isOnline,
        latitude: lat,
        longitude: lng,
        speed,
        heading,
        routeId: d.assignedRouteId,
        routeNumber: route?.number || null,
        routeColor: route?.color || null,
        routeName: route?.name || null,
        currentDirection: d.currentDirection,
        adherenceSeconds: adherence,
        status,
        lastSeen: d.lastSeen?.toISOString() || null,
      }
    }))

    return NextResponse.json(vehicles)
  } catch (error) {
    console.error('Failed to fetch dispatch vehicles:', error)
    return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 })
  }
}
