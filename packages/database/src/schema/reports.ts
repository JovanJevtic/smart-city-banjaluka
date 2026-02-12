import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const reportJobs = pgTable('report_jobs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),        // 'fleet_monthly', 'vehicle_monthly', 'route_monthly', 'csv_export'
  status: text('status').notNull(),    // 'pending', 'processing', 'completed', 'failed'
  parameters: jsonb('parameters'),     // { period: { from, to }, vehicleId?, routeId?, etc. }
  requestedBy: text('requested_by'),
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const scheduledReports = pgTable('scheduled_reports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),
  cronExpression: text('cron_expression').notNull(),
  parameters: jsonb('parameters'),
  isActive: boolean('is_active').default(true).notNull(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ReportJob = typeof reportJobs.$inferSelect
export type NewReportJob = typeof reportJobs.$inferInsert
