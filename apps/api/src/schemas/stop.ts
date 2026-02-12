import { z } from 'zod'

export const nearbyStopsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(50).max(5000).default(500), // meters
})

export const stopQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

export type NearbyStopsQuery = z.infer<typeof nearbyStopsSchema>
export type StopQuery = z.infer<typeof stopQuerySchema>
