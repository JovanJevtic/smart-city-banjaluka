import { Job, Queue } from 'bullmq'
import { db, eq, desc, devices, telemetryRecords, canDataRecords } from '@smart-city/database'
import { createLogger } from '../logger.js'
import type { AlertJobData } from './alert.processor.js'

const logger = createLogger('telemetry-processor')

let alertQueue: Queue<AlertJobData> | null = null

export function setAlertQueue(queue: Queue<AlertJobData>) {
  alertQueue = queue
}

export interface TelemetryJobData {
  imei: string
  telemetry: {
    timestamp: string
    gps: {
      latitude: number
      longitude: number
      altitude: number
      angle: number
      satellites: number
      speed: number
      isValid: boolean
    }
    ignition?: boolean
    movement?: boolean
    externalVoltage?: number
    batteryVoltage?: number
    gnssHdop?: number
    can?: {
      fuelLevel?: number
      fuelUsed?: number
      fuelRate?: number
      engineRpm?: number
      engineHours?: number
      vehicleSpeed?: number
      odometer?: number
      coolantTemp?: number
      throttlePosition?: number
      brakeActive?: boolean
      door1Open?: boolean
      door2Open?: boolean
      door3Open?: boolean
    }
    rawIO: unknown[]
  }
  receivedAt: string
}

export async function processTelemetryJob(job: Job<TelemetryJobData>): Promise<void> {
  const { imei, telemetry, receivedAt } = job.data

  logger.debug({ imei, timestamp: telemetry.timestamp }, 'Processing telemetry')

  // Find or create device
  let [device] = await db.select().from(devices).where(eq(devices.imei, imei)).limit(1)

  if (!device) {
    const [newDevice] = await db.insert(devices).values({
      imei,
      name: `Device ${imei}`,
      isOnline: true,
      lastSeen: new Date(),
    }).returning()
    device = newDevice
    logger.info({ imei, deviceId: device.id }, 'Created new device')
  } else {
    // Update device status
    await db.update(devices)
      .set({ isOnline: true, lastSeen: new Date(), updatedAt: new Date() })
      .where(eq(devices.id, device.id))
  }

  // Get previous telemetry for distance calculation
  const [previousRecord] = await db.select()
    .from(telemetryRecords)
    .where(eq(telemetryRecords.deviceId, device.id))
    .orderBy(desc(telemetryRecords.timestamp))
    .limit(1)

  // Calculate distance from last point
  let distanceFromLast: number | undefined
  if (previousRecord && telemetry.gps.isValid) {
    distanceFromLast = calculateDistance(
      previousRecord.latitude,
      previousRecord.longitude,
      telemetry.gps.latitude,
      telemetry.gps.longitude
    )
  }

  // Save telemetry record
  await db.insert(telemetryRecords).values({
    deviceId: device.id,
    timestamp: new Date(telemetry.timestamp),
    latitude: telemetry.gps.latitude,
    longitude: telemetry.gps.longitude,
    altitude: telemetry.gps.altitude,
    speed: telemetry.gps.speed,
    heading: telemetry.gps.angle,
    satellites: telemetry.gps.satellites,
    hdop: telemetry.gnssHdop,
    ignition: telemetry.ignition,
    movement: telemetry.movement,
    externalVoltage: telemetry.externalVoltage,
    batteryVoltage: telemetry.batteryVoltage,
    distanceFromLast,
    rawData: telemetry.rawIO,
    receivedAt: new Date(receivedAt),
  })

  // Save CAN data if present
  if (telemetry.can && Object.keys(telemetry.can).length > 0) {
    await db.insert(canDataRecords).values({
      deviceId: device.id,
      timestamp: new Date(telemetry.timestamp),
      engineRpm: telemetry.can.engineRpm,
      engineHours: telemetry.can.engineHours,
      engineCoolantTemp: telemetry.can.coolantTemp,
      fuelLevel: telemetry.can.fuelLevel,
      fuelUsed: telemetry.can.fuelUsed,
      fuelRate: telemetry.can.fuelRate,
      vehicleSpeed: telemetry.can.vehicleSpeed,
      odometer: telemetry.can.odometer,
      throttlePosition: telemetry.can.throttlePosition,
      brakeActive: telemetry.can.brakeActive,
      door1Open: telemetry.can.door1Open,
      door2Open: telemetry.can.door2Open,
      door3Open: telemetry.can.door3Open,
      receivedAt: new Date(receivedAt),
    })
  }

  logger.debug({ imei, deviceId: device.id }, 'Telemetry saved')

  // Enqueue alert checks
  if (alertQueue) {
    try {
      const alertData = {
        deviceId: device.id,
        imei,
        data: {
          latitude: telemetry.gps.latitude,
          longitude: telemetry.gps.longitude,
          speed: telemetry.gps.speed,
          timestamp: telemetry.timestamp,
        },
      }

      await alertQueue.add('check_overspeed', {
        type: 'check_overspeed' as const,
        ...alertData,
      }, { removeOnComplete: 100, removeOnFail: 50 })

      await alertQueue.add('check_geofence', {
        type: 'check_geofence' as const,
        ...alertData,
      }, { removeOnComplete: 100, removeOnFail: 50 })
    } catch (err) {
      logger.warn({ err, imei }, 'Failed to enqueue alert jobs')
    }
  }
}

/**
 * Calculate distance between two GPS points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
