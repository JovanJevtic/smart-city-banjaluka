import { Redis } from 'ioredis'
import { db, eq, and, segmentSpeeds, etaPredictions } from '@smart-city/database'
import type { RouteMatch } from './route-matcher.js'
import type { RouteProgress } from './progress-calculator.js'
import { createLogger } from '../logger.js'

const logger = createLogger('eta-predictor')

let redis: Redis | null = null

export function setEtaRedis(r: Redis) {
  redis = r
}

export interface StopETA {
  stopId: string
  sequence: number
  distanceRemaining: number
  predictedArrival: Date
  scheduledArrival: Date | null
  delaySeconds: number | null
  confidence: number
}

const DEFAULT_SPEED_KMH = 20 // Default city bus speed
const DEFAULT_DWELL_SECONDS = 30

export async function predictETAs(
  deviceId: string,
  match: RouteMatch,
  progress: RouteProgress,
  currentSpeedKmh: number,
): Promise<StopETA[]> {
  if (progress.upcomingStops.length === 0) return []

  // Get historical segment speeds for this route/direction/hour/day
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()
  const dayType = dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : 'weekday'

  const historicalSpeeds = await db.select()
    .from(segmentSpeeds)
    .where(
      and(
        eq(segmentSpeeds.routeId, match.routeId),
        eq(segmentSpeeds.direction, match.direction),
        eq(segmentSpeeds.hourOfDay, hour),
        eq(segmentSpeeds.dayType, dayType),
      )
    )

  const speedMap = new Map<string, { speed: number; dwell: number }>()
  for (const s of historicalSpeeds) {
    speedMap.set(`${s.fromStopSequence}-${s.toStopSequence}`, {
      speed: s.avgSpeedKmh,
      dwell: s.avgDwellTimeSeconds || DEFAULT_DWELL_SECONDS,
    })
  }

  const etas: StopETA[] = []
  let cumulativeTime = 0 // seconds from now

  // Use last stop as starting reference
  const startSequence = match.nearestStopSequence
  let prevSequence = startSequence

  // First segment: from current position to next stop
  if (progress.nextStop) {
    const firstSegmentDistance = progress.nextStop.distanceRemaining
    const estimatedSpeed = getEstimatedSpeed(
      speedMap, prevSequence, progress.nextStop.sequence, currentSpeedKmh
    )
    const travelTime = (firstSegmentDistance / 1000) / estimatedSpeed * 3600 // seconds
    cumulativeTime += travelTime
  }

  for (const stop of progress.upcomingStops) {
    if (stop.sequence === progress.nextStop?.sequence) {
      // First stop - already calculated travel time above
      const eta: StopETA = {
        stopId: stop.stopId,
        sequence: stop.sequence,
        distanceRemaining: stop.distanceRemaining,
        predictedArrival: new Date(now.getTime() + cumulativeTime * 1000),
        scheduledArrival: null, // Will be populated when schedule data exists
        delaySeconds: null,
        confidence: calculateConfidence(stop.distanceRemaining, match.confidence),
      }
      etas.push(eta)

      // Add dwell time at this stop
      const segData = speedMap.get(`${prevSequence}-${stop.sequence}`)
      cumulativeTime += segData?.dwell || DEFAULT_DWELL_SECONDS
      prevSequence = stop.sequence
    } else {
      // Subsequent stops: segment travel time + dwell
      const prevStop = progress.upcomingStops.find(s => s.sequence === prevSequence) || progress.nextStop
      if (prevStop) {
        const segmentDistance = stop.distanceFromStart - prevStop.distanceFromStart
        const estimatedSpeed = getEstimatedSpeed(
          speedMap, prevSequence, stop.sequence, currentSpeedKmh
        )
        const travelTime = Math.max(0, (segmentDistance / 1000) / estimatedSpeed * 3600)
        cumulativeTime += travelTime
      }

      const eta: StopETA = {
        stopId: stop.stopId,
        sequence: stop.sequence,
        distanceRemaining: stop.distanceRemaining,
        predictedArrival: new Date(now.getTime() + cumulativeTime * 1000),
        scheduledArrival: null,
        delaySeconds: null,
        confidence: calculateConfidence(stop.distanceRemaining, match.confidence),
      }
      etas.push(eta)

      // Add dwell time
      const segData = speedMap.get(`${prevSequence}-${stop.sequence}`)
      cumulativeTime += segData?.dwell || DEFAULT_DWELL_SECONDS
      prevSequence = stop.sequence
    }
  }

  // Save predictions to DB (batch upsert, keep only latest per device+stop)
  if (etas.length > 0) {
    try {
      // Delete old predictions for this device
      await db.delete(etaPredictions).where(eq(etaPredictions.deviceId, deviceId))

      // Insert new predictions
      await db.insert(etaPredictions).values(
        etas.map(eta => ({
          deviceId,
          routeId: match.routeId,
          stopId: eta.stopId,
          direction: match.direction,
          predictedArrival: eta.predictedArrival,
          scheduledArrival: eta.scheduledArrival,
          delaySeconds: eta.delaySeconds,
          distanceRemaining: eta.distanceRemaining,
          confidence: eta.confidence,
        }))
      )
    } catch (err) {
      logger.warn({ err, deviceId }, 'Failed to save ETA predictions to DB')
    }
  }

  // Cache in Redis
  if (redis && etas.length > 0) {
    try {
      const key = `eta:${match.routeId}:${match.direction}:${deviceId}`
      await redis.setex(key, 60, JSON.stringify(etas))

      // Also update per-stop ETA sorted sets
      for (const eta of etas) {
        const stopKey = `stop:${eta.stopId}:etas`
        const member = `${deviceId}:${match.routeId}`
        await redis.zadd(stopKey, eta.predictedArrival.getTime(), member)
        await redis.expire(stopKey, 120)
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to cache ETAs in Redis')
    }
  }

  return etas
}

function getEstimatedSpeed(
  speedMap: Map<string, { speed: number; dwell: number }>,
  fromSeq: number,
  toSeq: number,
  currentSpeedKmh: number,
): number {
  const historical = speedMap.get(`${fromSeq}-${toSeq}`)

  if (historical) {
    // Weighted average: 60% historical, 30% current, 10% default
    const effectiveCurrent = currentSpeedKmh > 0 ? currentSpeedKmh : DEFAULT_SPEED_KMH
    return historical.speed * 0.6 + effectiveCurrent * 0.3 + DEFAULT_SPEED_KMH * 0.1
  }

  // No historical data: use current speed or default
  return currentSpeedKmh > 0 ? currentSpeedKmh * 0.7 + DEFAULT_SPEED_KMH * 0.3 : DEFAULT_SPEED_KMH
}

function calculateConfidence(distanceRemaining: number, matchConfidence: number): number {
  // Confidence decreases with distance
  const distanceFactor = Math.max(0.3, 1 - distanceRemaining / 20000) // drops at 20km
  return Math.min(0.99, matchConfidence * distanceFactor)
}
