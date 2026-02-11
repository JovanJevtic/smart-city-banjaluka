import type { FastifyInstance } from 'fastify'
import { AlertService } from '../services/alert.service.js'
import { alertQuerySchema, acknowledgeAlertSchema } from '../schemas/alert.js'
import { idParamSchema } from '../schemas/common.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function alertRoutes(fastify: FastifyInstance) {
  const alertService = new AlertService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/api/alerts', async (request) => {
    const query = alertQuerySchema.parse(request.query)
    return alertService.list(query)
  })

  fastify.get('/api/alerts/stats', async () => {
    return alertService.stats()
  })

  fastify.get('/api/alerts/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return alertService.getById(id)
  })

  fastify.post('/api/alerts/:id/acknowledge', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const body = acknowledgeAlertSchema.parse(request.body || {})
    return alertService.acknowledge(id, body.acknowledgedBy || request.userId)
  })
}
