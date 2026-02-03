/**
 * Alert types
 */
export type AlertType =
  | 'GEOFENCE_ENTER'
  | 'GEOFENCE_EXIT'
  | 'OVERSPEED'
  | 'HARSH_BRAKING'
  | 'HARSH_ACCELERATION'
  | 'EXCESSIVE_IDLE'
  | 'LOW_FUEL'
  | 'ENGINE_ERROR'
  | 'DEVICE_OFFLINE'
  | 'SOS_BUTTON'
  | 'ROUTE_DEVIATION'

/**
 * Alert severity
 */
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

/**
 * Alert record
 */
export interface Alert {
  id: string
  deviceImei: string
  vehicleId?: string
  type: AlertType
  severity: AlertSeverity
  message: string
  data?: Record<string, unknown>
  latitude?: number
  longitude?: number
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: Date
  createdAt: Date
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string
  type: AlertType
  enabled: boolean
  config: AlertRuleConfig
}

/**
 * Alert rule configuration by type
 */
export type AlertRuleConfig =
  | OverspeedRuleConfig
  | GeofenceRuleConfig
  | IdleRuleConfig
  | FuelRuleConfig

export interface OverspeedRuleConfig {
  type: 'OVERSPEED'
  speedLimit: number
  durationSeconds: number
  severity: AlertSeverity
}

export interface GeofenceRuleConfig {
  type: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT'
  geofenceId: string
  severity: AlertSeverity
}

export interface IdleRuleConfig {
  type: 'EXCESSIVE_IDLE'
  maxIdleMinutes: number
  severity: AlertSeverity
}

export interface FuelRuleConfig {
  type: 'LOW_FUEL'
  thresholdPercent: number
  severity: AlertSeverity
}

/**
 * Geofence types
 */
export type GeofenceType = 'CIRCLE' | 'POLYGON'

/**
 * Geofence definition
 */
export interface Geofence {
  id: string
  name: string
  type: GeofenceType
  centerLat?: number
  centerLng?: number
  radius?: number
  polygon?: Array<[number, number]>
  alertOnEnter: boolean
  alertOnExit: boolean
  speedLimit?: number
  isActive: boolean
}

/**
 * Geofence event
 */
export interface GeofenceEvent {
  type: 'ENTER' | 'EXIT'
  geofenceId: string
  geofenceName: string
  timestamp: Date
  latitude: number
  longitude: number
}
