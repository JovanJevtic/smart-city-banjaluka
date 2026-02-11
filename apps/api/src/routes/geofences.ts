import type { FastifyInstance } from 'fastify'
import { GeofenceService } from '../services/geofence.service.js'
import { createGeofenceSchema, updateGeofenceSchema } from '../schemas/geofence.js'
import { paginationSchema, idParamSchema } from '../schemas/common.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function geofenceRoutes(fastify: FastifyInstance) {
  const geofenceService = new GeofenceService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/api/geofences', async (request) => {
    const { page, limit } = paginationSchema.parse(request.query)
    return geofenceService.list(page, limit)
  })

  fastify.get('/api/geofences/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return geofenceService.getById(id)
  })

  fastify.post('/api/geofences', async (request, reply) => {
    const body = createGeofenceSchema.parse(request.body)
    const geofence = await geofenceService.create(body)
    reply.code(201).send(geofence)
  })

  fastify.put('/api/geofences/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const body = updateGeofenceSchema.parse(request.body)
    return geofenceService.update(id, body)
  })

  fastify.delete('/api/geofences/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return geofenceService.delete(id)
  })
}
