import { FastifyInstance } from 'fastify'
import * as protobuf from 'protobufjs'
import { db, devices, etaPredictions, alerts, telemetryRecords, eq, desc, gte, and } from '@smart-city/database'
import * as fs from 'fs'

// Build GTFS-RT proto type at startup
let FeedMessage: protobuf.Type

async function loadProto() {
  // Define GTFS-RT schema inline (subset needed for our feeds)
  const root = new protobuf.Root()

  root.define('transit_realtime').add(
    new protobuf.Type('FeedMessage')
      .add(new protobuf.Field('header', 1, 'FeedHeader'))
      .add(new protobuf.Field('entity', 2, 'FeedEntity', 'repeated'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('FeedHeader')
      .add(new protobuf.Field('gtfs_realtime_version', 1, 'string'))
      .add(new protobuf.Field('incrementality', 2, 'uint32'))
      .add(new protobuf.Field('timestamp', 3, 'uint64'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('FeedEntity')
      .add(new protobuf.Field('id', 1, 'string'))
      .add(new protobuf.Field('vehicle', 3, 'VehiclePosition'))
      .add(new protobuf.Field('trip_update', 4, 'TripUpdate'))
      .add(new protobuf.Field('alert', 5, 'Alert'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('VehiclePosition')
      .add(new protobuf.Field('trip', 1, 'TripDescriptor'))
      .add(new protobuf.Field('position', 2, 'Position'))
      .add(new protobuf.Field('current_stop_sequence', 3, 'uint32'))
      .add(new protobuf.Field('timestamp', 5, 'uint64'))
      .add(new protobuf.Field('vehicle', 8, 'VehicleDescriptor'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('Position')
      .add(new protobuf.Field('latitude', 1, 'float'))
      .add(new protobuf.Field('longitude', 2, 'float'))
      .add(new protobuf.Field('bearing', 3, 'float'))
      .add(new protobuf.Field('speed', 4, 'float'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('TripDescriptor')
      .add(new protobuf.Field('trip_id', 1, 'string'))
      .add(new protobuf.Field('route_id', 2, 'string'))
      .add(new protobuf.Field('direction_id', 3, 'uint32'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('VehicleDescriptor')
      .add(new protobuf.Field('id', 1, 'string'))
      .add(new protobuf.Field('label', 2, 'string'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('TripUpdate')
      .add(new protobuf.Field('trip', 1, 'TripDescriptor'))
      .add(new protobuf.Field('vehicle', 3, 'VehicleDescriptor'))
      .add(new protobuf.Field('stop_time_update', 4, 'StopTimeUpdate', 'repeated'))
      .add(new protobuf.Field('timestamp', 5, 'uint64'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('StopTimeUpdate')
      .add(new protobuf.Field('stop_sequence', 1, 'uint32'))
      .add(new protobuf.Field('stop_id', 4, 'string'))
      .add(new protobuf.Field('arrival', 2, 'StopTimeEvent'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('StopTimeEvent')
      .add(new protobuf.Field('delay', 1, 'int32'))
      .add(new protobuf.Field('time', 2, 'int64'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('Alert')
      .add(new protobuf.Field('active_period', 1, 'TimeRange', 'repeated'))
      .add(new protobuf.Field('informed_entity', 5, 'EntitySelector', 'repeated'))
      .add(new protobuf.Field('header_text', 10, 'TranslatedString'))
      .add(new protobuf.Field('description_text', 11, 'TranslatedString'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('TimeRange')
      .add(new protobuf.Field('start', 1, 'uint64'))
      .add(new protobuf.Field('end', 2, 'uint64'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('EntitySelector')
      .add(new protobuf.Field('route_id', 3, 'string'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('TranslatedString')
      .add(new protobuf.Field('translation', 1, 'Translation', 'repeated'))
  )

  root.define('transit_realtime').add(
    new protobuf.Type('Translation')
      .add(new protobuf.Field('text', 1, 'string'))
      .add(new protobuf.Field('language', 2, 'string'))
  )

  root.resolveAll()
  FeedMessage = root.lookupType('transit_realtime.FeedMessage')
}

function makeHeader() {
  return {
    gtfs_realtime_version: '2.0',
    incrementality: 0, // FULL_DATASET
    timestamp: Math.floor(Date.now() / 1000),
  }
}

export default async function gtfsRtRoutes(fastify: FastifyInstance) {
  await loadProto()

  // GET /gtfs-rt/vehicle-positions — public, no auth
  fastify.get('/gtfs-rt/vehicle-positions', async (_request, reply) => {
    const cacheKey = 'gtfs-rt:vehicle-positions'
    const cached = await fastify.redis.getBuffer(cacheKey)
    if (cached) {
      return reply.header('Content-Type', 'application/x-protobuf').send(cached)
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const onlineDevices = await db.select().from(devices).where(eq(devices.isOnline, true))
    const active = onlineDevices.filter(d => d.lastSeen && d.lastSeen > fiveMinAgo)

    const entities = await Promise.all(active.map(async (d) => {
      const [latest] = await db
        .select({
          latitude: telemetryRecords.latitude,
          longitude: telemetryRecords.longitude,
          speed: telemetryRecords.speed,
          heading: telemetryRecords.heading,
        })
        .from(telemetryRecords)
        .where(eq(telemetryRecords.deviceId, d.id))
        .orderBy(desc(telemetryRecords.timestamp))
        .limit(1)

      if (!latest) return null

      return {
        id: d.id,
        vehicle: {
          trip: d.assignedRouteId ? {
            route_id: d.assignedRouteId,
            direction_id: d.currentDirection === 'INBOUND' ? 1 : 0,
          } : undefined,
          position: {
            latitude: latest.latitude,
            longitude: latest.longitude,
            bearing: latest.heading ?? 0,
            speed: (latest.speed ?? 0) / 3.6, // km/h to m/s
          },
          current_stop_sequence: d.currentStopSequence ?? 0,
          timestamp: Math.floor((d.lastSeen?.getTime() ?? Date.now()) / 1000),
          vehicle: {
            id: d.id,
            label: d.name || d.imei,
          },
        },
      }
    }))

    const feed = {
      header: makeHeader(),
      entity: entities.filter(Boolean),
    }

    const buffer = Buffer.from(FeedMessage.encode(FeedMessage.create(feed)).finish())

    // Cache for 5 seconds
    await fastify.redis.set(cacheKey, buffer, 'EX', 5)

    return reply.header('Content-Type', 'application/x-protobuf').send(buffer)
  })

  // GET /gtfs-rt/trip-updates — public, no auth
  fastify.get('/gtfs-rt/trip-updates', async (_request, reply) => {
    const cacheKey = 'gtfs-rt:trip-updates'
    const cached = await fastify.redis.getBuffer(cacheKey)
    if (cached) {
      return reply.header('Content-Type', 'application/x-protobuf').send(cached)
    }

    const now = new Date()
    const predictions = await db
      .select()
      .from(etaPredictions)
      .where(gte(etaPredictions.predictedArrival, now))
      .orderBy(etaPredictions.deviceId, etaPredictions.predictedArrival)

    // Group by device
    const byDevice = new Map<string, typeof predictions>()
    for (const p of predictions) {
      const arr = byDevice.get(p.deviceId) || []
      arr.push(p)
      byDevice.set(p.deviceId, arr)
    }

    const entities = Array.from(byDevice.entries()).map(([deviceId, preds]) => {
      const first = preds[0]
      return {
        id: `trip_${deviceId}`,
        trip_update: {
          trip: {
            route_id: first.routeId,
            direction_id: first.direction === 'INBOUND' ? 1 : 0,
          },
          vehicle: { id: deviceId },
          stop_time_update: preds.map(p => ({
            stop_id: p.stopId,
            arrival: {
              time: Math.floor(p.predictedArrival.getTime() / 1000),
              delay: p.delaySeconds ?? 0,
            },
          })),
          timestamp: Math.floor(Date.now() / 1000),
        },
      }
    })

    const feed = {
      header: makeHeader(),
      entity: entities,
    }

    const buffer = Buffer.from(FeedMessage.encode(FeedMessage.create(feed)).finish())

    // Cache for 15 seconds
    await fastify.redis.set(cacheKey, buffer, 'EX', 15)

    return reply.header('Content-Type', 'application/x-protobuf').send(buffer)
  })

  // GET /gtfs-rt/service-alerts — public, no auth
  fastify.get('/gtfs-rt/service-alerts', async (_request, reply) => {
    const cacheKey = 'gtfs-rt:service-alerts'
    const cached = await fastify.redis.getBuffer(cacheKey)
    if (cached) {
      return reply.header('Content-Type', 'application/x-protobuf').send(cached)
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentAlerts = await db
      .select()
      .from(alerts)
      .where(
        and(
          gte(alerts.createdAt, oneDayAgo),
          eq(alerts.acknowledged, false),
        )
      )
      .orderBy(desc(alerts.createdAt))
      .limit(50)

    const entities = recentAlerts.map(a => ({
      id: a.id,
      alert: {
        active_period: [{
          start: Math.floor(a.createdAt.getTime() / 1000),
        }],
        informed_entity: a.deviceId ? [{ route_id: a.deviceId }] : [],
        header_text: {
          translation: [{
            text: `${a.type}: ${a.message || ''}`,
            language: 'bs',
          }],
        },
      },
    }))

    const feed = {
      header: makeHeader(),
      entity: entities,
    }

    const buffer = Buffer.from(FeedMessage.encode(FeedMessage.create(feed)).finish())

    // Cache for 60 seconds
    await fastify.redis.set(cacheKey, buffer, 'EX', 60)

    return reply.header('Content-Type', 'application/x-protobuf').send(buffer)
  })

  // GET /gtfs/static — serve the GTFS ZIP file
  fastify.get('/gtfs/static', async (_request, reply) => {
    const zipPath = '/opt/smart-city/data/gtfs/gtfs-banjaluka.zip'
    if (!fs.existsSync(zipPath)) {
      return reply.code(404).send({ error: 'GTFS feed not generated yet' })
    }

    const stream = fs.createReadStream(zipPath)
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', 'attachment; filename="gtfs-banjaluka.zip"')
      .send(stream)
  })
}
