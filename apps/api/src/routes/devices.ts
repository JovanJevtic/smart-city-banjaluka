import type { FastifyInstance } from 'fastify'
import { DeviceService } from '../services/device.service.js'
import { createDeviceSchema, updateDeviceSchema } from '../schemas/device.js'
import { paginationSchema, idParamSchema } from '../schemas/common.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function deviceRoutes(fastify: FastifyInstance) {
  const deviceService = new DeviceService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/api/devices', async (request) => {
    const { page, limit } = paginationSchema.parse(request.query)
    return deviceService.list(page, limit)
  })

  fastify.get('/api/devices/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return deviceService.getById(id)
  })

  fastify.post('/api/devices', async (request, reply) => {
    const body = createDeviceSchema.parse(request.body)
    const device = await deviceService.create(body)
    reply.code(201).send(device)
  })

  fastify.put('/api/devices/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const body = updateDeviceSchema.parse(request.body)
    return deviceService.update(id, body)
  })

  fastify.delete('/api/devices/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return deviceService.delete(id)
  })
}
