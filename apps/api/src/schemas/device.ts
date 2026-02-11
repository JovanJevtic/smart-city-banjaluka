import { z } from 'zod'

export const createDeviceSchema = z.object({
  imei: z.string().length(15),
  name: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  firmware: z.string().max(255).optional(),
  vehicleId: z.string().uuid().optional(),
})

export const updateDeviceSchema = z.object({
  name: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  firmware: z.string().max(255).optional(),
  vehicleId: z.string().uuid().nullable().optional(),
})

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>
