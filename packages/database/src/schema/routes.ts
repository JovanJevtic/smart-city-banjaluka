import { pgTable, text, integer, boolean, timestamp, doublePrecision, pgEnum, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { vehicles } from './vehicles.js'

export const directionEnum = pgEnum('direction', ['OUTBOUND', 'INBOUND'])
export const shiftEnum = pgEnum('shift', ['MORNING', 'AFTERNOON', 'ALL_DAY'])

// Routes
export const routes = pgTable('routes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text('number').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// Stops
export const stops = pgTable('stops', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  code: text('code').unique(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  shelter: boolean('shelter').default(false).notNull(),
  bench: boolean('bench').default(false).notNull(),
  display: boolean('display').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('stops_lat_lng_idx').on(table.latitude, table.longitude),
])

// Route-Stop junction
export const routeStops = pgTable('route_stops', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  stopId: text('stop_id').notNull().references(() => stops.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  direction: directionEnum('direction').default('OUTBOUND').notNull(),
  avgTimeFromStart: integer('avg_time_from_start'),
}, (table) => [
  unique('route_stop_direction_unique').on(table.routeId, table.stopId, table.direction),
  index('route_stops_route_seq_idx').on(table.routeId, table.sequence),
])

// Route assignments
export const routeAssignments = pgTable('route_assignments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id),
  routeId: text('route_id').notNull().references(() => routes.id),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  shift: shiftEnum('shift').default('ALL_DAY').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('route_assignments_vehicle_active_idx').on(table.vehicleId, table.isActive),
  index('route_assignments_route_active_idx').on(table.routeId, table.isActive),
])

// Schedules
export const schedules = pgTable('schedules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id').notNull().references(() => routes.id),
  daysOfWeek: integer('days_of_week').array().notNull(),
  departureTime: text('departure_time').notNull(),
  direction: directionEnum('direction').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('schedules_route_active_idx').on(table.routeId, table.isActive),
])

// Relations
export const routesRelations = relations(routes, ({ many }) => ({
  stops: many(routeStops),
  assignments: many(routeAssignments),
  schedules: many(schedules),
}))

export const stopsRelations = relations(stops, ({ many }) => ({
  routes: many(routeStops),
}))

export const routeStopsRelations = relations(routeStops, ({ one }) => ({
  route: one(routes, { fields: [routeStops.routeId], references: [routes.id] }),
  stop: one(stops, { fields: [routeStops.stopId], references: [stops.id] }),
}))

export const routeAssignmentsRelations = relations(routeAssignments, ({ one }) => ({
  vehicle: one(vehicles, { fields: [routeAssignments.vehicleId], references: [vehicles.id] }),
  route: one(routes, { fields: [routeAssignments.routeId], references: [routes.id] }),
}))

export const schedulesRelations = relations(schedules, ({ one }) => ({
  route: one(routes, { fields: [schedules.routeId], references: [routes.id] }),
}))

// Types
export type Route = typeof routes.$inferSelect
export type NewRoute = typeof routes.$inferInsert
export type Stop = typeof stops.$inferSelect
export type NewStop = typeof stops.$inferInsert
export type Direction = 'OUTBOUND' | 'INBOUND'
export type Shift = 'MORNING' | 'AFTERNOON' | 'ALL_DAY'
