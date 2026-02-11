import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const idParamSchema = z.object({
  id: z.string().uuid(),
})

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type Pagination = z.infer<typeof paginationSchema>
export type IdParam = z.infer<typeof idParamSchema>
export type DateRange = z.infer<typeof dateRangeSchema>
