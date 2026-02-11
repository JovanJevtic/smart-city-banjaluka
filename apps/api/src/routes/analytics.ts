import type { FastifyInstance } from 'fastify'
import { AnalyticsService } from '../services/analytics.service.js'
import { fleetSummarySchema, vehicleStatsSchema } from '../schemas/analytics.js'
import { idParamSchema } from '../schemas/common.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function analyticsRoutes(fastify: FastifyInstance) {
  const analyticsService = new AnalyticsService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/api/analytics/fleet-summary', async (request) => {
    const { from, to } = fleetSummarySchema.parse(request.query)
    return analyticsService.fleetSummary(from, to)
  })

  fastify.get('/api/analytics/vehicle/:id/stats', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const { from, to } = vehicleStatsSchema.parse(request.query)
    return analyticsService.vehicleStats(id, from, to)
  })
}
