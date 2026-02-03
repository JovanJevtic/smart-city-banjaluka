/**
 * Direction on a route
 */
export type Direction = 'OUTBOUND' | 'INBOUND'

/**
 * Bus stop
 */
export interface Stop {
  id: string
  name: string
  code?: string
  latitude: number
  longitude: number
  shelter: boolean
  bench: boolean
  display: boolean
}

/**
 * Route info
 */
export interface Route {
  id: string
  number: string
  name: string
  description?: string
  color?: string
  isActive: boolean
}

/**
 * Route with stops
 */
export interface RouteWithStops extends Route {
  stops: Array<{
    stop: Stop
    sequence: number
    direction: Direction
    avgTimeFromStart?: number
  }>
}

/**
 * Schedule entry
 */
export interface Schedule {
  id: string
  routeId: string
  daysOfWeek: number[]
  departureTime: string
  direction: Direction
  isActive: boolean
}

/**
 * ETA prediction for a stop
 */
export interface StopETA {
  stopId: string
  stopName: string
  scheduledTime?: Date
  predictedTime: Date
  delaySeconds: number
  distanceMeters: number
}

/**
 * Upcoming arrival at a stop
 */
export interface UpcomingArrival {
  routeNumber: string
  routeName: string
  vehicleId: string
  registrationNo: string
  predictedArrival: Date
  delaySeconds: number
  distanceMeters: number
  stopsAway: number
}
