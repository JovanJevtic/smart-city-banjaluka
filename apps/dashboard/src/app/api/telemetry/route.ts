import { NextRequest, NextResponse } from 'next/server'
import { db, telemetryRecords, devices, eq, and, gte, asc } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    let deviceId = searchParams.get('deviceId')
    const imei = searchParams.get('imei')
    const hours = parseInt(searchParams.get('hours') || '24', 10)
    const limit = parseInt(searchParams.get('limit') || '5000', 10)

    // If IMEI provided, resolve to deviceId
    if (imei && !deviceId) {
      const device = await db.select({ id: devices.id })
        .from(devices)
        .where(eq(devices.imei, imei))
        .limit(1)

      if (device.length > 0) {
        deviceId = device[0].id
      } else {
        return NextResponse.json({ error: 'Device not found for IMEI' }, { status: 404 })
      }
    }

    // Auto-select first device if none specified
    if (!deviceId) {
      const firstDevice = await db.select({ id: devices.id })
        .from(devices)
        .limit(1)

      if (firstDevice.length > 0) {
        deviceId = firstDevice[0].id
      } else {
        return NextResponse.json({ error: 'No devices found' }, { status: 404 })
      }
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const records = await db.select()
      .from(telemetryRecords)
      .where(
        and(
          eq(telemetryRecords.deviceId, deviceId),
          gte(telemetryRecords.timestamp, since)
        )
      )
      .orderBy(asc(telemetryRecords.timestamp))
      .limit(limit)

    return NextResponse.json({
      deviceId,
      count: records.length,
      hours,
      records,
    })
  } catch (error) {
    console.error('Failed to fetch telemetry:', error)
    return NextResponse.json({ error: 'Failed to fetch telemetry' }, { status: 500 })
  }
}
