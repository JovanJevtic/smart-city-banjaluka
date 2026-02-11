import type { FastifyInstance } from 'fastify'
import { AuthService } from '../services/auth.service.js'
import { loginSchema, registerSchema } from '../schemas/auth.js'
import { authenticate } from '../middleware/auth.middleware.js'

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify)

  fastify.post('/api/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)
    const result = await authService.register(body.email, body.password, body.name, body.role)
    reply.code(201).send(result)
  })

  fastify.post('/api/auth/login', async (request) => {
    const body = loginSchema.parse(request.body)
    return authService.login(body.email, body.password)
  })

  fastify.get('/api/auth/me', { preHandler: [authenticate] }, async (request) => {
    return authService.getProfile(request.userId)
  })
}
