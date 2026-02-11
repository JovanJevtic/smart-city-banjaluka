import { z } from 'zod'

export const alertQuerySchema = z.object({
  deviceId: z.string().uuid().optional(),
  type: z.enum([
    'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'OVERSPEED',
    'HARSH_BRAKING', 'HARSH_ACCELERATION', 'EXCESSIVE_IDLE',
    'LOW_FUEL', 'ENGINE_ERROR', 'DEVICE_OFFLINE',
    'SOS_BUTTON', 'ROUTE_DEVIATION',
  ]).optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  acknowledged: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const acknowledgeAlertSchema = z.object({
  acknowledgedBy: z.string().optional(),
})

export type AlertQuery = z.infer<typeof alertQuerySchema>
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>
