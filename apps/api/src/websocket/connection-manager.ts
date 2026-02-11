import type { WebSocket } from '@fastify/websocket'
import { createLogger } from '../logger.js'

const logger = createLogger('ws-manager')

interface WsClient {
  socket: WebSocket
  userId: string
  subscriptions: Set<string>
}

export class ConnectionManager {
  private clients = new Map<WebSocket, WsClient>()

  add(socket: WebSocket, userId: string) {
    this.clients.set(socket, { socket, userId, subscriptions: new Set() })
    logger.debug({ userId, total: this.clients.size }, 'Client connected')
  }

  remove(socket: WebSocket) {
    const client = this.clients.get(socket)
    if (client) {
      this.clients.delete(socket)
      logger.debug({ userId: client.userId, total: this.clients.size }, 'Client disconnected')
    }
  }

  subscribe(socket: WebSocket, channel: string) {
    const client = this.clients.get(socket)
    if (client) {
      client.subscriptions.add(channel)
      logger.debug({ userId: client.userId, channel }, 'Client subscribed')
    }
  }

  unsubscribe(socket: WebSocket, channel: string) {
    const client = this.clients.get(socket)
    if (client) {
      client.subscriptions.delete(channel)
    }
  }

  broadcast(channel: string, data: string) {
    let sent = 0
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(channel) && client.socket.readyState === 1) {
        client.socket.send(data)
        sent++
      }
    }
    return sent
  }

  broadcastToAll(data: string) {
    for (const client of this.clients.values()) {
      if (client.socket.readyState === 1) {
        client.socket.send(data)
      }
    }
  }

  getStats() {
    const subscriptionCounts: Record<string, number> = {}
    for (const client of this.clients.values()) {
      for (const sub of client.subscriptions) {
        subscriptionCounts[sub] = (subscriptionCounts[sub] || 0) + 1
      }
    }
    return {
      totalClients: this.clients.size,
      subscriptions: subscriptionCounts,
    }
  }
}
