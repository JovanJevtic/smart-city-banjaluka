/**
 * Vehicle type
 */
export type VehicleType = 'BUS' | 'MINIBUS' | 'TRAM' | 'SERVICE_VEHICLE'

/**
 * Vehicle info
 */
export interface Vehicle {
  id: string
  registrationNo: string
  type: VehicleType
  make?: string
  model?: string
  year?: number
  capacity?: number
  deviceId?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Vehicle with device and position
 */
export interface VehicleWithPosition extends Vehicle {
  device?: {
    imei: string
    isOnline: boolean
  }
  position?: {
    latitude: number
    longitude: number
    speed: number
    heading: number
    timestamp: Date
  }
}

/**
 * Vehicle statistics
 */
export interface VehicleStats {
  vehicleId: string
  period: 'day' | 'week' | 'month'

  // Distance
  totalDistance: number

  // Time
  totalDrivingTime: number
  totalIdleTime: number
  totalEngineHours: number

  // Fuel
  totalFuelConsumed?: number
  avgFuelConsumption?: number

  // Speed
  avgSpeed: number
  maxSpeed: number

  // Trips
  tripCount: number
}

/**
 * Route assignment
 */
export interface RouteAssignment {
  id: string
  vehicleId: string
  routeId: string
  startDate: Date
  endDate?: Date
  shift: 'MORNING' | 'AFTERNOON' | 'ALL_DAY'
  isActive: boolean
}
