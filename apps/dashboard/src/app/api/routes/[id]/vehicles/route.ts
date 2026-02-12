import { NextRequest, NextResponse } from 'next/server'
import { db, devices, eq, and } from '@smart-city/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: routeId } = await params

    const matchedDevices = await db.select({
      id: devices.id,
      imei: devices.imei,
      name: devices.name,
      isOnline: devices.isOnline,
      lastSeen: devices.lastSeen,
      assignedRouteId: devices.assignedRouteId,
      currentDirection: devices.currentDirection,
      currentStopSequence: devices.currentStopSequence,
      scheduleAdherenceSeconds: devices.scheduleAdherenceSeconds,
      routeMatchConfidence: devices.routeMatchConfidence,
      lastMatchedAt: devices.lastMatchedAt,
    })
      .from(devices)
      .where(and(
        eq(devices.assignedRouteId, routeId),
        eq(devices.isOnline, true),
      ))

    return NextResponse.json(matchedDevices)
  } catch (error) {
    console.error('Failed to fetch route vehicles:', error)
    return NextResponse.json({ error: 'Failed to fetch route vehicles' }, { status: 500 })
  }
}
