import { db, eq, routes, routeStops, stops, schedules, sql } from '@smart-city/database'
import type { CreateRouteInput, UpdateRouteInput } from '../schemas/route.js'

export class RouteService {
  async list(page: number, limit: number) {
    const offset = (page - 1) * limit

    const [data, countResult] = await Promise.all([
      db.select().from(routes).limit(limit).offset(offset).orderBy(routes.number),
      db.select({ count: sql<number>`count(*)::int` }).from(routes),
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
    const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!route) {
      throw { statusCode: 404, message: 'Route not found' }
    }

    // Get stops for the route
    const routeStopsList = await db.select({
      id: routeStops.id,
      sequence: routeStops.sequence,
      direction: routeStops.direction,
      avgTimeFromStart: routeStops.avgTimeFromStart,
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

    // Get schedules
    const routeSchedules = await db.select()
      .from(schedules)
      .where(eq(schedules.routeId, id))
      .orderBy(schedules.departureTime)

    return { ...route, stops: routeStopsList, schedules: routeSchedules }
  }

  async create(input: CreateRouteInput) {
    const [route] = await db.insert(routes).values(input).returning()
    return route
  }

  async update(id: string, input: UpdateRouteInput) {
    const [existing] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Route not found' }
    }

    const [route] = await db.update(routes)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(routes.id, id))
      .returning()
    return route
  }

  async delete(id: string) {
    const [existing] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Route not found' }
    }

    await db.delete(routes).where(eq(routes.id, id))
    return { success: true }
  }
}
