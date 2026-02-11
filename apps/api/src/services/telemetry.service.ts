import { db, eq, and, gte, lte, desc, telemetryRecords, devices, sql } from '@smart-city/database'
import type { TelemetryQuery, TelemetryExport } from '../schemas/telemetry.js'

export class TelemetryService {
  async history(query: TelemetryQuery) {
    const offset = (query.page - 1) * query.limit

    const conditions = []
    if (query.deviceId) {
      conditions.push(eq(telemetryRecords.deviceId, query.deviceId))
    }
    if (query.imei) {
      // Resolve IMEI to device ID
      const [device] = await db.select({ id: devices.id })
        .from(devices)
        .where(eq(devices.imei, query.imei))
        .limit(1)
      if (device) {
        conditions.push(eq(telemetryRecords.deviceId, device.id))
      } else {
        return { data: [], total: 0, page: query.page, limit: query.limit, totalPages: 0 }
      }
    }
    if (query.from) {
      conditions.push(gte(telemetryRecords.timestamp, query.from))
    }
    if (query.to) {
      conditions.push(lte(telemetryRecords.timestamp, query.to))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      db.select()
        .from(telemetryRecords)
        .where(where)
        .orderBy(desc(telemetryRecords.timestamp))
        .limit(query.limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(telemetryRecords)
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

  async export(query: TelemetryExport) {
    const data = await db.select()
      .from(telemetryRecords)
      .where(and(
        eq(telemetryRecords.deviceId, query.deviceId),
        gte(telemetryRecords.timestamp, query.from),
        lte(telemetryRecords.timestamp, query.to),
      ))
      .orderBy(telemetryRecords.timestamp)
      .limit(50000)

    if (query.format === 'csv') {
      const header = 'timestamp,latitude,longitude,altitude,speed,heading,satellites,ignition,movement,externalVoltage,batteryVoltage'
      const rows = data.map(r =>
        `${r.timestamp.toISOString()},${r.latitude},${r.longitude},${r.altitude ?? ''},${r.speed ?? ''},${r.heading ?? ''},${r.satellites ?? ''},${r.ignition ?? ''},${r.movement ?? ''},${r.externalVoltage ?? ''},${r.batteryVoltage ?? ''}`
      )
      return { format: 'csv' as const, content: [header, ...rows].join('\n'), count: data.length }
    }

    return { format: 'json' as const, content: data, count: data.length }
  }
}
