import { TcpServer } from './server.js'
import { createLogger } from './logger.js'
import { loadConfig } from './config.js'

const logger = createLogger('main')

async function main(): Promise<void> {
  logger.info('Starting Smart City TCP Server...')

  const config = loadConfig()

  logger.info({ config: { ...config, redis: { ...config.redis, password: '***' } } }, 'Configuration loaded')

  const server = new TcpServer(config)

  // Graceful shutdown handlers
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Received shutdown signal')
    await server.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception')
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection')
    process.exit(1)
  })

  // Start server
  try {
    await server.start()
    logger.info({ port: config.port }, 'TCP Server started successfully')
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server')
    process.exit(1)
  }
}

main()
