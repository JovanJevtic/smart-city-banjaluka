import { z } from 'zod'

export const createGeofenceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['CIRCLE', 'POLYGON']),
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  radius: z.number().int().positive().optional(),
  polygon: z.array(z.tuple([z.number(), z.number()])).optional(),
  alertOnEnter: z.boolean().default(true),
  alertOnExit: z.boolean().default(true),
  speedLimit: z.number().int().positive().optional(),
}).refine(
  (data) => {
    if (data.type === 'CIRCLE') {
      return data.centerLat != null && data.centerLng != null && data.radius != null
    }
    if (data.type === 'POLYGON') {
      return data.polygon != null && data.polygon.length >= 3
    }
    return false
  },
  { message: 'Circle requires centerLat, centerLng, radius. Polygon requires at least 3 points.' }
)

export const updateGeofenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  alertOnEnter: z.boolean().optional(),
  alertOnExit: z.boolean().optional(),
  speedLimit: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type CreateGeofenceInput = z.infer<typeof createGeofenceSchema>
export type UpdateGeofenceInput = z.infer<typeof updateGeofenceSchema>
