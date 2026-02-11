import type { FastifyInstance } from 'fastify'
import { TelemetryService } from '../services/telemetry.service.js'
import { telemetryQuerySchema, telemetryExportSchema } from '../schemas/telemetry.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function telemetryRoutes(fastify: FastifyInstance) {
  const telemetryService = new TelemetryService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/api/telemetry/history', async (request) => {
    const query = telemetryQuerySchema.parse(request.query)
    return telemetryService.history(query)
  })

  fastify.get('/api/telemetry/export', async (request, reply) => {
    const query = telemetryExportSchema.parse(request.query)
    const result = await telemetryService.export(query)

    if (result.format === 'csv') {
      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', `attachment; filename="telemetry-${query.deviceId}.csv"`)
      return result.content
    }

    return result
  })
}
