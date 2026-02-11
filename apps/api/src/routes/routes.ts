import type { FastifyInstance } from 'fastify'
import { RouteService } from '../services/route.service.js'
import { createRouteSchema, updateRouteSchema } from '../schemas/route.js'
import { paginationSchema, idParamSchema } from '../schemas/common.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function routeRoutes(fastify: FastifyInstance) {
  const routeService = new RouteService()

  fastify.addHook('preHandler', authenticate)

  fastify.get('/api/routes', async (request) => {
    const { page, limit } = paginationSchema.parse(request.query)
    return routeService.list(page, limit)
  })

  fastify.get('/api/routes/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return routeService.getById(id)
  })

  fastify.post('/api/routes', async (request, reply) => {
    const body = createRouteSchema.parse(request.body)
    const route = await routeService.create(body)
    reply.code(201).send(route)
  })

  fastify.put('/api/routes/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const body = updateRouteSchema.parse(request.body)
    return routeService.update(id, body)
  })

  fastify.delete('/api/routes/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params)
    return routeService.delete(id)
  })
}
