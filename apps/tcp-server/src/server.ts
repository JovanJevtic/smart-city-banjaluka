import net, { Socket, Server } from 'node:net'
import { Redis } from 'ioredis'
import { Queue } from 'bullmq'
import {
  TeltonikaParser,
  ParsedTelemetry,
} from '@smart-city/teltonika-parser'
import {
  REDIS_KEYS,
  REDIS_CHANNELS,
  QUEUES,
  TIMEOUTS,
  DeviceLatestState,
} from '@smart-city/shared'
import { Config } from './config.js'
import { ConnectionManager, Connection } from './connection-manager.js'
import { createLogger } from './logger.js'

const logger = createLogger('tcp-server')

export class TcpServer {
  private server: Server | null = null
  private connectionManager: ConnectionManager
  private redis: Redis | null = null
  private redisPub: Redis | null = null
  private telemetryQueue: Queue | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private config: Config

  constructor(config: Config) {
    this.config = config
    this.connectionManager = new ConnectionManager()
  }

  async start(): Promise<void> {
    // Initialize Redis
    await this.initializeRedis()

    // Initialize queue
    if (this.config.enableQueue) {
      await this.initializeQueue()
    }

    // Create TCP server
    this.server = net.createServer((socket) => this.handleConnection(socket))

    // Server error handling
    this.server.on('error', (error) => {
      logger.error({ error }, 'Server error')
    })

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        resolve()
      })
      this.server!.once('error', reject)
    })

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.connectionManager.cleanup(this.config.socketTimeout)
      if (cleaned > 0) {
        logger.info({ cleaned }, 'Cleaned up stale connections')
      }
    }, this.config.cleanupInterval)

    logger.info(
      { port: this.config.port, host: this.config.host },
      'TCP Server listening'
    )
  }

  async stop(): Promise<void> {
    logger.info('Stopping TCP server...')

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Close all connections
    for (const conn of this.connectionManager.getActiveConnections()) {
      conn.socket.destroy()
    }

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve())
      })
    }

    // Close queue
    if (this.telemetryQueue) {
      await this.telemetryQueue.close()
    }

    // Close Redis
    if (this.redis) {
      await this.redis.quit()
    }
    if (this.redisPub) {
      await this.redisPub.quit()
    }

    logger.info('TCP Server stopped')
  }

  private async initializeRedis(): Promise<void> {
    const redisOptions = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      maxRetriesPerRequest: null,
    }

    this.redis = new Redis(redisOptions)
    this.redisPub = new Redis(redisOptions)

    // Test connection
    await this.redis.ping()
    logger.info('Redis connected')
  }

  private async initializeQueue(): Promise<void> {
    this.telemetryQueue = new Queue(QUEUES.TELEMETRY, {
      connection: {
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    })

    logger.info('BullMQ queue initialized')
  }

  private handleConnection(socket: Socket): void {
    const connection = this.connectionManager.createConnection(socket)

    logger.info(
      { remoteAddress: connection.remoteAddress },
      'New connection established'
    )

    // Configure socket
    socket.setKeepAlive(true, 60000)
    socket.setTimeout(this.config.socketTimeout)

    // Handle incoming data
    socket.on('data', (data) => this.handleData(socket, data))

    // Handle socket timeout
    socket.on('timeout', () => {
      logger.info(
        { remoteAddress: connection.remoteAddress, imei: connection.imei },
        'Socket timeout'
      )
      socket.destroy()
    })

    // Handle socket close
    socket.on('close', () => {
      this.handleDisconnect(socket)
    })

    // Handle socket error
    socket.on('error', (error) => {
      logger.error(
        { error, remoteAddress: connection.remoteAddress, imei: connection.imei },
        'Socket error'
      )
    })
  }

  private async handleData(socket: Socket, data: Buffer): Promise<void> {
    const connection = this.connectionManager.getConnection(socket)
    if (!connection) {
      logger.warn('Received data for unknown connection')
      return
    }

    this.connectionManager.appendToBuffer(socket, data)
    this.connectionManager.updateActivity(socket)

    logger.debug(
      {
        imei: connection.imei,
        bytes: data.length,
        bufferSize: connection.buffer.length,
        state: connection.state,
      },
      'Data received'
    )

    // Process buffer based on state
    if (connection.state === 'waiting_imei') {
      await this.handleImeiPhase(socket, connection)
    } else {
      await this.handleDataPhase(socket, connection)
    }
  }

  private async handleImeiPhase(
    socket: Socket,
    connection: Connection
  ): Promise<void> {
    const result = connection.parser.parseImei(connection.buffer)

    if (!result) {
      // Not enough data yet
      return
    }

    this.connectionManager.consumeBuffer(socket, result.bytesConsumed)

    logger.info(
      { imei: result.imei, valid: result.valid },
      'IMEI received'
    )

    // Check whitelist
    if (
      this.config.imeiWhitelist &&
      !this.config.imeiWhitelist.includes(result.imei)
    ) {
      logger.warn({ imei: result.imei }, 'IMEI not in whitelist, rejecting')
      socket.write(connection.parser.getImeiResponse(false))
      socket.destroy()
      return
    }

    if (result.valid) {
      this.connectionManager.setImei(socket, result.imei)
      socket.write(connection.parser.getImeiResponse(true))

      // Update device status in Redis
      await this.updateDeviceStatus(result.imei, true)

      logger.info({ imei: result.imei }, 'Device authenticated')
    } else {
      logger.warn({ imei: result.imei }, 'Invalid IMEI format, rejecting')
      socket.write(connection.parser.getImeiResponse(false))
      socket.destroy()
    }
  }

  private async handleDataPhase(
    socket: Socket,
    connection: Connection
  ): Promise<void> {
    // Process all complete packets in buffer
    while (true) {
      const packetLength = connection.parser.getPacketLength(connection.buffer)

      if (packetLength === -1) {
        // Invalid packet, clear buffer
        logger.warn(
          { imei: connection.imei },
          'Invalid packet preamble, clearing buffer'
        )
        connection.buffer = Buffer.alloc(0)
        return
      }

      if (packetLength === 0) {
        // Incomplete packet, wait for more data
        return
      }

      // Parse the packet
      const result = connection.parser.parseAvlPacket(connection.buffer)

      if (!result) {
        logger.error({ imei: connection.imei }, 'Failed to parse AVL packet')
        this.connectionManager.consumeBuffer(socket, packetLength)
        continue
      }

      this.connectionManager.consumeBuffer(socket, result.bytesConsumed)
      this.connectionManager.incrementPackets(socket, result.packet.numberOfRecords)

      logger.info(
        {
          imei: connection.imei,
          codecId: result.packet.codecId.toString(16),
          records: result.packet.numberOfRecords,
          crcValid: result.packet.crcValid,
        },
        'AVL packet parsed'
      )

      // Process each record
      for (const record of result.packet.records) {
        const telemetry = connection.parser.recordToTelemetry(record)
        await this.processTelemetry(connection.imei!, telemetry)
      }

      // Send acknowledgment
      const ack = connection.parser.getAcknowledgment(result.packet.numberOfRecords)
      socket.write(ack)

      logger.debug(
        { imei: connection.imei, records: result.packet.numberOfRecords },
        'ACK sent'
      )
    }
  }

  private async processTelemetry(
    imei: string,
    telemetry: ParsedTelemetry
  ): Promise<void> {
    logger.debug(
      {
        imei,
        timestamp: telemetry.timestamp,
        lat: telemetry.gps.latitude,
        lng: telemetry.gps.longitude,
        speed: telemetry.gps.speed,
        ignition: telemetry.ignition,
      },
      'Processing telemetry'
    )

    // Prepare latest state for Redis
    const latestState: DeviceLatestState = {
      imei,
      latitude: telemetry.gps.latitude,
      longitude: telemetry.gps.longitude,
      speed: telemetry.gps.speed,
      heading: telemetry.gps.angle,
      altitude: telemetry.gps.altitude,
      satellites: telemetry.gps.satellites,
      ignition: telemetry.ignition ?? false,
      movement: telemetry.movement ?? false,
      externalVoltage: telemetry.externalVoltage,
      timestamp: telemetry.timestamp.toISOString(),
      receivedAt: new Date().toISOString(),
    }

    // Hot path: Update Redis (parallel operations)
    const redisPromises: Promise<unknown>[] = []

    if (this.redis) {
      // 1. Cache latest position
      const cacheKey = `${REDIS_KEYS.DEVICE_LATEST}:${imei}:latest`
      redisPromises.push(
        this.redis.setex(cacheKey, TIMEOUTS.CACHE_TTL_SECONDS, JSON.stringify(latestState))
      )

      // 2. Update geo index (only if GPS is valid)
      if (telemetry.gps.isValid) {
        redisPromises.push(
          this.redis.geoadd(
            REDIS_KEYS.DEVICES_GEO,
            telemetry.gps.longitude,
            telemetry.gps.latitude,
            imei
          )
        )
      }
    }

    // 3. Publish for WebSocket subscribers
    if (this.redisPub) {
      const message = JSON.stringify(latestState)
      redisPromises.push(
        this.redisPub.publish(`${REDIS_CHANNELS.TELEMETRY}:${imei}`, message)
      )
      redisPromises.push(
        this.redisPub.publish(REDIS_CHANNELS.TELEMETRY_ALL, message)
      )
    }

    // 4. Add to queue for persistence (cold path)
    if (this.telemetryQueue) {
      redisPromises.push(
        this.telemetryQueue.add('save-telemetry', {
          imei,
          telemetry: {
            ...telemetry,
            timestamp: telemetry.timestamp.toISOString(),
          },
          receivedAt: new Date().toISOString(),
        })
      )
    }

    // Execute all Redis operations in parallel
    try {
      await Promise.all(redisPromises)
    } catch (error) {
      logger.error({ error, imei }, 'Error processing telemetry in Redis')
    }
  }

  private async updateDeviceStatus(imei: string, online: boolean): Promise<void> {
    if (!this.redis || !this.redisPub) return

    const statusKey = `${REDIS_KEYS.DEVICE_STATUS}:${imei}:status`
    const status = online ? 'online' : 'offline'

    await this.redis.set(statusKey, status)
    await this.redisPub.publish(REDIS_CHANNELS.DEVICE_STATUS, JSON.stringify({ imei, status }))
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    const connection = this.connectionManager.getConnection(socket)

    if (connection) {
      logger.info(
        {
          remoteAddress: connection.remoteAddress,
          imei: connection.imei,
          bytesReceived: connection.bytesReceived,
          packetsReceived: connection.packetsReceived,
        },
        'Connection closed'
      )

      if (connection.imei) {
        await this.updateDeviceStatus(connection.imei, false)
      }

      this.connectionManager.removeConnection(socket)
    }
  }

  /**
   * Get server statistics
   */
  getStats(): {
    connections: ReturnType<ConnectionManager['getStats']>
  } {
    return {
      connections: this.connectionManager.getStats(),
    }
  }
}
