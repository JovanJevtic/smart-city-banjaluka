import type { FastifyInstance } from 'fastify'
import { StopService } from '../services/stop.service.js'
import { stopQuerySchema, nearbyStopsSchema } from '../schemas/stop.js'
import { idParamSchema } from '../schemas/common.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function stopRoutes(fastify: FastifyInstance) {
  const stopService = new StopService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/api/stops', async (request) => {
    const { page, limit, search } = stopQuerySchema.parse(request.query)
    return stopService.list(page, limit, search)
  })

  fastify.get('/api/stops/nearby', async (request) => {
    const { lat, lng, radius } = nearbyStopsSchema.parse(request.query)
    return stopService.nearby(lat, lng, radius)
  })

  fastify.get('/api/stops/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return stopService.getById(id)
  })
}
