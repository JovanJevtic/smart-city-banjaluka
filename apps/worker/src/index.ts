import { Worker, Queue, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { pool } from '@smart-city/database'
import { QUEUES } from '@smart-city/shared'
import { createLogger } from './logger.js'
import { processTelemetryJob, setAlertQueue, TelemetryJobData } from './processors/telemetry.processor.js'
import { processAlertJob, setRedisPublisher, AlertJobData } from './processors/alert.processor.js'
import { processAnalyticsJob, AnalyticsJobData } from './processors/analytics.processor.js'
import { processCleanupJob, setCleanupAlertQueue, CleanupJobData } from './processors/cleanup.processor.js'
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

  // Separate Redis connection for publishing (alert processor)
  const redisPub = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  })

  // Test database connection
  const client = await pool.connect()
  client.release()
  logger.info('Database connected')

  // Test Redis connection
  await redisConnection.ping()
  logger.info('Redis connected')

  // Set up Redis publisher for alert processor
  setRedisPublisher(redisPub)

  // Create queues
  const alertQueue = new Queue<AlertJobData>(QUEUES.ALERTS, {
    connection: redisConnection,
  })

  const analyticsQueue = new Queue<AnalyticsJobData>(QUEUES.ANALYTICS, {
    connection: redisConnection,
  })

  const maintenanceQueue = new Queue<CleanupJobData>(QUEUES.MAINTENANCE, {
    connection: redisConnection,
  })

  // Wire up alert queue to telemetry processor and cleanup processor
  setAlertQueue(alertQueue)
  setCleanupAlertQueue(alertQueue)

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

  const analyticsWorker = new Worker<AnalyticsJobData>(
    QUEUES.ANALYTICS,
    async (job: Job<AnalyticsJobData>) => {
      return processAnalyticsJob(job)
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  )

  const maintenanceWorker = new Worker<CleanupJobData>(
    QUEUES.MAINTENANCE,
    async (job: Job<CleanupJobData>) => {
      return processCleanupJob(job)
    },
    {
      connection: redisConnection,
      concurrency: 1,
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

  analyticsWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Analytics job completed')
  })

  analyticsWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Analytics job failed')
  })

  maintenanceWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Maintenance job completed')
  })

  maintenanceWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Maintenance job failed')
  })

  // Schedule repeatable jobs
  // Daily stats aggregation at 1:00 AM
  await analyticsQueue.add('daily_stats', { type: 'daily_stats' }, {
    repeat: { pattern: '0 1 * * *' },
    removeOnComplete: 10,
    removeOnFail: 5,
  })

  // Archive old telemetry at 3:00 AM
  await maintenanceQueue.add('archive_telemetry', { type: 'archive_telemetry' }, {
    repeat: { pattern: '0 3 * * *' },
    removeOnComplete: 10,
    removeOnFail: 5,
  })

  // Check offline devices every 5 minutes
  await maintenanceQueue.add('check_offline_devices', { type: 'check_offline_devices' }, {
    repeat: { pattern: '*/5 * * * *' },
    removeOnComplete: 10,
    removeOnFail: 5,
  })

  logger.info('Workers started')
  logger.info('Scheduled jobs registered: daily_stats (1 AM), archive_telemetry (3 AM), check_offline (5 min)')

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Received shutdown signal')

    await telemetryWorker.close()
    await alertWorker.close()
    await analyticsWorker.close()
    await maintenanceWorker.close()
    await alertQueue.close()
    await analyticsQueue.close()
    await maintenanceQueue.close()
    await redisPub.quit()
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
