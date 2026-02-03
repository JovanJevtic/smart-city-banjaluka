import { DEFAULT_TCP_PORT, TIMEOUTS } from '@smart-city/shared'

export interface Config {
  port: number
  host: string
  redis: {
    host: string
    port: number
    password?: string
  }
  socketTimeout: number
  cleanupInterval: number
  imeiWhitelist: string[] | null // null = accept all
  enableQueue: boolean
}

export function loadConfig(): Config {
  const imeiWhitelist = process.env.IMEI_WHITELIST
    ? process.env.IMEI_WHITELIST.split(',').map((s) => s.trim())
    : null

  return {
    port: parseInt(process.env.TCP_PORT || String(DEFAULT_TCP_PORT), 10),
    host: process.env.TCP_HOST || '0.0.0.0',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    socketTimeout: parseInt(
      process.env.SOCKET_TIMEOUT || String(TIMEOUTS.SOCKET_TIMEOUT_MS),
      10
    ),
    cleanupInterval: parseInt(
      process.env.CLEANUP_INTERVAL || String(TIMEOUTS.CLEANUP_INTERVAL_MS),
      10
    ),
    imeiWhitelist,
    enableQueue: process.env.ENABLE_QUEUE !== 'false',
  }
}
