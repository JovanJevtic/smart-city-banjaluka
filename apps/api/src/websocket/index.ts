import type { FastifyInstance } from 'fastify'
import { ConnectionManager } from './connection-manager.js'
import { RedisSubscriber } from './redis-subscriber.js'
import { createLogger } from '../logger.js'

const logger = createLogger('websocket')

export function setupWebSocket(
  fastify: FastifyInstance,
  connectionManager: ConnectionManager,
  _redisSubscriber: RedisSubscriber,
) {
  fastify.get('/ws', { websocket: true }, (socket, request) => {
    // Verify JWT from query param
    const url = new URL(request.url, `http://${request.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      socket.send(JSON.stringify({ error: 'Missing token' }))
      socket.close(4001, 'Missing token')
      return
    }

    let payload: { sub: string; role: string; email: string }
    try {
      payload = fastify.jwt.verify(token)
    } catch {
      socket.send(JSON.stringify({ error: 'Invalid token' }))
      socket.close(4001, 'Invalid token')
      return
    }

    connectionManager.add(socket, payload.sub)
    socket.send(JSON.stringify({ type: 'connected', userId: payload.sub }))

    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString())

        if (msg.subscribe) {
          connectionManager.subscribe(socket, msg.subscribe)
          socket.send(JSON.stringify({ type: 'subscribed', channel: msg.subscribe }))
        }

        if (msg.unsubscribe) {
          connectionManager.unsubscribe(socket, msg.unsubscribe)
          socket.send(JSON.stringify({ type: 'unsubscribed', channel: msg.unsubscribe }))
        }

        if (msg.ping) {
          socket.send(JSON.stringify({ type: 'pong' }))
        }
      } catch {
        logger.warn('Invalid WebSocket message received')
      }
    })

    socket.on('close', () => {
      connectionManager.remove(socket)
    })

    socket.on('error', (err: Error) => {
      logger.error({ error: err.message }, 'WebSocket error')
      connectionManager.remove(socket)
    })
  })
}
