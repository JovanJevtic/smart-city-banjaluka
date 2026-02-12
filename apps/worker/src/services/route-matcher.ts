import { db, eq, routes, routeShapes, routeStops, stops, routeAssignments } from '@smart-city/database'
import { createLogger } from '../logger.js'

const logger = createLogger('route-matcher')

export interface RouteMatch {
  routeId: string
  direction: 'OUTBOUND' | 'INBOUND'
  confidence: number           // 0.0 - 1.0
  distanceFromRoute: number    // meters
  distanceAlongRoute: number   // meters from start
  nearestStopSequence: number  // last passed stop
  nextStopSequence: number
  routeNumber: string
}

interface CachedRoute {
  id: string
  number: string
  color: string | null
}

interface CachedShape {
  routeId: string
  direction: 'OUTBOUND' | 'INBOUND'
  points: [number, number][] // [lat, lng] for calculation
  totalDistance: number       // meters
}

interface CachedStop {
  routeId: string
  direction: 'OUTBOUND' | 'INBOUND'
  stopId: string
  sequence: number
  latitude: number
  longitude: number
  distanceFromStart: number
}

// Last known match per device for continuity
const deviceLastMatch = new Map<string, { routeId: string; direction: string; timestamp: number }>()

// Cache
let cachedRoutes: CachedRoute[] = []
let cachedShapes: CachedShape[] = []
let cachedStops: CachedStop[] = []
let cacheLoadedAt = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function loadRouteCache(): Promise<void> {
  const now = Date.now()
  if (now - cacheLoadedAt < CACHE_TTL && cachedShapes.length > 0) return

  logger.info('Loading route geometry cache...')

  const allRoutes = await db.select({
    id: routes.id,
    number: routes.number,
    color: routes.color,
  }).from(routes).where(eq(routes.isActive, true))

  cachedRoutes = allRoutes

  const allShapes = await db.select().from(routeShapes)
  cachedShapes = allShapes.map(shape => {
    const geometry = shape.geometry as [number, number][] // [lng, lat]
    const points: [number, number][] = geometry.map(([lng, lat]) => [lat, lng])
    return {
      routeId: shape.routeId,
      direction: shape.direction as 'OUTBOUND' | 'INBOUND',
      points,
      totalDistance: shape.distanceMeters || calculatePolylineDistance(points),
    }
  })

  const allRouteStops = await db.select({
    routeId: routeStops.routeId,
    direction: routeStops.direction,
    stopId: routeStops.stopId,
    sequence: routeStops.sequence,
    distanceFromStart: routeStops.distanceFromStart,
    latitude: stops.latitude,
    longitude: stops.longitude,
  })
    .from(routeStops)
    .innerJoin(stops, eq(routeStops.stopId, stops.id))
    .orderBy(routeStops.routeId, routeStops.sequence)

  cachedStops = allRouteStops.map(rs => ({
    routeId: rs.routeId,
    direction: rs.direction as 'OUTBOUND' | 'INBOUND',
    stopId: rs.stopId,
    sequence: rs.sequence,
    latitude: rs.latitude,
    longitude: rs.longitude,
    distanceFromStart: rs.distanceFromStart || 0,
  }))

  cacheLoadedAt = now
  logger.info({ routes: allRoutes.length, shapes: allShapes.length, stops: allRouteStops.length }, 'Route cache loaded')
}

