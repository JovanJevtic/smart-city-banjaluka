import { Redis } from 'ioredis'
import { REDIS_CHANNELS } from '@smart-city/shared'
import { ConnectionManager } from './connection-manager.js'
import { createLogger } from '../logger.js'

const logger = createLogger('redis-subscriber')

export class RedisSubscriber {
  private subscriber: Redis
  private isRunning = false

  constructor(
    redisConfig: { host: string; port: number; password?: string },
    private connectionManager: ConnectionManager,
  ) {
    this.subscriber = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
    })
  }

  async start() {
    if (this.isRunning) return

    // Subscribe to channels
    await this.subscriber.psubscribe(
      `${REDIS_CHANNELS.TELEMETRY}:*`,
      REDIS_CHANNELS.ALERTS,
      REDIS_CHANNELS.DEVICE_STATUS,
    )

    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      this.handleMessage(channel, message)
    })

    this.isRunning = true
    logger.info('Redis subscriber started')
  }

  private handleMessage(channel: string, message: string) {
    // telemetry:all -> broadcast to "fleet" subscribers
    if (channel === REDIS_CHANNELS.TELEMETRY_ALL) {
      const payload = JSON.stringify({ type: 'telemetry', data: JSON.parse(message) })
      this.connectionManager.broadcast('fleet', payload)
      return
    }

    // telemetry:{imei} -> broadcast to "device:{imei}" subscribers
    if (channel.startsWith(`${REDIS_CHANNELS.TELEMETRY}:`)) {
      const imei = channel.split(':')[1]
      if (imei === 'all') return // already handled above
      const payload = JSON.stringify({ type: 'telemetry', data: JSON.parse(message) })
      this.connectionManager.broadcast(`device:${imei}`, payload)
      return
    }

    // alerts -> broadcast to "alerts" subscribers
    if (channel === REDIS_CHANNELS.ALERTS) {
      const payload = JSON.stringify({ type: 'alert', data: JSON.parse(message) })
      this.connectionManager.broadcast('alerts', payload)
      return
    }

    // device:status -> broadcast to "fleet" and specific device subscribers
    if (channel === REDIS_CHANNELS.DEVICE_STATUS) {
      const payload = JSON.stringify({ type: 'device_status', data: JSON.parse(message) })
      this.connectionManager.broadcast('fleet', payload)
      return
    }
  }

  async stop() {
    if (!this.isRunning) return
    await this.subscriber.punsubscribe()
    await this.subscriber.quit()
    this.isRunning = false
    logger.info('Redis subscriber stopped')
  }
}
