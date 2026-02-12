import { Redis } from 'ioredis'
import type { RouteMatch } from './route-matcher.js'
import type { RouteProgress } from './progress-calculator.js'
import { createLogger } from '../logger.js'

const logger = createLogger('adherence-checker')

let redis: Redis | null = null

export function setAdherenceRedis(r: Redis) {
  redis = r
}

export type AdherenceStatus = 'ON_TIME' | 'SLIGHTLY_LATE' | 'LATE' | 'VERY_LATE' | 'EARLY'

export interface AdherenceResult {
  deviceId: string
  routeId: string
  direction: string
  status: AdherenceStatus
  delaySeconds: number // + = late, - = early
  distanceFromRoute: number
  isRouteDeviation: boolean
}

// Track device off-route duration for deviation detection
const offRouteDurations = new Map<string, { startedAt: number; lastChecked: number }>()
// Track device stationarity for breakdown detection
const stationaryTracker = new Map<string, { lat: number; lng: number; since: number }>()

const ROUTE_DEVIATION_THRESHOLD = 200 // meters
const ROUTE_DEVIATION_DURATION = 60000 // 60 seconds
const STATIONARY_THRESHOLD = 100 // meters
const STATIONARY_DURATION = 600000 // 10 minutes

export async function checkAdherence(
  deviceId: string,
  match: RouteMatch,
  _progress: RouteProgress,
  lat: number,
  lng: number,
): Promise<AdherenceResult> {
  const now = Date.now()

  // Route deviation check
  let isRouteDeviation = false
  if (match.distanceFromRoute > ROUTE_DEVIATION_THRESHOLD) {
    const existing = offRouteDurations.get(deviceId)
    if (existing) {
      if (now - existing.startedAt > ROUTE_DEVIATION_DURATION) {
        isRouteDeviation = true
        logger.warn({ deviceId, distance: match.distanceFromRoute }, 'Route deviation detected')
      }
      existing.lastChecked = now
    } else {
      offRouteDurations.set(deviceId, { startedAt: now, lastChecked: now })
    }
  } else {
    offRouteDurations.delete(deviceId)
  }

  // Stationarity check (possible breakdown)
  const prevPos = stationaryTracker.get(deviceId)
  if (prevPos) {
    const dist = quickDistance(lat, lng, prevPos.lat, prevPos.lng)
    if (dist < STATIONARY_THRESHOLD) {
      if (now - prevPos.since > STATIONARY_DURATION) {
        logger.warn({ deviceId, duration: (now - prevPos.since) / 1000 }, 'Vehicle stationary too long on route')
      }
    } else {
      stationaryTracker.set(deviceId, { lat, lng, since: now })
    }
  } else {
    stationaryTracker.set(deviceId, { lat, lng, since: now })
  }

  // Schedule adherence (delay calculation)
  // Without schedule_entries populated, we can only estimate based on route progress
  // This will be enhanced once schedule data is entered
  const delaySeconds = 0 // Placeholder until schedule data exists
  const status = classifyDelay(delaySeconds)

  const result: AdherenceResult = {
    deviceId,
    routeId: match.routeId,
    direction: match.direction,
    status,
    delaySeconds,
    distanceFromRoute: match.distanceFromRoute,
    isRouteDeviation,
  }

  // Cache in Redis
  if (redis) {
    try {
      const key = `adherence:${deviceId}`
      await redis.setex(key, 120, JSON.stringify(result))
    } catch (err) {
      logger.warn({ err }, 'Failed to cache adherence in Redis')
    }
  }

  return result
}

function classifyDelay(delaySeconds: number): AdherenceStatus {
  if (delaySeconds < -120) return 'EARLY'
  if (delaySeconds <= 120) return 'ON_TIME'
  if (delaySeconds <= 300) return 'SLIGHTLY_LATE'
  if (delaySeconds <= 600) return 'LATE'
  return 'VERY_LATE'
}

/** Fast approximate distance in meters (Euclidean on lat/lng) */
function quickDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111320
  const dLng = (lng2 - lng1) * 79000 // approx at 44.77° latitude
  return Math.sqrt(dLat * dLat + dLng * dLng)
}
