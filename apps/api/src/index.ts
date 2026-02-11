import { loadConfig } from './config.js'
import { buildServer } from './server.js'
import { createLogger } from './logger.js'

const logger = createLogger('main')

async function main() {
  const config = loadConfig()
  const server = await buildServer(config)

  await server.listen({ port: config.port, host: config.host })
  logger.info({ port: config.port }, 'API server started')

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal')
    await server.close()
    logger.info('Server stopped')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

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
  console.error('Failed to start API server:', error)
  process.exit(1)
})
