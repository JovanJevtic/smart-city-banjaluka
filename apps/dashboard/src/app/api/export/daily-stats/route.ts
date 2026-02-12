import { NextRequest, NextResponse } from 'next/server'
import { db, deviceDailyStats, devices, eq, and, gte, lte } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const deviceId = searchParams.get('deviceId')

    const conditions = []
    if (from) conditions.push(gte(deviceDailyStats.date, from))
    if (to) conditions.push(lte(deviceDailyStats.date, to))
    if (deviceId) conditions.push(eq(deviceDailyStats.deviceId, deviceId))

    const records = await db.select()
      .from(deviceDailyStats)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(deviceDailyStats.date)

    // Get device name map
    const allDevices = await db.select({ id: devices.id, imei: devices.imei, name: devices.name }).from(devices)
    const deviceMap = new Map(allDevices.map(d => [d.id, d]))

    const header = 'date,device_id,device_name,device_imei,distance_km,trips,driving_time_h,idle_time_h,avg_speed_kmh,max_speed_kmh,fuel_consumed,alerts,overspeed,harsh_braking\n'
    const rows = records.map(r => {
      const dev = deviceMap.get(r.deviceId)
      return [
        r.date,
        r.deviceId,
        `"${(dev?.name || '').replace(/"/g, '""')}"`,
        dev?.imei || '',
        (r.totalDistance / 1000).toFixed(2),
        r.tripCount,
        (r.drivingTime / 3600).toFixed(2),
        (r.idleTime / 3600).toFixed(2),
        r.avgSpeed?.toFixed(1) ?? '',
        r.maxSpeed ?? '',
        r.fuelConsumed?.toFixed(2) ?? '',
        r.alertCount,
        r.overspeedCount,
        r.harshBrakingCount,
      ].join(',')
    }).join('\n')

    const csv = header + rows
    const filename = `daily-stats-${new Date().toISOString().split('T')[0]}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Failed to export daily stats:', error)
    return NextResponse.json({ error: 'Failed to export daily stats' }, { status: 500 })
  }
}
