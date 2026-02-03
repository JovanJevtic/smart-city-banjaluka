export interface Config {
  redis: {
    host: string
    port: number
    password?: string
  }
  telemetryConcurrency: number
  alertConcurrency: number
}

export function loadConfig(): Config {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    telemetryConcurrency: parseInt(process.env.TELEMETRY_CONCURRENCY || '10', 10),
    alertConcurrency: parseInt(process.env.ALERT_CONCURRENCY || '5', 10),
  }
}
