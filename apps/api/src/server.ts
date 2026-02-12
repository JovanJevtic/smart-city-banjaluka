import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import { Redis } from 'ioredis'
import { ZodError } from 'zod'
import type { Config } from './config.js'
import { rootLogger } from './logger.js'

// Plugins
import authPlugin from './plugins/auth.js'
import corsPlugin from './plugins/cors.js'
import rateLimitPlugin from './plugins/rate-limit.js'

// Routes
import healthRoutes from './routes/health.js'
import authRoutes from './routes/auth.js'
import deviceRoutes from './routes/devices.js'
import vehicleRoutes from './routes/vehicles.js'
import routeRoutes from './routes/routes.js'
import telemetryRoutes from './routes/telemetry.js'
import alertRoutes from './routes/alerts.js'
import geofenceRoutes from './routes/geofences.js'
import analyticsRoutes from './routes/analytics.js'
import stopRoutes from './routes/stops.js'
import adherenceRoutes from './routes/adherence.js'
import gtfsRtRoutes from './routes/gtfs-rt.js'

// WebSocket
import { ConnectionManager } from './websocket/connection-manager.js'
import { RedisSubscriber } from './websocket/redis-subscriber.js'
import { setupWebSocket } from './websocket/index.js'

// Extend Fastify with custom properties
declare module 'fastify' {
  interface FastifyInstance {
    config: Config
    redis: Redis
  }
}

export async function buildServer(config: Config) {
  const fastify = Fastify({
    logger: rootLogger,
  })

  // Decorate with config
  fastify.decorate('config', config)

  // Redis connection
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  })
  fastify.decorate('redis', redis)

  // Register plugins
  await fastify.register(corsPlugin)
  await fastify.register(rateLimitPlugin)
  await fastify.register(authPlugin)
  await fastify.register(fastifyWebsocket)

  // Global error handler
  fastify.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
      })
    }

    // Custom thrown errors with statusCode
    const err = error as Record<string, unknown>
    if (typeof err.statusCode === 'number' && err.statusCode < 500) {
      return reply.code(err.statusCode).send({
        error: err.message,
      })
    }

    fastify.log.error(error)
    return reply.code(500).send({ error: 'Internal Server Error' })
  })

  // Register routes
  await fastify.register(healthRoutes)
  await fastify.register(authRoutes)
  await fastify.register(deviceRoutes)
  await fastify.register(vehicleRoutes)
  await fastify.register(routeRoutes)
  await fastify.register(telemetryRoutes)
  await fastify.register(alertRoutes)
  await fastify.register(geofenceRoutes)
  await fastify.register(analyticsRoutes)
  await fastify.register(stopRoutes)
  await fastify.register(adherenceRoutes)
  await fastify.register(gtfsRtRoutes)

  // WebSocket setup
  const connectionManager = new ConnectionManager()
  const redisSubscriber = new RedisSubscriber(config.redis, connectionManager)
  setupWebSocket(fastify, connectionManager, redisSubscriber)

  // Start Redis subscriber when server is ready
  fastify.addHook('onReady', async () => {
    await redisSubscriber.start()
  })

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await redisSubscriber.stop()
    await redis.quit()
  })

  return fastify
}
