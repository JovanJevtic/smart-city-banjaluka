export interface RouteInfo {
  id: string
  number: string
  name: string
  color: string | null
  operator: string | null
  intervalMinutes: number | null
  operatingHours: string | null
  distanceMeters: number | null
  stopCount?: number
  isActive: boolean
}

export interface StopInfo {
  id: string
  name: string
  latitude: number
  longitude: number
  zone: string | null
  wheelchairAccessible: boolean | null
  distance?: number
}

export interface RouteStop {
  id: string
  stopId: string
  sequence: number
  direction: string
  name: string
  latitude: number
  longitude: number
}

export interface LiveVehicle {
  deviceId: string
  imei: string
  name: string | null
  latitude: number
  longitude: number
  speed: number
  heading: number
  routeId: string | null
  routeNumber: string | null
  routeColor: string | null
  currentDirection: string | null
  updatedAt: string
}

export interface StopArrival {
  routeId: string
  routeNumber: string
  routeColor: string | null
  routeName: string
  direction: string
  deviceName: string | null
  predictedArrival: string
  confidence: number
  minutesAway: number
  isLive: boolean
}
