import { pgTable, text, boolean, timestamp, doublePrecision, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'

export const alertTypeEnum = pgEnum('alert_type', [
  'GEOFENCE_ENTER',
  'GEOFENCE_EXIT',
  'OVERSPEED',
  'HARSH_BRAKING',
  'HARSH_ACCELERATION',
  'EXCESSIVE_IDLE',
  'LOW_FUEL',
  'ENGINE_ERROR',
  'DEVICE_OFFLINE',
  'SOS_BUTTON',
  'ROUTE_DEVIATION',
])

export const alertSeverityEnum = pgEnum('alert_severity', ['INFO', 'WARNING', 'CRITICAL'])

export const alerts = pgTable('alerts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('device_id').notNull(),
  type: alertTypeEnum('type').notNull(),
  severity: alertSeverityEnum('severity').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  acknowledged: boolean('acknowledged').default(false).notNull(),
  acknowledgedBy: text('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('alerts_device_created_idx').on(table.deviceId, table.createdAt),
  index('alerts_type_ack_idx').on(table.type, table.acknowledged),
])

// Types
export type Alert = typeof alerts.$inferSelect
export type NewAlert = typeof alerts.$inferInsert
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
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'
