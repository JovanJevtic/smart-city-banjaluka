import { pgTable, text, integer, boolean, timestamp, doublePrecision, bigint, jsonb, pgEnum, index, unique } from 'drizzle-orm/pg-core'

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

  // OSM data
  osmRelationId: bigint('osm_relation_id', { mode: 'number' }).unique(),
  operator: text('operator'),
  intervalMinutes: integer('interval_minutes'),
  operatingHours: text('operating_hours'),
  distanceMeters: doublePrecision('distance_meters'),
  avgDurationMinutes: integer('avg_duration_minutes'),

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

  // OSM data
  osmNodeId: bigint('osm_node_id', { mode: 'number' }).unique(),
  zone: text('zone'),
  wheelchairAccessible: boolean('wheelchair_accessible').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('stops_lat_lng_idx').on(table.latitude, table.longitude),
])

// Route-Stop junction
export const routeStops = pgTable('route_stops', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id').notNull(),
  stopId: text('stop_id').notNull(),
  sequence: integer('sequence').notNull(),
  direction: directionEnum('direction').default('OUTBOUND').notNull(),
  avgTimeFromStart: integer('avg_time_from_start'),
  distanceFromStart: doublePrecision('distance_from_start'), // meters
}, (table) => [
  unique('route_stop_direction_unique').on(table.routeId, table.stopId, table.direction),
  index('route_stops_route_seq_idx').on(table.routeId, table.sequence),
])

// Route shapes — detailed polyline geometry per direction
export const routeShapes = pgTable('route_shapes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id').notNull(),
  direction: directionEnum('direction').notNull(),
  geometry: jsonb('geometry').notNull(), // [[lng, lat], [lng, lat], ...]
  distanceMeters: doublePrecision('distance_meters'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('route_shapes_route_direction').on(table.routeId, table.direction),
])

// Route assignments
export const routeAssignments = pgTable('route_assignments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vehicleId: text('vehicle_id').notNull(),
  routeId: text('route_id').notNull(),
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
  routeId: text('route_id').notNull(),
  daysOfWeek: integer('days_of_week').array().notNull(),
  departureTime: text('departure_time').notNull(),
  direction: directionEnum('direction').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('schedules_route_active_idx').on(table.routeId, table.isActive),
])

// OSM import log
export const osmImportLog = pgTable('osm_import_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  importType: text('import_type').notNull(), // 'routes', 'stops', 'full'
  osmTimestamp: text('osm_timestamp'),
  routesImported: integer('routes_imported').default(0),
  stopsImported: integer('stops_imported').default(0),
  routeStopsImported: integer('route_stops_imported').default(0),
  shapesImported: integer('shapes_imported').default(0),
  errors: jsonb('errors'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// Types
export type Route = typeof routes.$inferSelect
export type NewRoute = typeof routes.$inferInsert
export type Stop = typeof stops.$inferSelect
export type NewStop = typeof stops.$inferInsert
export type RouteShape = typeof routeShapes.$inferSelect
export type NewRouteShape = typeof routeShapes.$inferInsert
export type Direction = 'OUTBOUND' | 'INBOUND'
export type Shift = 'MORNING' | 'AFTERNOON' | 'ALL_DAY'
