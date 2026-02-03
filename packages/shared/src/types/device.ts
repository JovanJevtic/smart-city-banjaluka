/**
 * Device connection state
 */
export type DeviceConnectionState = 'connecting' | 'authenticating' | 'active' | 'disconnected'

/**
 * Device status
 */
export interface DeviceStatus {
  imei: string
  isOnline: boolean
  lastSeen?: Date
  connectionState: DeviceConnectionState
  ipAddress?: string
  firmware?: string
  model?: string
}

/**
 * Device registration
 */
export interface DeviceRegistration {
  imei: string
  name?: string
  model?: string
  vehicleId?: string
}

/**
 * Device info
 */
export interface Device {
  id: string
  imei: string
  name?: string
  model?: string
  firmware?: string
  vehicleId?: string
  isOnline: boolean
  lastSeen?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * Device with current telemetry
 */
export interface DeviceWithTelemetry extends Device {
  latestTelemetry?: {
    latitude: number
    longitude: number
    speed: number
    heading: number
    ignition: boolean
    timestamp: Date
  }
}
