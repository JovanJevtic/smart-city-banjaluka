import type { FastifyRequest, FastifyReply } from 'fastify'

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.userRole)) {
      reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' })
    }
  }
}
