export interface Config {
  port: number
  host: string
  jwtSecret: string
  jwtExpiresIn: string
  redis: {
    host: string
    port: number
    password?: string
  }
  corsOrigin: string | string[]
  rateLimitMax: number
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.API_PORT || '3000', 10),
    host: process.env.API_HOST || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  }
}
