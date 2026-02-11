import { Job } from 'bullmq'
import { db, eq, and, gte, lte, devices, telemetryRecords, alerts, deviceDailyStats, sql } from '@smart-city/database'
import { createLogger } from '../logger.js'

const logger = createLogger('analytics-processor')

export interface AnalyticsJobData {
  type: 'daily_stats'
  date?: string // YYYY-MM-DD, defaults to yesterday
}

export async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<void> {
  const { type, date } = job.data

  if (type === 'daily_stats') {
    await computeDailyStats(date)
  }
}

async function computeDailyStats(dateStr?: string): Promise<void> {
  // Default to yesterday
  const targetDate = dateStr
    ? new Date(dateStr)
    : new Date(Date.now() - 24 * 60 * 60 * 1000)

  const dayStart = new Date(targetDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(targetDate)
  dayEnd.setHours(23, 59, 59, 999)

  const dateKey = dayStart.toISOString().split('T')[0]
  logger.info({ date: dateKey }, 'Computing daily stats')

  // Get all devices
  const allDevices = await db.select({ id: devices.id, imei: devices.imei }).from(devices)

  let processedCount = 0

  for (const device of allDevices) {
    try {
      // Get telemetry for this device and day
      const records = await db.select()
        .from(telemetryRecords)
        .where(and(
          eq(telemetryRecords.deviceId, device.id),
          gte(telemetryRecords.timestamp, dayStart),
          lte(telemetryRecords.timestamp, dayEnd),
        ))
        .orderBy(telemetryRecords.timestamp)

      if (records.length === 0) continue

      // Calculate stats
      let totalDistance = 0
      let drivingTime = 0
      let idleTime = 0
      let speedSum = 0
      let speedCount = 0
      let maxSpeed = 0
      let tripCount = 0
      let wasMoving = false

      for (let i = 0; i < records.length; i++) {
        const record = records[i]

        if (record.distanceFromLast) {
          totalDistance += record.distanceFromLast
        }

        if (record.speed != null) {
          speedSum += record.speed
          speedCount++
          if (record.speed > maxSpeed) maxSpeed = record.speed
        }

        // Estimate driving vs idle time between consecutive records
        if (i > 0) {
          const prev = records[i - 1]
          const dt = (record.timestamp.getTime() - prev.timestamp.getTime()) / 1000
          // Cap at 10 min to avoid counting long gaps
          const cappedDt = Math.min(dt, 600)

          if (record.movement || (record.speed != null && record.speed > 2)) {
            drivingTime += cappedDt
            if (!wasMoving) {
              tripCount++
              wasMoving = true
            }
          } else if (record.ignition) {
            idleTime += cappedDt
            wasMoving = false
          } else {
            wasMoving = false
          }
        }
      }

      // Get alert count for this device on this day
      const [alertCounts] = await db.select({
        total: sql<number>`count(*)::int`,
        overspeed: sql<number>`count(*) filter (where type = 'OVERSPEED')::int`,
        harshBraking: sql<number>`count(*) filter (where type = 'HARSH_BRAKING')::int`,
      })
        .from(alerts)
        .where(and(
          eq(alerts.deviceId, device.id),
          gte(alerts.createdAt, dayStart),
          lte(alerts.createdAt, dayEnd),
        ))

      // Upsert daily stats
      await db.insert(deviceDailyStats).values({
        deviceId: device.id,
        date: dateKey,
        totalDistance,
        tripCount,
        drivingTime: Math.round(drivingTime),
        idleTime: Math.round(idleTime),
        engineHours: (drivingTime + idleTime) / 3600,
        avgSpeed: speedCount > 0 ? speedSum / speedCount : null,
        maxSpeed: maxSpeed > 0 ? maxSpeed : null,
        alertCount: alertCounts.total,
        overspeedCount: alertCounts.overspeed,
        harshBrakingCount: alertCounts.harshBraking,
      }).onConflictDoUpdate({
        target: [deviceDailyStats.deviceId, deviceDailyStats.date],
        set: {
          totalDistance,
          tripCount,
          drivingTime: Math.round(drivingTime),
          idleTime: Math.round(idleTime),
          engineHours: (drivingTime + idleTime) / 3600,
          avgSpeed: speedCount > 0 ? speedSum / speedCount : null,
          maxSpeed: maxSpeed > 0 ? maxSpeed : null,
          alertCount: alertCounts.total,
          overspeedCount: alertCounts.overspeed,
          harshBrakingCount: alertCounts.harshBraking,
        },
      })

      processedCount++
    } catch (err) {
      logger.error({ err, deviceId: device.id }, 'Failed to compute daily stats for device')
    }
  }

  logger.info({ date: dateKey, processedCount }, 'Daily stats computed')
}
