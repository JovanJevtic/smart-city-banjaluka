import type { FastifyInstance } from 'fastify'
import { AdherenceService } from '../services/adherence.service.js'
import { idParamSchema } from '../schemas/common.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function adherenceRoutes(fastify: FastifyInstance) {
  const adherenceService = new AdherenceService(fastify.redis)

  fastify.addHook('preHandler', authenticate)

  // Active vehicles on a route with ETAs
  fastify.get('/api/routes/:id/vehicles', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return adherenceService.getRouteVehicles(id)
  })

  // Upcoming arrivals at a stop
  fastify.get('/api/stops/:id/arrivals', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return adherenceService.getStopArrivals(id)
  })

  // Fleet-wide adherence summary
  fastify.get('/api/adherence/summary', async () => {
    return adherenceService.getAdherenceSummary()
  })
}
