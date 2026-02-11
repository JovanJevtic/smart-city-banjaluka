import { db, eq, devices, sql } from '@smart-city/database'
import type { CreateDeviceInput, UpdateDeviceInput } from '../schemas/device.js'

export class DeviceService {
  async list(page: number, limit: number) {
    const offset = (page - 1) * limit

    const [data, countResult] = await Promise.all([
      db.select().from(devices).limit(limit).offset(offset).orderBy(devices.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(devices),
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
    const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1)
    if (!device) {
      throw { statusCode: 404, message: 'Device not found' }
    }
    return device
  }

  async getByImei(imei: string) {
    const [device] = await db.select().from(devices).where(eq(devices.imei, imei)).limit(1)
    if (!device) {
      throw { statusCode: 404, message: 'Device not found' }
    }
    return device
  }

  async create(input: CreateDeviceInput) {
    const [existing] = await db.select().from(devices).where(eq(devices.imei, input.imei)).limit(1)
    if (existing) {
      throw { statusCode: 409, message: 'Device with this IMEI already exists' }
    }

    const [device] = await db.insert(devices).values(input).returning()
    return device
  }

  async update(id: string, input: UpdateDeviceInput) {
    const [existing] = await db.select().from(devices).where(eq(devices.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Device not found' }
    }

    const [device] = await db.update(devices)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning()
    return device
  }

  async delete(id: string) {
    const [existing] = await db.select().from(devices).where(eq(devices.id, id)).limit(1)
    if (!existing) {
      throw { statusCode: 404, message: 'Device not found' }
    }

    await db.delete(devices).where(eq(devices.id, id))
    return { success: true }
  }
}
