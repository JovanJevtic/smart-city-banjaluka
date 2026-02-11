import type { FastifyInstance } from 'fastify'
import { VehicleService } from '../services/vehicle.service.js'
import { createVehicleSchema, updateVehicleSchema } from '../schemas/vehicle.js'
import { paginationSchema, idParamSchema } from '../schemas/common.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function vehicleRoutes(fastify: FastifyInstance) {
  const vehicleService = new VehicleService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/api/vehicles', async (request) => {
    const { page, limit } = paginationSchema.parse(request.query)
    return vehicleService.list(page, limit)
  })

  fastify.get('/api/vehicles/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return vehicleService.getById(id)
  })

  fastify.post('/api/vehicles', async (request, reply) => {
    const body = createVehicleSchema.parse(request.body)
    const vehicle = await vehicleService.create(body)
    reply.code(201).send(vehicle)
  })

  fastify.put('/api/vehicles/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const body = updateVehicleSchema.parse(request.body)
    return vehicleService.update(id, body)
  })

  fastify.delete('/api/vehicles/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return vehicleService.delete(id)
  })
}
