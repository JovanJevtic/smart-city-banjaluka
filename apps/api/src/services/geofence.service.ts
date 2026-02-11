import { db, eq, geofences, sql } from '@smart-city/database'
import type { CreateGeofenceInput, UpdateGeofenceInput } from '../schemas/geofence.js'

export class GeofenceService {
  async list(page: number, limit: number) {
    const offset = (page - 1) * limit

    const [data, countResult] = await Promise.all([
      db.select().from(geofences).limit(limit).offset(offset).orderBy(geofences.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(geofences),
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
    const [geofence] = await db.select().from(geofences).where(eq(geofences.id, id)).limit(1)
    if (!geofence) {
      throw { statusCode: 404, message: 'Geofence not found' }
    }
    return geofence
  }

  async create(input: CreateGeofenceInput) {
    const [geofence] = await db.insert(geofences).values({
      name: input.name,
      type: input.type,
      centerLat: input.centerLat,
      centerLng: input.centerLng,
      radius: input.radius,
      polygon: input.polygon,
      alertOnEnter: input.alertOnEnter,
      alertOnExit: input.alertOnExit,
      speedLimit: input.speedLimit,
    }).returning()
    return geofence
  }

  async update(id: string, input: UpdateGeofenceInput) {
    const [existing] = await db.select().from(geofences).where(eq(geofences.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Geofence not found' }
    }

    const [geofence] = await db.update(geofences)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(geofences.id, id))
      .returning()
    return geofence
  }

  async delete(id: string) {
    const [existing] = await db.select().from(geofences).where(eq(geofences.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Geofence not found' }
    }

    await db.delete(geofences).where(eq(geofences.id, id))
    return { success: true }
  }
}
