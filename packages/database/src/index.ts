import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema/index'

const { Pool } = pg

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema })

// Export pool for raw queries (batch inserts)
export { pool }

// Export all schema
export * from './schema/index'

// Export Drizzle operators
export { eq, and, or, gt, gte, lt, lte, ne, isNull, isNotNull, inArray, notInArray, sql, desc, asc } from 'drizzle-orm'
