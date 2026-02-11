import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    userRole: string
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      role: string
      email: string
    }
    user: {
      sub: string
      role: string
      email: string
    }
  }
}
