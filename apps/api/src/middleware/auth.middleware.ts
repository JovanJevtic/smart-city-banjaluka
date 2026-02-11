import type { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<{ sub: string; role: string; email: string }>()
    request.userId = payload.sub
    request.userRole = payload.role
  } catch {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
  }
}
