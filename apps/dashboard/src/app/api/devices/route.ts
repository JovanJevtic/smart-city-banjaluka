import { NextResponse } from 'next/server'
import { db, devices } from '@smart-city/database'

export async function GET() {
  try {
    const allDevices = await db.select({
      id: devices.id,
      imei: devices.imei,
      name: devices.name,
      model: devices.model,
      isOnline: devices.isOnline,
      lastSeen: devices.lastSeen,
    }).from(devices)

    return NextResponse.json(allDevices)
  } catch (error) {
    console.error('Failed to fetch devices:', error)
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
  }
}
