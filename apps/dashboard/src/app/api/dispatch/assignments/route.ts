import { NextRequest, NextResponse } from 'next/server'
import { db, routeAssignments, routes, devices, eq, and } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const routeId = request.nextUrl.searchParams.get('routeId')
    const active = request.nextUrl.searchParams.get('active')

    const conditions = []
    if (routeId) conditions.push(eq(routeAssignments.routeId, routeId))
    if (active === 'true') conditions.push(eq(routeAssignments.isActive, true))

    const assignments = await db
      .select()
      .from(routeAssignments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(routeAssignments.createdAt)

    // Enrich with route + device info
    const allRoutes = await db.select({ id: routes.id, number: routes.number, name: routes.name }).from(routes)
    const allDevices = await db.select({ id: devices.id, imei: devices.imei, name: devices.name, vehicleId: devices.vehicleId }).from(devices)
    const routeMap = new Map(allRoutes.map(r => [r.id, r]))
    const deviceMap = new Map(allDevices.map(d => [d.id, d]))

    // Map vehicleId from assignments to devices (vehicleId on device table points to vehicles table)
    const result = assignments.map(a => {
      const route = routeMap.get(a.routeId)
      // Find device with matching vehicleId
      const device = [...deviceMap.values()].find(d => d.vehicleId === a.vehicleId) || deviceMap.get(a.vehicleId)
      return {
        ...a,
        routeNumber: route?.number || '?',
        routeName: route?.name || '',
        deviceName: device?.name || null,
        deviceImei: device?.imei || null,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch assignments:', error)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vehicleId, routeId, shift, startDate } = body

    if (!vehicleId || !routeId) {
      return NextResponse.json({ error: 'vehicleId and routeId are required' }, { status: 400 })
    }

    const [assignment] = await db.insert(routeAssignments).values({
      vehicleId,
      routeId,
      shift: shift || 'ALL_DAY',
      startDate: new Date(startDate || Date.now()),
      isActive: true,
    }).returning()

    // Also update the device's assignedRouteId
    const device = await db.select().from(devices).where(eq(devices.vehicleId, vehicleId)).limit(1)
    if (device.length > 0) {
      await db.update(devices).set({ assignedRouteId: routeId }).where(eq(devices.id, device[0].id))
    }

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Failed to create assignment:', error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
