import { NextRequest, NextResponse } from 'next/server'
import { db, etaPredictions, routes, devices, eq, gte } from '@smart-city/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stopId } = await params

    const now = new Date()
    const predictions = await db
      .select({
        routeId: etaPredictions.routeId,
        deviceId: etaPredictions.deviceId,
        predictedArrival: etaPredictions.predictedArrival,
        confidence: etaPredictions.confidence,
      })
      .from(etaPredictions)
      .where(
        eq(etaPredictions.stopId, stopId),
      )
      .orderBy(etaPredictions.predictedArrival)
      .limit(20)

    // Filter to future arrivals only
    const futureArrivals = predictions.filter(p => p.predictedArrival > now)

    // Enrich with route and device info
    const routeIds = [...new Set(futureArrivals.map(p => p.routeId))]
    const deviceIds = [...new Set(futureArrivals.map(p => p.deviceId))]

    const routeList = routeIds.length > 0
      ? await db.select({ id: routes.id, number: routes.number, name: routes.name, color: routes.color }).from(routes)
      : []
    const deviceList = deviceIds.length > 0
      ? await db.select({ id: devices.id, name: devices.name }).from(devices)
      : []

    const routeMap = new Map(routeList.map(r => [r.id, r]))
    const deviceMap = new Map(deviceList.map(d => [d.id, d]))

    const arrivals = futureArrivals.map(p => {
      const route = routeMap.get(p.routeId)
      const device = deviceMap.get(p.deviceId)
      const minutesAway = Math.max(0, Math.round((p.predictedArrival.getTime() - now.getTime()) / 60000))

      return {
        routeId: p.routeId,
        routeNumber: route?.number || '?',
        routeColor: route?.color || null,
        routeName: route?.name || '',
        deviceName: device?.name || null,
        predictedArrival: p.predictedArrival.toISOString(),
        confidence: p.confidence,
        minutesAway,
        isLive: true,
      }
    })

    return NextResponse.json(arrivals)
  } catch (error) {
    console.error('Failed to fetch arrivals:', error)
    return NextResponse.json({ error: 'Failed to fetch arrivals' }, { status: 500 })
  }
}
