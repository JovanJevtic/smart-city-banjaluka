import { pgTable, text, boolean, timestamp, integer, doublePrecision, index } from 'drizzle-orm/pg-core'

export const devices = pgTable('devices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  imei: text('imei').notNull().unique(),
  name: text('name'),
  model: text('model'),
  firmware: text('firmware'),
  vehicleId: text('vehicle_id').unique(),
  isOnline: boolean('is_online').default(false).notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }),

  // Route matching (Phase 8)
  assignedRouteId: text('assigned_route_id'),
  currentDirection: text('current_direction'), // 'OUTBOUND' | 'INBOUND'
  currentStopSequence: integer('current_stop_sequence'),
  scheduleAdherenceSeconds: integer('schedule_adherence_seconds'), // + = late, - = early
  routeMatchConfidence: doublePrecision('route_match_confidence'), // 0.0 - 1.0
  lastMatchedAt: timestamp('last_matched_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('devices_imei_idx').on(table.imei),
  index('devices_is_online_idx').on(table.isOnline),
])

export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert
