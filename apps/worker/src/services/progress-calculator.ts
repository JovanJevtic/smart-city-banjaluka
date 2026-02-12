import type { RouteMatch } from './route-matcher.js'
import { getCachedStops, getCachedShapes } from './route-matcher.js'

export interface RouteProgress {
  routeId: string
  direction: 'OUTBOUND' | 'INBOUND'
  distanceAlongRoute: number    // meters
  totalRouteDistance: number    // meters
  progressPercent: number       // 0-100
  lastStop: StopProgress | null
  nextStop: StopProgress | null
  upcomingStops: StopProgress[]
}

export interface StopProgress {
  stopId: string
  sequence: number
  latitude: number
  longitude: number
  distanceFromStart: number
  distanceRemaining: number     // meters from current position to this stop
}

export function calculateProgress(match: RouteMatch): RouteProgress {
  const stops = getCachedStops().filter(
    s => s.routeId === match.routeId && s.direction === match.direction
  )
  const shape = getCachedShapes().find(
    s => s.routeId === match.routeId && s.direction === match.direction
  )

  const totalDistance = shape?.totalDistance || 0
  const progressPercent = totalDistance > 0
    ? Math.min(100, (match.distanceAlongRoute / totalDistance) * 100)
    : 0

  let lastStop: StopProgress | null = null
  let nextStop: StopProgress | null = null
  const upcomingStops: StopProgress[] = []

  for (const stop of stops) {
    const distanceRemaining = Math.max(0, stop.distanceFromStart - match.distanceAlongRoute)

    const progress: StopProgress = {
      stopId: stop.stopId,
      sequence: stop.sequence,
      latitude: stop.latitude,
      longitude: stop.longitude,
      distanceFromStart: stop.distanceFromStart,
      distanceRemaining,
    }

    if (stop.distanceFromStart <= match.distanceAlongRoute) {
      lastStop = progress
    } else {
      if (!nextStop) nextStop = progress
      upcomingStops.push(progress)
    }
  }

  return {
    routeId: match.routeId,
    direction: match.direction,
    distanceAlongRoute: match.distanceAlongRoute,
    totalRouteDistance: totalDistance,
    progressPercent,
    lastStop,
    nextStop,
    upcomingStops,
  }
}
