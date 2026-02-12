import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { pool } from '@smart-city/database'

interface RouteMetric {
  method: string
  route: string
  requests: number
  errors: number
  totalDuration: number
}

const routeMetrics = new Map<string, RouteMetric>()
let totalRequests = 0
let totalErrors = 0
const startTime = Date.now()

async function metricsPlugin(fastify: FastifyInstance) {
  // Track request metrics
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const route = request.routeOptions?.url || request.url
    const method = request.method
    const key = `${method}:${route}`
    const duration = reply.elapsedTime || 0

    totalRequests++
    if (reply.statusCode >= 400) totalErrors++

    const existing = routeMetrics.get(key)
    if (existing) {
      existing.requests++
      if (reply.statusCode >= 400) existing.errors++
      existing.totalDuration += duration
    } else {
      routeMetrics.set(key, {
        method,
        route,
        requests: 1,
        errors: reply.statusCode >= 400 ? 1 : 0,
        totalDuration: duration,
      })
    }
  })

  // Prometheus-format metrics endpoint
  fastify.get('/metrics', async (_request, reply) => {
    const lines: string[] = []

    // Uptime
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000)
    lines.push('# HELP process_uptime_seconds Process uptime in seconds')
    lines.push('# TYPE process_uptime_seconds gauge')
    lines.push(`process_uptime_seconds ${uptimeSeconds}`)

    // Memory
    const mem = process.memoryUsage()
    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes')
    lines.push('# TYPE process_resident_memory_bytes gauge')
    lines.push(`process_resident_memory_bytes ${mem.rss}`)
    lines.push(`process_heap_used_bytes ${mem.heapUsed}`)
    lines.push(`process_heap_total_bytes ${mem.heapTotal}`)

    // HTTP requests
    lines.push('# HELP http_requests_total Total HTTP requests')
    lines.push('# TYPE http_requests_total counter')
    lines.push(`http_requests_total ${totalRequests}`)
    lines.push(`http_errors_total ${totalErrors}`)

    for (const metric of routeMetrics.values()) {
      const labels = `method="${metric.method}",route="${metric.route}"`
      lines.push(`http_route_requests_total{${labels}} ${metric.requests}`)
      lines.push(`http_route_errors_total{${labels}} ${metric.errors}`)
      const avgMs = metric.requests > 0 ? (metric.totalDuration / metric.requests).toFixed(2) : '0'
      lines.push(`http_route_avg_duration_ms{${labels}} ${avgMs}`)
    }

    // WebSocket connections
    try {
      // Access connection manager stats if available
      const wsStats = (fastify as unknown as Record<string, unknown>).wsConnectionManager as { getStats?: () => { totalClients: number } } | undefined
      if (wsStats?.getStats) {
        const stats = wsStats.getStats()
        lines.push('# HELP websocket_connections_active Active WebSocket connections')
        lines.push('# TYPE websocket_connections_active gauge')
        lines.push(`websocket_connections_active ${stats.totalClients}`)
      }
    } catch { /* ignore */ }

    // Database pool stats
    try {
      lines.push('# HELP db_pool_total Total connections in pool')
      lines.push('# TYPE db_pool_total gauge')
      lines.push(`db_pool_total ${pool.totalCount}`)
      lines.push(`db_pool_idle ${pool.idleCount}`)
      lines.push(`db_pool_waiting ${pool.waitingCount}`)
    } catch { /* ignore */ }

    // Redis status
    try {
      const pong = await fastify.redis.ping()
      lines.push('# HELP redis_connected Redis connection status')
      lines.push('# TYPE redis_connected gauge')
      lines.push(`redis_connected ${pong === 'PONG' ? 1 : 0}`)
    } catch {
      lines.push(`redis_connected 0`)
    }

    reply.type('text/plain; version=0.0.4').send(lines.join('\n') + '\n')
  })

  // JSON system info endpoint for dashboard
  fastify.get('/api/system/health', async () => {
    const mem = process.memoryUsage()
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000)

    // Database check
    let dbStatus = 'error'
    let dbPoolStats = { total: 0, idle: 0, waiting: 0 }
    try {
      const client = await pool.connect()
      client.release()
      dbStatus = 'ok'
      dbPoolStats = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    } catch { /* ignore */ }

    // Redis check
    let redisStatus = 'error'
    let redisInfo: Record<string, string> = {}
    try {
      await fastify.redis.ping()
      redisStatus = 'ok'
      const info = await fastify.redis.info('memory')
      const memMatch = info.match(/used_memory_human:(.+)/)
      if (memMatch) redisInfo.usedMemory = memMatch[1].trim()
    } catch { /* ignore */ }

    return {
      status: dbStatus === 'ok' && redisStatus === 'ok' ? 'healthy' : 'degraded',
      uptime: uptimeSeconds,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      database: { status: dbStatus, pool: dbPoolStats },
      redis: { status: redisStatus, ...redisInfo },
      http: {
        totalRequests,
        totalErrors,
        routeCount: routeMetrics.size,
      },
    }
  })
}

export default fp(metricsPlugin, { name: 'metrics' })
