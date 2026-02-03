/**
 * Default TCP server port for Teltonika devices
 */
export const DEFAULT_TCP_PORT = 5000

/**
 * Default API server port
 */
export const DEFAULT_API_PORT = 3000

/**
 * Default WebSocket port (same as API)
 */
export const DEFAULT_WS_PORT = 3000

/**
 * Redis key prefixes
 */
export const REDIS_KEYS = {
  /** Latest device telemetry: device:{imei}:latest */
  DEVICE_LATEST: 'device',
  /** Device status: device:{imei}:status */
  DEVICE_STATUS: 'device',
  /** Geo index for all devices */
  DEVICES_GEO: 'devices:positions',
  /** Device history (sorted set): device:{imei}:history */
  DEVICE_HISTORY: 'device',
} as const

/**
 * Redis pub/sub channels
 */
export const REDIS_CHANNELS = {
  /** Telemetry updates for specific device: telemetry:{imei} */
  TELEMETRY: 'telemetry',
  /** All device telemetry updates */
  TELEMETRY_ALL: 'telemetry:all',
  /** Alert notifications */
  ALERTS: 'alerts',
  /** Device status changes */
  DEVICE_STATUS: 'device:status',
} as const

/**
 * Queue names for BullMQ
 */
export const QUEUES = {
  /** Telemetry persistence queue */
  TELEMETRY: 'telemetry',
  /** Alert processing queue */
  ALERTS: 'alerts',
  /** Analytics calculation queue */
  ANALYTICS: 'analytics',
  /** Maintenance tasks queue */
  MAINTENANCE: 'maintenance',
} as const

/**
 * Default timeouts and intervals
 */
export const TIMEOUTS = {
  /** Socket timeout for inactive connections (5 minutes) */
  SOCKET_TIMEOUT_MS: 5 * 60 * 1000,
  /** Device offline threshold (10 minutes) */
  DEVICE_OFFLINE_THRESHOLD_MS: 10 * 60 * 1000,
  /** Redis cache TTL for latest position (1 hour) */
  CACHE_TTL_SECONDS: 60 * 60,
  /** Connection cleanup interval (1 minute) */
  CLEANUP_INTERVAL_MS: 60 * 1000,
} as const

/**
 * Teltonika protocol constants
 */
export const TELTONIKA = {
  /** Codec 8 ID */
  CODEC_8: 0x08,
  /** Codec 8 Extended ID */
  CODEC_8_EXTENDED: 0x8e,
  /** IMEI accepted response */
  IMEI_ACCEPTED: 0x01,
  /** IMEI rejected response */
  IMEI_REJECTED: 0x00,
  /** Minimum IMEI length */
  IMEI_LENGTH: 15,
  /** Preamble value (4 zero bytes) */
  PREAMBLE: 0x00000000,
} as const

/**
 * Alert thresholds (defaults)
 */
export const ALERT_DEFAULTS = {
  /** Default speed limit for overspeed alert (km/h) */
  OVERSPEED_LIMIT: 80,
  /** Duration before triggering overspeed (seconds) */
  OVERSPEED_DURATION: 10,
  /** Maximum idle time before alert (minutes) */
  MAX_IDLE_MINUTES: 15,
  /** Low fuel threshold (percent) */
  LOW_FUEL_THRESHOLD: 15,
  /** Harsh braking deceleration threshold (m/s²) */
  HARSH_BRAKING_THRESHOLD: 4,
  /** Harsh acceleration threshold (m/s²) */
  HARSH_ACCELERATION_THRESHOLD: 3,
} as const
