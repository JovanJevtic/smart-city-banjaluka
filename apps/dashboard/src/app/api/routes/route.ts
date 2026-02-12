import { NextRequest, NextResponse } from 'next/server'
import { db, routes, routeStops, routeShapes, stops, sql, eq } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const withShapes = searchParams.get('withShapes') === 'true'

    const where = search
      ? sql`lower(${routes.name}) like ${`%${search.toLowerCase()}%`} or ${routes.number} like ${`%${search}%`}`
      : undefined

    const allRoutes = await db.select().from(routes).where(where).orderBy(routes.number)

    if (!withShapes) {
      // Add stop count per route
      const stopCounts = await db.select({
        routeId: routeStops.routeId,
        count: sql<number>`count(distinct ${routeStops.stopId})::int`,
      }).from(routeStops).groupBy(routeStops.routeId)

      const countMap = new Map(stopCounts.map(s => [s.routeId, s.count]))

      return NextResponse.json(allRoutes.map(r => ({
        ...r,
        stopCount: countMap.get(r.id) || 0,
      })))
    }

    // With shapes: include geometry for map display
    const shapes = await db.select().from(routeShapes)
    const shapeMap = new Map<string, typeof shapes>()
    for (const shape of shapes) {
      const existing = shapeMap.get(shape.routeId) || []
      existing.push(shape)
      shapeMap.set(shape.routeId, existing)
    }

    const stopCounts = await db.select({
      routeId: routeStops.routeId,
      count: sql<number>`count(distinct ${routeStops.stopId})::int`,
    }).from(routeStops).groupBy(routeStops.routeId)

    const countMap = new Map(stopCounts.map(s => [s.routeId, s.count]))

    return NextResponse.json(allRoutes.map(r => ({
      ...r,
      stopCount: countMap.get(r.id) || 0,
      shapes: shapeMap.get(r.id) || [],
    })))
  } catch (error) {
    console.error('Failed to fetch routes:', error)
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 })
  }
}
