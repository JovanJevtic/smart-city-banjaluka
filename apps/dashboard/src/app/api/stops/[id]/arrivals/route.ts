import { NextRequest, NextResponse } from 'next/server'
import { db, etaPredictions, routes, devices, eq, and, gte } from '@smart-city/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stopId } = await params
    const now = new Date()

    const predictions = await db.select({
      id: etaPredictions.id,
      deviceId: etaPredictions.deviceId,
      routeId: etaPredictions.routeId,
      direction: etaPredictions.direction,
      predictedArrival: etaPredictions.predictedArrival,
      delaySeconds: etaPredictions.delaySeconds,
      distanceRemaining: etaPredictions.distanceRemaining,
      confidence: etaPredictions.confidence,
    })
      .from(etaPredictions)
      .where(and(
        eq(etaPredictions.stopId, stopId),
        gte(etaPredictions.predictedArrival, now),
      ))
      .orderBy(etaPredictions.predictedArrival)
      .limit(20)

    // Enrich with route and device info
    const enriched = await Promise.all(
      predictions.map(async (pred) => {
        const [route] = await db.select({ number: routes.number, name: routes.name, color: routes.color })
          .from(routes).where(eq(routes.id, pred.routeId)).limit(1)
        const [device] = await db.select({ imei: devices.imei, name: devices.name })
          .from(devices).where(eq(devices.id, pred.deviceId)).limit(1)
        return { ...pred, route: route || null, device: device || null }
      })
    )

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Failed to fetch stop arrivals:', error)
    return NextResponse.json({ error: 'Failed to fetch stop arrivals' }, { status: 500 })
  }
}
