import { z } from 'zod'

export const createVehicleSchema = z.object({
  registrationNo: z.string().min(1).max(20),
  type: z.enum(['BUS', 'MINIBUS', 'TRAM', 'SERVICE_VEHICLE']),
  make: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  year: z.number().int().min(1990).max(2030).optional(),
  capacity: z.number().int().positive().optional(),
})

export const updateVehicleSchema = z.object({
  registrationNo: z.string().min(1).max(20).optional(),
  type: z.enum(['BUS', 'MINIBUS', 'TRAM', 'SERVICE_VEHICLE']).optional(),
  make: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  year: z.number().int().min(1990).max(2030).optional(),
  capacity: z.number().int().positive().optional(),
})

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>
