import { pgTable, text, integer, doublePrecision, date, index, unique } from 'drizzle-orm/pg-core'

export const deviceDailyStats = pgTable('device_daily_stats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('device_id').notNull(),
  date: date('date').notNull(),

  // Distance
  totalDistance: doublePrecision('total_distance').default(0).notNull(), // meters
  tripCount: integer('trip_count').default(0).notNull(),

  // Time
  drivingTime: integer('driving_time').default(0).notNull(), // seconds
  idleTime: integer('idle_time').default(0).notNull(), // seconds
  engineHours: doublePrecision('engine_hours').default(0).notNull(),

  // Speed
  avgSpeed: doublePrecision('avg_speed'),
  maxSpeed: integer('max_speed'),

  // Fuel
  fuelConsumed: doublePrecision('fuel_consumed'),
  avgFuelConsumption: doublePrecision('avg_fuel_consumption'), // L/100km

  // Alerts
  alertCount: integer('alert_count').default(0).notNull(),
  overspeedCount: integer('overspeed_count').default(0).notNull(),
  harshBrakingCount: integer('harsh_braking_count').default(0).notNull(),
}, (table) => [
  unique('device_daily_stats_device_date_unique').on(table.deviceId, table.date),
  index('device_daily_stats_device_idx').on(table.deviceId),
  index('device_daily_stats_date_idx').on(table.date),
])

// Types
export type DeviceDailyStats = typeof deviceDailyStats.$inferSelect
export type NewDeviceDailyStats = typeof deviceDailyStats.$inferInsert
