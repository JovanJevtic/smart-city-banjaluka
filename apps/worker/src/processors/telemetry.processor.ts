import { Job } from 'bullmq'
import { prisma } from '@smart-city/database'
import { createLogger } from '../logger.js'

const logger = createLogger('telemetry-processor')

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
  let device = await prisma.device.findUnique({
    where: { imei },
  })

  if (!device) {
    device = await prisma.device.create({
      data: {
        imei,
        name: `Device ${imei}`,
        isOnline: true,
        lastSeen: new Date(),
      },
    })
    logger.info({ imei, deviceId: device.id }, 'Created new device')
  } else {
    // Update device status
    await prisma.device.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastSeen: new Date(),
      },
    })
  }

  // Get previous telemetry for distance calculation
  const previousRecord = await prisma.telemetryRecord.findFirst({
    where: { deviceId: device.id },
    orderBy: { timestamp: 'desc' },
  })

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
  await prisma.telemetryRecord.create({
    data: {
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
      rawData: telemetry.rawIO as object,
      receivedAt: new Date(receivedAt),
    },
  })

  // Save CAN data if present
  if (telemetry.can && Object.keys(telemetry.can).length > 0) {
    await prisma.canDataRecord.create({
      data: {
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
      },
    })
  }

  logger.debug({ imei, deviceId: device.id }, 'Telemetry saved')
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
