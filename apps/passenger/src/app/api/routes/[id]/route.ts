import { NextRequest, NextResponse } from 'next/server'
import { db, routes, routeStops, routeShapes, stops, schedules, eq, asc } from '@smart-city/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Stops for this route
    const routeStopsList = await db
      .select({
        id: routeStops.id,
        stopId: routeStops.stopId,
        sequence: routeStops.sequence,
        direction: routeStops.direction,
        name: stops.name,
        latitude: stops.latitude,
        longitude: stops.longitude,
      })
      .from(routeStops)
      .innerJoin(stops, eq(routeStops.stopId, stops.id))
      .where(eq(routeStops.routeId, id))
      .orderBy(asc(routeStops.direction), asc(routeStops.sequence))

    // Shapes
    const shapes = await db
      .select()
      .from(routeShapes)
      .where(eq(routeShapes.routeId, id))

    // Schedules
    const routeSchedules = await db
      .select()
      .from(schedules)
      .where(eq(schedules.routeId, id))

    return NextResponse.json({
      ...route,
      stops: routeStopsList,
      shapes: shapes.map(s => ({
        id: s.id,
        direction: s.direction,
        coordinates: s.geometry as [number, number][],
      })),
      schedules: routeSchedules,
    })
  } catch (error) {
    console.error('Failed to fetch route:', error)
    return NextResponse.json({ error: 'Failed to fetch route' }, { status: 500 })
  }
}
