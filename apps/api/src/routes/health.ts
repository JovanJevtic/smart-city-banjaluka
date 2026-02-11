import type { FastifyInstance } from 'fastify'
import { pool } from '@smart-city/database'

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    const checks: Record<string, string> = {}

    // Database check
    try {
      const client = await pool.connect()
      client.release()
      checks.database = 'ok'
    } catch {
      checks.database = 'error'
    }

    // Redis check
    try {
      await fastify.redis.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'error'
    }

    const healthy = Object.values(checks).every(s => s === 'ok')

    return {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    }
  })
}
