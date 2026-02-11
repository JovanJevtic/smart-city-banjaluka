import { z } from 'zod'

export const telemetryQuerySchema = z.object({
  deviceId: z.string().uuid().optional(),
  imei: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
})

export const telemetryExportSchema = z.object({
  deviceId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  format: z.enum(['csv', 'json']).default('csv'),
})

export type TelemetryQuery = z.infer<typeof telemetryQuerySchema>
export type TelemetryExport = z.infer<typeof telemetryExportSchema>
