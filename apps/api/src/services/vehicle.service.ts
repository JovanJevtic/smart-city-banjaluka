import { db, eq, vehicles, devices, sql } from '@smart-city/database'
import type { CreateVehicleInput, UpdateVehicleInput } from '../schemas/vehicle.js'

export class VehicleService {
  async list(page: number, limit: number) {
    const offset = (page - 1) * limit

    const [data, countResult] = await Promise.all([
      db.select().from(vehicles).limit(limit).offset(offset).orderBy(vehicles.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(vehicles),
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
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1)
    if (!vehicle) {
      throw { statusCode: 404, message: 'Vehicle not found' }
    }

    // Get assigned device if any
    const [device] = await db.select().from(devices)
      .where(eq(devices.vehicleId, id)).limit(1)

    return { ...vehicle, device: device || null }
  }

  async create(input: CreateVehicleInput) {
    const [existing] = await db.select().from(vehicles)
      .where(eq(vehicles.registrationNo, input.registrationNo)).limit(1)
    if (existing) {
      throw { statusCode: 409, message: 'Vehicle with this registration already exists' }
    }

    const [vehicle] = await db.insert(vehicles).values(input).returning()
    return vehicle
  }

  async update(id: string, input: UpdateVehicleInput) {
    const [existing] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Vehicle not found' }
    }

    const [vehicle] = await db.update(vehicles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning()
    return vehicle
  }

  async delete(id: string) {
    const [existing] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Vehicle not found' }
    }

    await db.delete(vehicles).where(eq(vehicles.id, id))
    return { success: true }
  }
}
