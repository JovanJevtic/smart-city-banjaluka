import { db, eq, and, gte, devices, etaPredictions, routes } from '@smart-city/database'
import type { Redis } from 'ioredis'

export class AdherenceService {
  constructor(private redis: Redis) {}

  /** Active vehicles on a route with positions and ETAs */
  async getRouteVehicles(routeId: string) {
    // Find devices currently matched to this route
    const matchedDevices = await db.select({
      id: devices.id,
      imei: devices.imei,
      name: devices.name,
      isOnline: devices.isOnline,
      lastSeen: devices.lastSeen,
      assignedRouteId: devices.assignedRouteId,
      currentDirection: devices.currentDirection,
      currentStopSequence: devices.currentStopSequence,
      scheduleAdherenceSeconds: devices.scheduleAdherenceSeconds,
      routeMatchConfidence: devices.routeMatchConfidence,
      lastMatchedAt: devices.lastMatchedAt,
    })
      .from(devices)
      .where(and(
        eq(devices.assignedRouteId, routeId),
        eq(devices.isOnline, true),
      ))

    // Get ETAs for each device from Redis cache
    const vehiclesWithEtas = await Promise.all(
      matchedDevices.map(async (device) => {
        let etas: unknown[] = []
        try {
          const key = `eta:${routeId}:${device.currentDirection}:${device.id}`
          const cached = await this.redis.get(key)
          if (cached) etas = JSON.parse(cached)
        } catch { /* ignore */ }

        return { ...device, etas }
      })
    )

    return vehiclesWithEtas
  }

  /** Upcoming arrivals at a stop */
  async getStopArrivals(stopId: string) {
    const now = new Date()

    // Get predictions from DB
    const predictions = await db.select({
      id: etaPredictions.id,
      deviceId: etaPredictions.deviceId,
      routeId: etaPredictions.routeId,
      direction: etaPredictions.direction,
      predictedArrival: etaPredictions.predictedArrival,
      scheduledArrival: etaPredictions.scheduledArrival,
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

    // Enrich with route info
    const enriched = await Promise.all(
      predictions.map(async (pred) => {
        const [route] = await db.select({ number: routes.number, name: routes.name, color: routes.color })
          .from(routes).where(eq(routes.id, pred.routeId)).limit(1)
        const [device] = await db.select({ imei: devices.imei, name: devices.name })
          .from(devices).where(eq(devices.id, pred.deviceId)).limit(1)
        return {
          ...pred,
          route: route || null,
          device: device || null,
        }
      })
    )

    return enriched
  }

  /** Fleet-wide schedule adherence summary */
  async getAdherenceSummary() {
    const onlineDevices = await db.select({
      id: devices.id,
      imei: devices.imei,
      name: devices.name,
      assignedRouteId: devices.assignedRouteId,
      currentDirection: devices.currentDirection,
      scheduleAdherenceSeconds: devices.scheduleAdherenceSeconds,
      routeMatchConfidence: devices.routeMatchConfidence,
    })
      .from(devices)
      .where(eq(devices.isOnline, true))

    const matched = onlineDevices.filter(d => d.assignedRouteId)
    const unmatched = onlineDevices.filter(d => !d.assignedRouteId)

    const onTime = matched.filter(d =>
      d.scheduleAdherenceSeconds === null || Math.abs(d.scheduleAdherenceSeconds) <= 120
    ).length
    const late = matched.filter(d =>
      d.scheduleAdherenceSeconds !== null && d.scheduleAdherenceSeconds > 120
    ).length
    const early = matched.filter(d =>
      d.scheduleAdherenceSeconds !== null && d.scheduleAdherenceSeconds < -120
    ).length

    return {
      totalOnline: onlineDevices.length,
      matchedToRoute: matched.length,
      unmatched: unmatched.length,
      onTime,
      late,
      early,
      vehicles: matched.map(d => ({
        id: d.id,
        imei: d.imei,
        name: d.name,
        routeId: d.assignedRouteId,
        direction: d.currentDirection,
        delaySeconds: d.scheduleAdherenceSeconds,
        confidence: d.routeMatchConfidence,
      })),
    }
  }
}
