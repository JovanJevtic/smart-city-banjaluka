/**
 * GPS data from Teltonika device
 */
export interface GPSData {
  longitude: number
  latitude: number
  altitude: number
  angle: number
  satellites: number
  speed: number
  isValid: boolean
}

/**
 * CAN bus data from LVCAN200
 */
export interface CANData {
  // Fuel
  fuelLevel?: number
  fuelUsed?: number
  fuelRate?: number

  // Engine
  engineRpm?: number
  engineHours?: number
  coolantTemp?: number
  engineLoad?: number

  // Speed & distance
  vehicleSpeed?: number
  odometer?: number
  tripOdometer?: number

  // Controls
  throttlePosition?: number
  acceleratorPosition?: number
  brakeActive?: boolean
  cruiseControl?: boolean

  // Doors (for buses)
  door1Open?: boolean
  door2Open?: boolean
  door3Open?: boolean

  // Diagnostics
  dtcCodes?: string[]
  checkEngine?: boolean
}

/**
 * Parsed telemetry record
 */
export interface TelemetryRecord {
  timestamp: Date
  gps: GPSData

  // Basic IO
  ignition?: boolean
  movement?: boolean
  externalVoltage?: number
  batteryVoltage?: number
  batteryCurrent?: number

  // GSM/GNSS
  gsmSignal?: number
  gnssStatus?: number
  gnssHdop?: number
  gnssPdop?: number

  // CAN data
  can?: CANData

  // Calculated
  distanceFromLast?: number
}

/**
 * Real-time telemetry update for WebSocket
 */
export interface TelemetryUpdate {
  imei: string
  deviceId?: string
  vehicleId?: string
  timestamp: Date

  // Position
  latitude: number
  longitude: number
  speed: number
  heading: number

  // Status
  ignition: boolean
  isMoving: boolean

  // Optional CAN
  fuelLevel?: number
  engineRpm?: number
}

/**
 * Device latest state (cached in Redis)
 */
export interface DeviceLatestState {
  imei: string
  latitude: number
  longitude: number
  speed: number
  heading: number
  altitude: number
  satellites: number
  ignition: boolean
  movement: boolean
  externalVoltage?: number
  timestamp: string
  receivedAt: string
}
