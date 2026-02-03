import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { pool } from '@smart-city/database'
import { QUEUES } from '@smart-city/shared'
import { createLogger } from './logger.js'
import { processTelemetryJob, TelemetryJobData } from './processors/telemetry.processor.js'
import { processAlertJob, AlertJobData } from './processors/alert.processor.js'
import { loadConfig } from './config.js'

const logger = createLogger('main')

async function main(): Promise<void> {
  logger.info('Starting Smart City Worker...')

  const config = loadConfig()

  const redisConnection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
  })

  // Test database connection
  const client = await pool.connect()
  client.release()
  logger.info('Database connected')

  // Test Redis connection
  await redisConnection.ping()
  logger.info('Redis connected')

  // Create workers
  const telemetryWorker = new Worker<TelemetryJobData>(
    QUEUES.TELEMETRY,
    async (job: Job<TelemetryJobData>) => {
      return processTelemetryJob(job)
    },
    {
      connection: redisConnection,
      concurrency: config.telemetryConcurrency,
    }
  )

  const alertWorker = new Worker<AlertJobData>(
    QUEUES.ALERTS,
    async (job: Job<AlertJobData>) => {
      return processAlertJob(job)
    },
    {
      connection: redisConnection,
      concurrency: config.alertConcurrency,
    }
  )

  // Worker event handlers
  telemetryWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Telemetry job completed')
  })

  telemetryWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Telemetry job failed')
  })

  alertWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Alert job completed')
  })

  alertWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Alert job failed')
  })

  logger.info('Workers started')

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Received shutdown signal')

    await telemetryWorker.close()
    await alertWorker.close()
    await redisConnection.quit()
    await pool.end()

    logger.info('Workers stopped')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  // Keep the process alive
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception')
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection')
    process.exit(1)
  })
}

main().catch((error) => {
  console.error('Failed to start worker:', error)
  process.exit(1)
})
