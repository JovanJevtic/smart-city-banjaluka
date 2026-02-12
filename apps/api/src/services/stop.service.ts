import { db, eq, stops, routeStops, routes, sql } from '@smart-city/database'

export class StopService {
  async list(page: number, limit: number, search?: string) {
    const offset = (page - 1) * limit

    const where = search
      ? sql`lower(${stops.name}) like ${`%${search.toLowerCase()}%`}`
      : undefined

    const [data, countResult] = await Promise.all([
      db.select().from(stops).where(where).limit(limit).offset(offset).orderBy(stops.name),
      db.select({ count: sql<number>`count(*)::int` }).from(stops).where(where),
    ])

    return {
      data,
      total: countResult[0].count,
      page,
      limit,
      totalPages: Math.ceil(countResult[0].count / limit),
    }
  }

  async getById(id: string) {
    const [stop] = await db.select().from(stops).where(eq(stops.id, id)).limit(1)
    if (!stop) {
      throw { statusCode: 404, message: 'Stop not found' }
    }

    // Get routes that serve this stop
    const servedBy = await db.select({
      routeId: routeStops.routeId,
      sequence: routeStops.sequence,
      direction: routeStops.direction,
      routeNumber: routes.number,
      routeName: routes.name,
      routeColor: routes.color,
    })
      .from(routeStops)
      .innerJoin(routes, eq(routeStops.routeId, routes.id))
      .where(eq(routeStops.stopId, id))
      .orderBy(routes.number)

    return { ...stop, routes: servedBy }
  }

  async nearby(lat: number, lng: number, radius: number) {
    // Approximate degree-to-meter conversion at Banja Luka latitude (~44.77°)
    // 1° latitude ≈ 111,320m, 1° longitude ≈ 111,320 * cos(44.77°) ≈ 79,000m
    const latDelta = radius / 111320
    const lngDelta = radius / 79000

    const data = await db.select().from(stops)
      .where(sql`
        ${stops.latitude} between ${lat - latDelta} and ${lat + latDelta}
        and ${stops.longitude} between ${lng - lngDelta} and ${lng + lngDelta}
      `)
      .orderBy(sql`
        (${stops.latitude} - ${lat}) * (${stops.latitude} - ${lat}) +
        (${stops.longitude} - ${lng}) * (${stops.longitude} - ${lng})
      `)
      .limit(50)

    // Add approximate distance
    return data.map(stop => ({
      ...stop,
      distance: Math.round(haversine(lat, lng, stop.latitude, stop.longitude)),
    }))
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
