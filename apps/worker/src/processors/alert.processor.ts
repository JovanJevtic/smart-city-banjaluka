import { Job } from 'bullmq'
import { db, eq, and, gte, devices, alerts, geofences } from '@smart-city/database'
import { createLogger } from '../logger.js'

const logger = createLogger('alert-processor')

export interface AlertJobData {
  type: 'check_geofence' | 'check_overspeed' | 'check_idle' | 'device_offline'
  deviceId: string
  imei: string
  data: {
    latitude?: number
    longitude?: number
    speed?: number
    timestamp?: string
    geofenceId?: string
  }
}

export async function processAlertJob(job: Job<AlertJobData>): Promise<void> {
  const { type, deviceId, imei, data } = job.data

  logger.debug({ type, imei }, 'Processing alert job')

  switch (type) {
    case 'check_overspeed':
      await checkOverspeed(deviceId, imei, data)
      break
    case 'check_geofence':
      await checkGeofence(deviceId, imei, data)
      break
    case 'device_offline':
      await handleDeviceOffline(deviceId, imei)
      break
    default:
      logger.warn({ type }, 'Unknown alert type')
  }
}

async function checkOverspeed(
  deviceId: string,
  imei: string,
  data: AlertJobData['data']
): Promise<void> {
  const SPEED_LIMIT = parseInt(process.env.OVERSPEED_LIMIT || '80', 10)

  if (data.speed && data.speed > SPEED_LIMIT) {
    // Check if there's a recent overspeed alert to avoid duplicates
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const [recentAlert] = await db.select()
      .from(alerts)
      .where(and(
        eq(alerts.deviceId, deviceId),
        eq(alerts.type, 'OVERSPEED'),
        gte(alerts.createdAt, fiveMinutesAgo)
      ))
      .limit(1)

    if (!recentAlert) {
      await db.insert(alerts).values({
        deviceId,
        type: 'OVERSPEED',
        severity: data.speed > SPEED_LIMIT + 20 ? 'CRITICAL' : 'WARNING',
        message: `Vehicle exceeded speed limit: ${data.speed} km/h (limit: ${SPEED_LIMIT} km/h)`,
        data: { speed: data.speed, limit: SPEED_LIMIT },
        latitude: data.latitude,
        longitude: data.longitude,
      })

      logger.info(
        { imei, speed: data.speed, limit: SPEED_LIMIT },
        'Overspeed alert created'
      )
    }
  }
}

async function checkGeofence(
  deviceId: string,
  imei: string,
  data: AlertJobData['data']
): Promise<void> {
  if (!data.latitude || !data.longitude) return

  // Get all active geofences
  const activeGeofences = await db.select()
    .from(geofences)
    .where(eq(geofences.isActive, true))

  for (const geofence of activeGeofences) {
    const isInside = isPointInGeofence(
      data.latitude,
      data.longitude,
      geofence
    )

    if (isInside && geofence.alertOnEnter) {
      // Check for recent alert
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

      const [recentAlert] = await db.select()
        .from(alerts)
        .where(and(
          eq(alerts.deviceId, deviceId),
          eq(alerts.type, 'GEOFENCE_ENTER'),
          gte(alerts.createdAt, tenMinutesAgo)
        ))
        .limit(1)

      if (!recentAlert) {
        await db.insert(alerts).values({
          deviceId,
          type: 'GEOFENCE_ENTER',
          severity: 'INFO',
          message: `Vehicle entered geofence: ${geofence.name}`,
          data: { geofenceId: geofence.id, geofenceName: geofence.name },
          latitude: data.latitude,
          longitude: data.longitude,
        })

        logger.info(
          { imei, geofence: geofence.name },
          'Geofence enter alert created'
        )
      }
    }
  }
}

async function handleDeviceOffline(deviceId: string, imei: string): Promise<void> {
  // Check for recent offline alert
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

  const [recentAlert] = await db.select()
    .from(alerts)
    .where(and(
      eq(alerts.deviceId, deviceId),
      eq(alerts.type, 'DEVICE_OFFLINE'),
      gte(alerts.createdAt, thirtyMinutesAgo)
    ))
    .limit(1)

  if (!recentAlert) {
    await db.insert(alerts).values({
      deviceId,
      type: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      message: `Device went offline: ${imei}`,
      data: { imei },
    })

    logger.info({ imei }, 'Device offline alert created')
  }

  // Update device status
  await db.update(devices)
    .set({ isOnline: false, updatedAt: new Date() })
    .where(eq(devices.id, deviceId))
}

function isPointInGeofence(
  lat: number,
  lng: number,
  geofence: { type: string; centerLat: number | null; centerLng: number | null; radius: number | null; polygon: unknown }
): boolean {
  if (geofence.type === 'CIRCLE' && geofence.centerLat && geofence.centerLng && geofence.radius) {
    const distance = calculateDistance(
      lat,
      lng,
      geofence.centerLat,
      geofence.centerLng
    )
    return distance <= geofence.radius
  }

  if (geofence.type === 'POLYGON' && geofence.polygon) {
    const polygon = geofence.polygon as Array<[number, number]>
    return isPointInPolygon(lat, lng, polygon)
  }

  return false
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
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

function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<[number, number]>
): boolean {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}
