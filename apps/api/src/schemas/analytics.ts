import { z } from 'zod'

export const fleetSummarySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export const vehicleStatsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type FleetSummaryQuery = z.infer<typeof fleetSummarySchema>
export type VehicleStatsQuery = z.infer<typeof vehicleStatsSchema>