export async function matchGpsToRoute(
  lat: number,
  lng: number,
  heading: number,
  deviceId: string,
): Promise<RouteMatch | null> {
  await loadRouteCache()

  if (cachedShapes.length === 0) return null

  const candidates: {
    shape: CachedShape
    distance: number
    projectionIndex: number
    projectionFraction: number
    distanceAlong: number
  }[] = []

  // Step 1: Find all routes within 100m
  for (const shape of cachedShapes) {
    const result = pointToPolylineDistance(lat, lng, shape.points)
    if (result.distance <= 100) {
      candidates.push({
        shape,
        distance: result.distance,
        projectionIndex: result.segmentIndex,
        projectionFraction: result.fraction,
        distanceAlong: calculateDistanceAlong(shape.points, result.segmentIndex, result.fraction),
      })
    }
  }

  if (candidates.length === 0) return null

  // Step 2: Score each candidate
  let bestScore = -1
  let bestCandidate: typeof candidates[0] | null = null

  // Get device assignment for priority boost
  const assignments = await getDeviceAssignment(deviceId)
  const lastMatch = deviceLastMatch.get(deviceId)

  for (const candidate of candidates) {
    let score = 0

    // Proximity score (closer = higher)
    const proxScore = Math.max(0, 1 - candidate.distance / 100)
    score += proxScore * 40

    // Heading match score
    const segBearing = segmentBearing(
      candidate.shape.points[candidate.projectionIndex],
      candidate.shape.points[Math.min(candidate.projectionIndex + 1, candidate.shape.points.length - 1)]
    )
    const headingDiff = angleDiff(heading, segBearing)
    if (headingDiff < 45) {
      score += (1 - headingDiff / 45) * 25
    }

    // Assignment bonus
    if (assignments.has(candidate.shape.routeId)) {
      score += 15
    }

    // Historical continuity bonus (prevent route flickering)
    if (lastMatch && lastMatch.routeId === candidate.shape.routeId &&
        lastMatch.direction === candidate.shape.direction &&
        Date.now() - lastMatch.timestamp < 120000) {
      score += 20
    }

    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  if (!bestCandidate) return null

  // Calculate confidence
  let confidence: number
  if (bestCandidate.distance < 20) confidence = 0.95
  else if (bestCandidate.distance < 50) confidence = 0.80
  else confidence = 0.50

  // Find last and next stop
  const routeStopsList = cachedStops.filter(
    s => s.routeId === bestCandidate!.shape.routeId && s.direction === bestCandidate!.shape.direction
  )

  let nearestStopSequence = 0
  let nextStopSequence = 1

  for (let i = routeStopsList.length - 1; i >= 0; i--) {
    if (routeStopsList[i].distanceFromStart <= bestCandidate.distanceAlong) {
      nearestStopSequence = routeStopsList[i].sequence
      nextStopSequence = i + 1 < routeStopsList.length ? routeStopsList[i + 1].sequence : routeStopsList[i].sequence
      break
    }
  }

  const routeInfo = cachedRoutes.find(r => r.id === bestCandidate!.shape.routeId)

  // Update last match for continuity
  deviceLastMatch.set(deviceId, {
    routeId: bestCandidate.shape.routeId,
    direction: bestCandidate.shape.direction,
    timestamp: Date.now(),
  })

  return {
    routeId: bestCandidate.shape.routeId,
    direction: bestCandidate.shape.direction,
    confidence,
    distanceFromRoute: bestCandidate.distance,
    distanceAlongRoute: bestCandidate.distanceAlong,
    nearestStopSequence,
    nextStopSequence,
    routeNumber: routeInfo?.number || '',
  }
}

// Get device's active route assignments
async function getDeviceAssignment(deviceId: string): Promise<Set<string>> {
  try {
    const assignments = await db.select({ routeId: routeAssignments.routeId })
      .from(routeAssignments)
      .where(eq(routeAssignments.vehicleId, deviceId)) // matches via vehicleId
    return new Set(assignments.map(a => a.routeId))
  } catch {
    return new Set()
  }
}

// --- Geometry helpers ---

/** Distance from point to polyline, returns distance and projection info */
function pointToPolylineDistance(
  lat: number, lng: number, polyline: [number, number][]
): { distance: number; segmentIndex: number; fraction: number } {
  let minDist = Infinity
  let bestSegment = 0
  let bestFraction = 0

  for (let i = 0; i < polyline.length - 1; i++) {
    const [lat1, lng1] = polyline[i]
    const [lat2, lng2] = polyline[i + 1]

    const result = pointToSegmentDistance(lat, lng, lat1, lng1, lat2, lng2)
    if (result.distance < minDist) {
      minDist = result.distance
      bestSegment = i
      bestFraction = result.fraction
    }
  }

  return { distance: minDist, segmentIndex: bestSegment, fraction: bestFraction }
}

/** Distance from point to line segment with projection fraction */
function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): { distance: number; fraction: number } {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    return { distance: haversine(px, py, ax, ay), fraction: 0 }
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const projLat = ax + t * dx
  const projLng = ay + t * dy

  return { distance: haversine(px, py, projLat, projLng), fraction: t }
}

/** Calculate distance along polyline up to segment at fraction */
function calculateDistanceAlong(
  polyline: [number, number][], segmentIndex: number, fraction: number
): number {
  let distance = 0
  for (let i = 0; i < segmentIndex && i < polyline.length - 1; i++) {
    distance += haversine(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1])
  }
  if (segmentIndex < polyline.length - 1) {
    const segDist = haversine(
      polyline[segmentIndex][0], polyline[segmentIndex][1],
      polyline[segmentIndex + 1][0], polyline[segmentIndex + 1][1]
    )
    distance += segDist * fraction
  }
  return distance
}

function calculatePolylineDistance(polyline: [number, number][]): number {
  let distance = 0
  for (let i = 0; i < polyline.length - 1; i++) {
    distance += haversine(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1])
  }
  return distance
}

/** Bearing from point A to point B in degrees */
function segmentBearing(a: [number, number], b: [number, number]): number {
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Absolute angle difference (0-180) */
function angleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360
  if (diff > 180) diff = 360 - diff
  return diff
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number { return deg * Math.PI / 180 }
function toDeg(rad: number): number { return rad * 180 / Math.PI }

// Export cached data for other services
export function getCachedStops(): CachedStop[] { return cachedStops }
export function getCachedShapes(): CachedShape[] { return cachedShapes }
