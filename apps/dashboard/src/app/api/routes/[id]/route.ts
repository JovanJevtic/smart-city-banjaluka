import { NextRequest, NextResponse } from 'next/server'
import { db, routes, routeStops, routeShapes, stops, schedules, eq } from '@smart-city/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    // Get stops for the route
    const routeStopsList = await db.select({
      id: routeStops.id,
      sequence: routeStops.sequence,
      direction: routeStops.direction,
      avgTimeFromStart: routeStops.avgTimeFromStart,
      distanceFromStart: routeStops.distanceFromStart,
      stop: {
        id: stops.id,
        name: stops.name,
        code: stops.code,
        latitude: stops.latitude,
        longitude: stops.longitude,
      },
    })
      .from(routeStops)
      .innerJoin(stops, eq(routeStops.stopId, stops.id))
      .where(eq(routeStops.routeId, id))
      .orderBy(routeStops.sequence)

    // Get shapes
    const shapes = await db.select()
      .from(routeShapes)
      .where(eq(routeShapes.routeId, id))

    // Get schedules
    const routeSchedules = await db.select()
      .from(schedules)
      .where(eq(schedules.routeId, id))
      .orderBy(schedules.departureTime)

    return NextResponse.json({
      ...route,
      stops: routeStopsList,
      shapes,
      schedules: routeSchedules,
    })
  } catch (error) {
    console.error('Failed to fetch route:', error)
    return NextResponse.json({ error: 'Failed to fetch route' }, { status: 500 })
  }
}
