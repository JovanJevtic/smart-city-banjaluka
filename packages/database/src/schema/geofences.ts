import { pgTable, text, integer, boolean, timestamp, doublePrecision, jsonb, pgEnum } from 'drizzle-orm/pg-core'

export const geofenceTypeEnum = pgEnum('geofence_type', ['CIRCLE', 'POLYGON'])

export const geofences = pgTable('geofences', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: geofenceTypeEnum('type').notNull(),

  // Circle
  centerLat: doublePrecision('center_lat'),
  centerLng: doublePrecision('center_lng'),
  radius: integer('radius'),

  // Polygon
  polygon: jsonb('polygon'), // Array of [lat, lng] pairs

  // Rules
  alertOnEnter: boolean('alert_on_enter').default(true).notNull(),
  alertOnExit: boolean('alert_on_exit').default(true).notNull(),
  speedLimit: integer('speed_limit'),

  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// Types
export type Geofence = typeof geofences.$inferSelect
export type NewGeofence = typeof geofences.$inferInsert
export type GeofenceType = 'CIRCLE' | 'POLYGON'
