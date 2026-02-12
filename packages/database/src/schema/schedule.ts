import { pgTable, text, integer, doublePrecision, timestamp, date, index, unique } from 'drizzle-orm/pg-core'

// Schedule entries — per-stop timing within a schedule (GTFS-compatible stop_times)
export const scheduleEntries = pgTable('schedule_entries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  scheduleId: text('schedule_id').notNull(),
  stopId: text('stop_id').notNull(),
  sequence: integer('sequence').notNull(),
  arrivalOffset: integer('arrival_offset').notNull(),    // seconds from departure
  departureOffset: integer('departure_offset').notNull(), // seconds from departure
}, (table) => [
  index('schedule_entries_schedule_idx').on(table.scheduleId),
  unique('schedule_entries_schedule_stop').on(table.scheduleId, table.stopId, table.sequence),
])

// ETA predictions — real-time arrival predictions
export const etaPredictions = pgTable('eta_predictions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('device_id').notNull(),
  routeId: text('route_id').notNull(),
  stopId: text('stop_id').notNull(),
  direction: text('direction').notNull(), // 'OUTBOUND' | 'INBOUND'
  predictedArrival: timestamp('predicted_arrival', { withTimezone: true }).notNull(),
  scheduledArrival: timestamp('scheduled_arrival', { withTimezone: true }),
  delaySeconds: integer('delay_seconds'),
  distanceRemaining: doublePrecision('distance_remaining'), // meters
  confidence: doublePrecision('confidence'), // 0.0 - 1.0
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('eta_predictions_stop_idx').on(table.stopId, table.predictedArrival),
  index('eta_predictions_device_idx').on(table.deviceId),
])

// Segment speeds — historical speed data for ETA accuracy improvement
export const segmentSpeeds = pgTable('segment_speeds', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id').notNull(),
  direction: text('direction').notNull(), // 'OUTBOUND' | 'INBOUND'
  fromStopSequence: integer('from_stop_sequence').notNull(),
  toStopSequence: integer('to_stop_sequence').notNull(),
  hourOfDay: integer('hour_of_day').notNull(),     // 0-23
  dayType: text('day_type').notNull(),              // 'weekday' | 'saturday' | 'sunday'
  avgSpeedKmh: doublePrecision('avg_speed_kmh').notNull(),
  sampleCount: integer('sample_count').default(0).notNull(),
  avgDwellTimeSeconds: integer('avg_dwell_time_seconds').default(30),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('segment_speeds_unique').on(
    table.routeId, table.direction, table.fromStopSequence,
    table.toStopSequence, table.hourOfDay, table.dayType
  ),
])

// Schedule exceptions — holidays, service changes
export const scheduleExceptions = pgTable('schedule_exceptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id'),                         // null = all routes
  date: date('date').notNull(),
  exceptionType: text('exception_type').notNull(),   // 'NO_SERVICE' | 'MODIFIED' | 'EXTRA'
  description: text('description'),
  modifiedScheduleId: text('modified_schedule_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// Types
export type ScheduleEntry = typeof scheduleEntries.$inferSelect
export type NewScheduleEntry = typeof scheduleEntries.$inferInsert
export type EtaPrediction = typeof etaPredictions.$inferSelect
export type NewEtaPrediction = typeof etaPredictions.$inferInsert
export type SegmentSpeed = typeof segmentSpeeds.$inferSelect
export type NewSegmentSpeed = typeof segmentSpeeds.$inferInsert
export type ScheduleException = typeof scheduleExceptions.$inferSelect
export type NewScheduleException = typeof scheduleExceptions.$inferInsert
