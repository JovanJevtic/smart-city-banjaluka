import { Job, Queue } from 'bullmq'
import { db, eq, lte, devices, telemetryRecords, canDataRecords } from '@smart-city/database'
import { TIMEOUTS } from '@smart-city/shared'
import { createLogger } from '../logger.js'
import type { AlertJobData } from './alert.processor.js'

const logger = createLogger('cleanup-processor')

let alertQueue: Queue<AlertJobData> | null = null

export function setCleanupAlertQueue(queue: Queue<AlertJobData>) {
  alertQueue = queue
}

export interface CleanupJobData {
  type: 'archive_telemetry' | 'check_offline_devices'
}

export async function processCleanupJob(job: Job<CleanupJobData>): Promise<void> {
  switch (job.data.type) {
    case 'archive_telemetry':
      await archiveOldTelemetry()
      break
    case 'check_offline_devices':
      await checkOfflineDevices()
      break
    default:
      logger.warn({ type: job.data.type }, 'Unknown cleanup job type')
  }
}

async function archiveOldTelemetry(): Promise<void> {
  const retentionDays = parseInt(process.env.TELEMETRY_RETENTION_DAYS || '90', 10)
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  logger.info({ cutoffDate, retentionDays }, 'Archiving old telemetry')

  // Delete old CAN data first (foreign key relationship)
  const canResult = await db.delete(canDataRecords)
    .where(lte(canDataRecords.timestamp, cutoffDate))

  // Delete old telemetry records
  const telResult = await db.delete(telemetryRecords)
    .where(lte(telemetryRecords.timestamp, cutoffDate))

  logger.info(
    { cutoffDate, canDeleted: canResult.rowCount, telemetryDeleted: telResult.rowCount },
    'Old telemetry archived'
  )
}

async function checkOfflineDevices(): Promise<void> {
  const offlineThreshold = new Date(Date.now() - TIMEOUTS.DEVICE_OFFLINE_THRESHOLD_MS)

  // Find devices that are marked online but haven't been seen recently
  const staleDevices = await db.select()
    .from(devices)
    .where(eq(devices.isOnline, true))

  let offlineCount = 0
  for (const device of staleDevices) {
    if (device.lastSeen && device.lastSeen < offlineThreshold) {
      // Mark as offline
      await db.update(devices)
        .set({ isOnline: false, updatedAt: new Date() })
        .where(eq(devices.id, device.id))

      // Enqueue offline alert
      if (alertQueue) {
        try {
          await alertQueue.add('device_offline', {
            type: 'device_offline',
            deviceId: device.id,
            imei: device.imei,
            data: {},
          }, { removeOnComplete: 100, removeOnFail: 50 })
        } catch (err) {
          logger.warn({ err, imei: device.imei }, 'Failed to enqueue offline alert')
        }
      }

      offlineCount++
    }
  }

  if (offlineCount > 0) {
    logger.info({ offlineCount }, 'Marked devices as offline')
  }
}
