import { NextRequest, NextResponse } from 'next/server'
import { db, telemetryRecords, devices, eq, and, gte, lte, asc } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceId = searchParams.get('deviceId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') || '10000', 10)

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })
    }

    const conditions = [eq(telemetryRecords.deviceId, deviceId)]
    if (from) conditions.push(gte(telemetryRecords.timestamp, new Date(from)))
    if (to) conditions.push(lte(telemetryRecords.timestamp, new Date(to)))

    const records = await db.select({
      timestamp: telemetryRecords.timestamp,
      latitude: telemetryRecords.latitude,
      longitude: telemetryRecords.longitude,
      speed: telemetryRecords.speed,
      heading: telemetryRecords.heading,
      altitude: telemetryRecords.altitude,
      satellites: telemetryRecords.satellites,
      ignition: telemetryRecords.ignition,
      movement: telemetryRecords.movement,
      externalVoltage: telemetryRecords.externalVoltage,
      batteryVoltage: telemetryRecords.batteryVoltage,
    })
      .from(telemetryRecords)
      .where(and(...conditions))
      .orderBy(asc(telemetryRecords.timestamp))
      .limit(limit)

    // Get device info for filename
    const [device] = await db.select({ imei: devices.imei }).from(devices).where(eq(devices.id, deviceId)).limit(1)

    const header = 'timestamp,latitude,longitude,speed_kmh,heading,altitude,satellites,ignition,movement,external_voltage,battery_voltage\n'
    const rows = records.map(r => [
      r.timestamp.toISOString(),
      r.latitude, r.longitude,
      r.speed ?? '', r.heading ?? '', r.altitude ?? '',
      r.satellites ?? '', r.ignition ?? '', r.movement ?? '',
      r.externalVoltage ?? '', r.batteryVoltage ?? '',
    ].join(',')).join('\n')

    const csv = header + rows
    const filename = `telemetry-${device?.imei || deviceId}-${new Date().toISOString().split('T')[0]}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Failed to export telemetry:', error)
    return NextResponse.json({ error: 'Failed to export telemetry' }, { status: 500 })
  }
}
