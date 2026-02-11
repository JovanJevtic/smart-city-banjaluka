import { db, eq, and, gte, lte, devices, vehicles, alerts, deviceDailyStats, sql } from '@smart-city/database'

export class AnalyticsService {
  async fleetSummary(from?: Date, to?: Date) {
    const now = new Date()
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days
    const dateFrom = from || defaultFrom
    const dateTo = to || now

    // Get device counts
    const [totalDevices] = await db.select({ count: sql<number>`count(*)::int` }).from(devices)
    const [onlineDevices] = await db.select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.isOnline, true))

    // Get vehicle counts
    const [totalVehicles] = await db.select({ count: sql<number>`count(*)::int` }).from(vehicles)

    // Get alert stats for period
    const [alertStats] = await db.select({
      total: sql<number>`count(*)::int`,
      unacknowledged: sql<number>`count(*) filter (where acknowledged = false)::int`,
    })
      .from(alerts)
      .where(and(
        gte(alerts.createdAt, dateFrom),
        lte(alerts.createdAt, dateTo),
      ))

    // Get aggregated stats from daily stats
    const fromDateStr = dateFrom.toISOString().split('T')[0]
    const toDateStr = dateTo.toISOString().split('T')[0]

    const [fleetStats] = await db.select({
      totalDistance: sql<number>`coalesce(sum(total_distance), 0)`,
      totalDrivingTime: sql<number>`coalesce(sum(driving_time), 0)`,
      totalIdleTime: sql<number>`coalesce(sum(idle_time), 0)`,
      avgSpeed: sql<number>`coalesce(avg(avg_speed), 0)`,
      maxSpeed: sql<number>`coalesce(max(max_speed), 0)`,
      totalFuelConsumed: sql<number>`coalesce(sum(fuel_consumed), 0)`,
    })
      .from(deviceDailyStats)
      .where(and(
        gte(deviceDailyStats.date, fromDateStr),
        lte(deviceDailyStats.date, toDateStr),
      ))

    return {
      period: { from: dateFrom, to: dateTo },
      devices: { total: totalDevices.count, online: onlineDevices.count },
      vehicles: { total: totalVehicles.count },
      alerts: { total: alertStats.total, unacknowledged: alertStats.unacknowledged },
      fleet: fleetStats,
    }
  }

  async vehicleStats(vehicleId: string, from?: Date, to?: Date) {
    const now = new Date()
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const dateFrom = from || defaultFrom
    const dateTo = to || now

    // Get vehicle with device
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1)
    if (!vehicle) {
      throw { statusCode: 404, message: 'Vehicle not found' }
    }

    const [device] = await db.select().from(devices)
      .where(eq(devices.vehicleId, vehicleId)).limit(1)

    if (!device) {
      return {
        vehicle,
        device: null,
        stats: null,
        message: 'No device assigned to this vehicle',
      }
    }

    const fromDateStr = dateFrom.toISOString().split('T')[0]
    const toDateStr = dateTo.toISOString().split('T')[0]

    const dailyStats = await db.select()
      .from(deviceDailyStats)
      .where(and(
        eq(deviceDailyStats.deviceId, device.id),
        gte(deviceDailyStats.date, fromDateStr),
        lte(deviceDailyStats.date, toDateStr),
      ))
      .orderBy(deviceDailyStats.date)

    const [aggregate] = await db.select({
      totalDistance: sql<number>`coalesce(sum(total_distance), 0)`,
      totalDrivingTime: sql<number>`coalesce(sum(driving_time), 0)`,
      totalIdleTime: sql<number>`coalesce(sum(idle_time), 0)`,
      avgSpeed: sql<number>`coalesce(avg(avg_speed), 0)`,
      maxSpeed: sql<number>`coalesce(max(max_speed), 0)`,
      totalFuelConsumed: sql<number>`coalesce(sum(fuel_consumed), 0)`,
      totalTrips: sql<number>`coalesce(sum(trip_count), 0)`,
      totalAlerts: sql<number>`coalesce(sum(alert_count), 0)`,
    })
      .from(deviceDailyStats)
      .where(and(
        eq(deviceDailyStats.deviceId, device.id),
        gte(deviceDailyStats.date, fromDateStr),
        lte(deviceDailyStats.date, toDateStr),
      ))

    return {
      vehicle,
      device: { id: device.id, imei: device.imei, isOnline: device.isOnline },
      period: { from: dateFrom, to: dateTo },
      summary: aggregate,
      daily: dailyStats,
    }
  }
}
