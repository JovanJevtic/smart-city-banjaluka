import { db, eq, and, gte, lte, desc, alerts, sql } from '@smart-city/database'
import type { AlertQuery } from '../schemas/alert.js'

export class AlertService {
  async list(query: AlertQuery) {
    const offset = (query.page - 1) * query.limit

    const conditions = []
    if (query.deviceId) {
      conditions.push(eq(alerts.deviceId, query.deviceId))
    }
    if (query.type) {
      conditions.push(eq(alerts.type, query.type))
    }
    if (query.severity) {
      conditions.push(eq(alerts.severity, query.severity))
    }
    if (query.acknowledged !== undefined) {
      conditions.push(eq(alerts.acknowledged, query.acknowledged))
    }
    if (query.from) {
      conditions.push(gte(alerts.createdAt, query.from))
    }
    if (query.to) {
      conditions.push(lte(alerts.createdAt, query.to))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      db.select()
        .from(alerts)
        .where(where)
        .orderBy(desc(alerts.createdAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(alerts)
        .where(where),
    ])

    return {
      data,
      total: countResult[0].count,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(countResult[0].count / query.limit),
    }
  }

  async getById(id: string) {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1)
    if (!alert) {
      throw { statusCode: 404, message: 'Alert not found' }
    }
    return alert
  }

  async acknowledge(id: string, acknowledgedBy?: string) {
    const [existing] = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Alert not found' }
    }

    const [alert] = await db.update(alerts)
      .set({
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      })
      .where(eq(alerts.id, id))
      .returning()

    return alert
  }

  async stats() {
    const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(alerts)
    const [unacknowledged] = await db.select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(eq(alerts.acknowledged, false))

    const bySeverity = await db.select({
      severity: alerts.severity,
      count: sql<number>`count(*)::int`,
    })
      .from(alerts)
      .where(eq(alerts.acknowledged, false))
      .groupBy(alerts.severity)

    return {
      total: total.count,
      unacknowledged: unacknowledged.count,
      bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, s.count])),
    }
  }
}
