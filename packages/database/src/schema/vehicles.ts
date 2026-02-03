import { pgTable, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { devices } from './devices.js'
import { routeAssignments } from './routes.js'

export const vehicleTypeEnum = pgEnum('vehicle_type', ['BUS', 'MINIBUS', 'TRAM', 'SERVICE_VEHICLE'])

export const vehicles = pgTable('vehicles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  registrationNo: text('registration_no').notNull().unique(),
  type: vehicleTypeEnum('type').notNull(),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  capacity: integer('capacity'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  device: one(devices, {
    fields: [vehicles.id],
    references: [devices.vehicleId],
  }),
  routeAssignments: many(routeAssignments),
}))

export type Vehicle = typeof vehicles.$inferSelect
export type NewVehicle = typeof vehicles.$inferInsert
export type VehicleType = 'BUS' | 'MINIBUS' | 'TRAM' | 'SERVICE_VEHICLE'
