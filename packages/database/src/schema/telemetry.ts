import { pgTable, text, integer, boolean, timestamp, doublePrecision, bigserial, jsonb, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { devices } from './devices.js'

// Main telemetry records
export const telemetryRecords = pgTable('telemetry_records', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),

  // GPS
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  altitude: integer('altitude'),
  speed: integer('speed'),
  heading: integer('heading'),
  satellites: integer('satellites'),
  hdop: doublePrecision('hdop'),

  // Status
  ignition: boolean('ignition'),
  movement: boolean('movement'),

  // Power
  externalVoltage: doublePrecision('external_voltage'),
  batteryVoltage: doublePrecision('battery_voltage'),

  // Calculated
  distanceFromLast: doublePrecision('distance_from_last'),

  // Raw data
  rawData: jsonb('raw_data'),

  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('telemetry_device_timestamp_idx').on(table.deviceId, table.timestamp),
  index('telemetry_timestamp_idx').on(table.timestamp),
])

// CAN bus data
export const canDataRecords = pgTable('can_data_records', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),

  // Engine
  engineRpm: integer('engine_rpm'),
  engineHours: doublePrecision('engine_hours'),
  engineCoolantTemp: integer('engine_coolant_temp'),
  engineLoad: doublePrecision('engine_load'),

  // Fuel
  fuelLevel: doublePrecision('fuel_level'),
  fuelUsed: doublePrecision('fuel_used'),
  fuelRate: doublePrecision('fuel_rate'),

  // Speed & distance
  vehicleSpeed: integer('vehicle_speed'),
  odometer: integer('odometer'),
  tripOdometer: doublePrecision('trip_odometer'),

  // Controls
  throttlePosition: doublePrecision('throttle_position'),
  brakeActive: boolean('brake_active'),
  cruiseControl: boolean('cruise_control'),

  // Doors
  door1Open: boolean('door1_open'),
  door2Open: boolean('door2_open'),
  door3Open: boolean('door3_open'),

  // Diagnostics
  dtcCodes: text('dtc_codes').array(),
  checkEngine: boolean('check_engine'),

  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('can_data_device_timestamp_idx').on(table.deviceId, table.timestamp),
  index('can_data_timestamp_idx').on(table.timestamp),
])

// Stop arrivals
export const stopArrivals = pgTable('stop_arrivals', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  stopId: text('stop_id').notNull(),
  deviceImei: text('device_imei').notNull(),
  scheduledTime: timestamp('scheduled_time', { withTimezone: true }),
  predictedTime: timestamp('predicted_time', { withTimezone: true }),
  actualTime: timestamp('actual_time', { withTimezone: true }),
  delaySeconds: integer('delay_seconds'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('stop_arrivals_stop_actual_idx').on(table.stopId, table.actualTime),
  index('stop_arrivals_imei_actual_idx').on(table.deviceImei, table.actualTime),
])

// Relations
export const telemetryRecordsRelations = relations(telemetryRecords, ({ one }) => ({
  device: one(devices, { fields: [telemetryRecords.deviceId], references: [devices.id] }),
}))

export const canDataRecordsRelations = relations(canDataRecords, ({ one }) => ({
  device: one(devices, { fields: [canDataRecords.deviceId], references: [devices.id] }),
}))

// Types
export type TelemetryRecord = typeof telemetryRecords.$inferSelect
export type NewTelemetryRecord = typeof telemetryRecords.$inferInsert
export type CanDataRecord = typeof canDataRecords.$inferSelect
export type NewCanDataRecord = typeof canDataRecords.$inferInsert
