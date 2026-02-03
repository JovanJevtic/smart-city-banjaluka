import type { Socket } from 'node:net'
import { TeltonikaParser, ConnectionState } from '@smart-city/teltonika-parser'
import { createLogger } from './logger.js'

const logger = createLogger('connection-manager')

export interface Connection {
  socket: Socket
  parser: TeltonikaParser
  imei: string | null
  state: ConnectionState
  buffer: Buffer
  lastActivity: Date
  remoteAddress: string
  bytesReceived: number
  packetsReceived: number
}

export class ConnectionManager {
  private connections = new Map<string, Connection>()
  private imeiToSocketId = new Map<string, string>()

  /**
   * Create a new connection entry
   */
  createConnection(socket: Socket): Connection {
    const socketId = this.getSocketId(socket)
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`

    const connection: Connection = {
      socket,
      parser: new TeltonikaParser(),
      imei: null,
      state: 'waiting_imei',
      buffer: Buffer.alloc(0),
      lastActivity: new Date(),
      remoteAddress,
      bytesReceived: 0,
      packetsReceived: 0,
    }

    this.connections.set(socketId, connection)

    logger.debug({ socketId, remoteAddress }, 'Connection created')

    return connection
  }

  /**
   * Get connection by socket
   */
  getConnection(socket: Socket): Connection | undefined {
    return this.connections.get(this.getSocketId(socket))
  }

  /**
   * Get connection by IMEI
   */
  getConnectionByImei(imei: string): Connection | undefined {
    const socketId = this.imeiToSocketId.get(imei)
    if (socketId) {
      return this.connections.get(socketId)
    }
    return undefined
  }

  /**
   * Set IMEI for a connection (after authentication)
   */
  setImei(socket: Socket, imei: string): void {
    const socketId = this.getSocketId(socket)
    const connection = this.connections.get(socketId)

    if (!connection) {
      logger.warn({ socketId }, 'Connection not found when setting IMEI')
      return
    }

    // Check if this IMEI is already connected
    const existingSocketId = this.imeiToSocketId.get(imei)
    if (existingSocketId && existingSocketId !== socketId) {
      // Close the old connection
      const oldConnection = this.connections.get(existingSocketId)
      if (oldConnection) {
        logger.info(
          { imei, oldSocketId: existingSocketId, newSocketId: socketId },
          'Device reconnected, closing old connection'
        )
        oldConnection.socket.destroy()
        this.removeConnection(oldConnection.socket)
      }
    }

    connection.imei = imei
    connection.state = 'authenticated'
    this.imeiToSocketId.set(imei, socketId)

    logger.info({ socketId, imei }, 'IMEI set for connection')
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(socket: Socket): void {
    const connection = this.connections.get(this.getSocketId(socket))
    if (connection) {
      connection.lastActivity = new Date()
    }
  }

  /**
   * Append data to connection buffer
   */
  appendToBuffer(socket: Socket, data: Buffer): void {
    const connection = this.connections.get(this.getSocketId(socket))
    if (connection) {
      connection.buffer = Buffer.concat([connection.buffer, data])
      connection.bytesReceived += data.length
    }
  }

  /**
   * Consume bytes from buffer
   */
  consumeBuffer(socket: Socket, bytes: number): void {
    const connection = this.connections.get(this.getSocketId(socket))
    if (connection) {
      connection.buffer = connection.buffer.subarray(bytes)
    }
  }

  /**
   * Increment packet counter
   */
  incrementPackets(socket: Socket, count: number = 1): void {
    const connection = this.connections.get(this.getSocketId(socket))
    if (connection) {
      connection.packetsReceived += count
    }
  }

  /**
   * Remove a connection
   */
  removeConnection(socket: Socket): void {
    const socketId = this.getSocketId(socket)
    const connection = this.connections.get(socketId)

    if (connection) {
      if (connection.imei) {
        this.imeiToSocketId.delete(connection.imei)
      }
      this.connections.delete(socketId)

      logger.info(
        {
          socketId,
          imei: connection.imei,
          bytesReceived: connection.bytesReceived,
          packetsReceived: connection.packetsReceived,
        },
        'Connection removed'
      )
    }
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): Connection[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalConnections: number
    authenticatedConnections: number
    imeis: string[]
  } {
    const connections = this.getActiveConnections()
    return {
      totalConnections: connections.length,
      authenticatedConnections: connections.filter((c) => c.imei !== null).length,
      imeis: Array.from(this.imeiToSocketId.keys()),
    }
  }

  /**
   * Clean up stale connections
   */
  cleanup(maxIdleMs: number): number {
    const now = Date.now()
    let cleaned = 0

    for (const [socketId, connection] of this.connections) {
      const idleTime = now - connection.lastActivity.getTime()
      if (idleTime > maxIdleMs) {
        logger.info(
          { socketId, imei: connection.imei, idleTime },
          'Cleaning up stale connection'
        )
        connection.socket.destroy()
        this.removeConnection(connection.socket)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Get unique socket identifier
   */
  private getSocketId(socket: Socket): string {
    return `${socket.remoteAddress}:${socket.remotePort}`
  }
}
