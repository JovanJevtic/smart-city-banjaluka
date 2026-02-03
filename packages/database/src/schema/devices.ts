import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const devices = pgTable('devices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  imei: text('imei').notNull().unique(),
  name: text('name'),
  model: text('model'),
  firmware: text('firmware'),
  vehicleId: text('vehicle_id').unique(),
  isOnline: boolean('is_online').default(false).notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('devices_imei_idx').on(table.imei),
  index('devices_is_online_idx').on(table.isOnline),
])

export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert
