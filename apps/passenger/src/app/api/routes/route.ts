import { NextRequest, NextResponse } from 'next/server'
import { db, routes, routeStops, eq, sql } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') || ''

    const allRoutes = await db.select().from(routes).orderBy(routes.number)

    // Get stop counts per route
    const stopCounts = await db
      .select({
        routeId: routeStops.routeId,
        count: sql<number>`count(DISTINCT ${routeStops.stopId})`,
      })
      .from(routeStops)
      .groupBy(routeStops.routeId)

    const countMap = new Map(stopCounts.map(s => [s.routeId, Number(s.count)]))

    let result = allRoutes.map(r => ({
      id: r.id,
      number: r.number,
      name: r.name,
      color: r.color,
      operator: r.operator,
      intervalMinutes: r.intervalMinutes,
      operatingHours: r.operatingHours,
      distanceMeters: r.distanceMeters,
      isActive: r.isActive,
      stopCount: countMap.get(r.id) || 0,
    }))

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.number.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.operator && r.operator.toLowerCase().includes(q))
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch routes:', error)
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 })
  }
}
