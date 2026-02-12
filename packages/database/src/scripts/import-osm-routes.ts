/**
 * OSM Route & Stop Importer for Banja Luka Bus Network
 *
 * Fetches bus routes and stops from OpenStreetMap Overpass API,
 * parses route relations with geometry, and upserts into the database.
 *
 * Usage:
 *   pnpm --filter @smart-city/database tsx src/scripts/import-osm-routes.ts
 *   pnpm --filter @smart-city/database tsx src/scripts/import-osm-routes.ts --dry-run
 *   pnpm --filter @smart-city/database tsx src/scripts/import-osm-routes.ts --force
 */

import { db, eq, routes, stops, routeStops, routeShapes, osmImportLog } from '../index.js'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')

// ── Overpass types ──

interface OverpassResponse {
  version: number
  osm3s: { timestamp_osm_base: string }
  elements: OverpassElement[]
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
  members?: Array<{
    type: 'node' | 'way' | 'relation'
    ref: number
    role: string
  }>
  nodes?: number[]
}

// ── Parsed types ──

interface ParsedRoute {
  osmId: number
  ref: string
  name: string
  color: string | null
  operator: string | null
  interval: number | null
  operatingHours: string | null
  stopMembers: Array<{ osmId: number; role: string }>
  wayMembers: Array<{ osmId: number; role: string }>
}

interface ParsedStop {
  osmId: number
  name: string
  lat: number
  lon: number
  code: string | null
  shelter: boolean
  bench: boolean
  wheelchair: boolean
}

// ── Main ──

async function main() {
  console.log('=== OSM Route Importer for Banja Luka ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : FORCE ? 'FORCE' : 'NORMAL'}`)
  console.log()

  // Step 1: Fetch data from Overpass
  console.log('Fetching routes from Overpass API...')
  const routeData = await fetchOverpass(`
    [out:json][timeout:120];
    area["name"="Banja Luka"]["admin_level"="8"]->.city;
    relation["route"="bus"](area.city);
    out body;
    >;
    out skel qt;
  `)

  console.log('Fetching stops from Overpass API...')
  const stopData = await fetchOverpass(`
    [out:json][timeout:60];
    area["name"="Banja Luka"]["admin_level"="8"]->.city;
    node["highway"="bus_stop"](area.city);
    out body;
  `)

  const osmTimestamp = routeData.osm3s.timestamp_osm_base
  console.log(`OSM data timestamp: ${osmTimestamp}`)
  console.log(`Elements: ${routeData.elements.length} route elements, ${stopData.elements.length} stop nodes`)
  console.log()

  // Step 2: Build lookup maps
  const nodeMap = new Map<number, { lat: number; lon: number }>()
  const wayMap = new Map<number, number[]>()

  for (const el of routeData.elements) {
    if (el.type === 'node' && el.lat != null && el.lon != null) {
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon })
    }
    if (el.type === 'way' && el.nodes) {
      wayMap.set(el.id, el.nodes)
    }
  }

  // Step 3: Parse route relations
  const parsedRoutes: ParsedRoute[] = []
  const relations = routeData.elements.filter(e => e.type === 'relation')

  for (const rel of relations) {
    const tags = rel.tags || {}
    const ref = tags.ref || tags.name || `Route ${rel.id}`
    const name = tags.name || `Linija ${ref}`

    const stopMembers: ParsedRoute['stopMembers'] = []
    const wayMembers: ParsedRoute['wayMembers'] = []

    for (const member of rel.members || []) {
      if (member.type === 'node' && (member.role === 'stop' || member.role === 'platform' || member.role === '')) {
        stopMembers.push({ osmId: member.ref, role: member.role || 'stop' })
      }
      if (member.type === 'way') {
        wayMembers.push({ osmId: member.ref, role: member.role || 'forward' })
      }
    }

    const interval = tags.interval ? parseInt(tags.interval, 10) : null

    parsedRoutes.push({
      osmId: rel.id,
      ref,
      name,
      color: tags.colour || tags.color || null,
      operator: tags.operator || null,
      interval: isNaN(interval as number) ? null : interval,
      operatingHours: tags.opening_hours || null,
      stopMembers,
      wayMembers,
    })
  }

  console.log(`Parsed ${parsedRoutes.length} route relations`)

  // Step 4: Parse bus stop nodes
  const parsedStops: ParsedStop[] = []
  const allStopNodes = stopData.elements.filter(e => e.type === 'node')

  // Also collect stop nodes referenced in route members
  const routeStopNodeIds = new Set<number>()
  for (const route of parsedRoutes) {
    for (const sm of route.stopMembers) {
      routeStopNodeIds.add(sm.osmId)
    }
  }

  // Add stops from the dedicated stop query
  for (const node of allStopNodes) {
    if (node.lat == null || node.lon == null) continue
    const tags = node.tags || {}
    parsedStops.push({
      osmId: node.id,
      name: tags.name || `Stop ${node.id}`,
      lat: node.lat,
      lon: node.lon,
      code: tags.ref || null,
      shelter: tags.shelter === 'yes',
      bench: tags.bench === 'yes',
      wheelchair: tags.wheelchair === 'yes',
    })
  }

  // Add any route-referenced stops that weren't in the stop query
  for (const osmId of routeStopNodeIds) {
    if (parsedStops.some(s => s.osmId === osmId)) continue
    const node = nodeMap.get(osmId)
    if (node) {
      // Find tags from the route data elements
      const el = routeData.elements.find(e => e.type === 'node' && e.id === osmId)
      const tags = el?.tags || {}
      parsedStops.push({
        osmId,
        name: tags.name || `Stop ${osmId}`,
        lat: node.lat,
        lon: node.lon,
        code: tags.ref || null,
        shelter: tags.shelter === 'yes',
        bench: tags.bench === 'yes',
        wheelchair: tags.wheelchair === 'yes',
      })
    }
  }

  console.log(`Parsed ${parsedStops.length} bus stops`)
  console.log()

  if (DRY_RUN) {
    printSummary(parsedRoutes, parsedStops)
    console.log('\n=== DRY RUN — no database changes made ===')
    process.exit(0)
  }

  // Step 5: Upsert stops
  console.log('Importing stops...')
  const stopIdMap = new Map<number, string>() // osmNodeId → db id
  let stopsImported = 0

  for (const stop of parsedStops) {
    const [existing] = await db.select().from(stops).where(eq(stops.osmNodeId, stop.osmId)).limit(1)

    if (existing && !FORCE) {
      stopIdMap.set(stop.osmId, existing.id)
      continue
    }

    if (existing) {
      await db.update(stops).set({
        name: stop.name,
        latitude: stop.lat,
        longitude: stop.lon,
        code: stop.code,
        shelter: stop.shelter,
        bench: stop.bench,
        wheelchairAccessible: stop.wheelchair,
        updatedAt: new Date(),
      }).where(eq(stops.id, existing.id))
      stopIdMap.set(stop.osmId, existing.id)
    } else {
      const [inserted] = await db.insert(stops).values({
        name: stop.name,
        latitude: stop.lat,
        longitude: stop.lon,
        code: stop.code,
        osmNodeId: stop.osmId,
        shelter: stop.shelter,
        bench: stop.bench,
        wheelchairAccessible: stop.wheelchair,
      }).returning()
      stopIdMap.set(stop.osmId, inserted.id)
    }
    stopsImported++
  }
  console.log(`  Stops imported/updated: ${stopsImported}`)

  // Step 6: Upsert routes + shapes + route_stops
  console.log('Importing routes...')
  let routesImported = 0
  let routeStopsImported = 0
  let shapesImported = 0
  const errors: string[] = []

  for (const route of parsedRoutes) {
    try {
      // Upsert route
      const [existing] = await db.select().from(routes).where(eq(routes.osmRelationId, route.osmId)).limit(1)

      let routeId: string

      if (existing && !FORCE) {
        routeId = existing.id
      } else if (existing) {
        await db.update(routes).set({
          number: route.ref,
          name: route.name,
          color: route.color,
          operator: route.operator,
          intervalMinutes: route.interval,
          operatingHours: route.operatingHours,
          updatedAt: new Date(),
        }).where(eq(routes.id, existing.id))
        routeId = existing.id
      } else {
        const [inserted] = await db.insert(routes).values({
          number: route.ref,
          name: route.name,
          color: route.color,
          osmRelationId: route.osmId,
          operator: route.operator,
          intervalMinutes: route.interval,
          operatingHours: route.operatingHours,
        }).returning()
        routeId = inserted.id
      }

      routesImported++

      // Build geometry from ways
      const forwardWays = route.wayMembers.filter(w => w.role !== 'backward')
      const backwardWays = route.wayMembers.filter(w => w.role === 'backward')

      // Process OUTBOUND direction
      const outboundGeometry = resolveWayGeometry(forwardWays.map(w => w.osmId), wayMap, nodeMap)
      if (outboundGeometry.length > 0) {
        const distance = calculatePolylineDistance(outboundGeometry)
        await upsertShape(routeId, 'OUTBOUND', outboundGeometry, distance)
        shapesImported++
      }

      // Process INBOUND direction (if backward ways exist)
      if (backwardWays.length > 0) {
        const inboundGeometry = resolveWayGeometry(backwardWays.map(w => w.osmId), wayMap, nodeMap)
        if (inboundGeometry.length > 0) {
          const distance = calculatePolylineDistance(inboundGeometry)
          await upsertShape(routeId, 'INBOUND', inboundGeometry, distance)
          shapesImported++
        }
      }

      // Update route distance from outbound shape
      if (outboundGeometry.length > 0) {
        const dist = calculatePolylineDistance(outboundGeometry)
        await db.update(routes).set({ distanceMeters: dist }).where(eq(routes.id, routeId))
      }

      // Upsert route-stop associations
      // Clear existing for this route if forcing
      if (FORCE) {
        await db.delete(routeStops).where(eq(routeStops.routeId, routeId))
      }

      // Separate stop members by role/position
      // Stops in the first half are likely outbound, second half inbound
      // But better: use platform/stop role and order
      const routeStopOsmIds = route.stopMembers.map(s => s.osmId)

      // Simple approach: all stops are OUTBOUND for now, ordered by sequence
      let sequence = 1
      const addedStops = new Set<string>()
      for (const osmId of routeStopOsmIds) {
        const stopDbId = stopIdMap.get(osmId)
        if (!stopDbId) continue
        const key = `${routeId}:${stopDbId}:OUTBOUND`
        if (addedStops.has(key)) continue
        addedStops.add(key)

        // Calculate distance from start along the route
        let distFromStart: number | null = null
        if (outboundGeometry.length > 0) {
          const stopCoord = nodeMap.get(osmId)
          if (stopCoord) {
            distFromStart = distanceAlongPolyline(outboundGeometry, stopCoord.lat, stopCoord.lon)
          }
        }

        // Check if this route-stop already exists
        const [existingRs] = await db.select().from(routeStops)
          .where(eq(routeStops.routeId, routeId))
          .limit(1)

        if (!existingRs || FORCE) {
          try {
            await db.insert(routeStops).values({
              routeId,
              stopId: stopDbId,
              sequence,
              direction: 'OUTBOUND',
              distanceFromStart: distFromStart,
            }).onConflictDoUpdate({
              target: [routeStops.routeId, routeStops.stopId, routeStops.direction],
              set: {
                sequence,
                distanceFromStart: distFromStart,
              },
            })
            routeStopsImported++
          } catch (err) {
            // Ignore duplicate conflicts
          }
        }

        sequence++
      }

      console.log(`  Route ${route.ref} "${route.name}" — ${routeStopOsmIds.length} stops, ${outboundGeometry.length} shape points`)
    } catch (err) {
      const msg = `Error importing route ${route.ref} (OSM ${route.osmId}): ${err}`
      errors.push(msg)
      console.error(`  ${msg}`)
    }
  }

  // Step 7: Log import
  await db.insert(osmImportLog).values({
    importType: 'full',
    osmTimestamp,
    routesImported,
    stopsImported,
    routeStopsImported,
    shapesImported,
    errors: errors.length > 0 ? errors : null,
  })

  console.log()
  console.log('=== Import Complete ===')
  console.log(`  Routes: ${routesImported}`)
  console.log(`  Stops: ${stopsImported}`)
  console.log(`  Route-Stop links: ${routeStopsImported}`)
  console.log(`  Shapes: ${shapesImported}`)
  if (errors.length > 0) {
    console.log(`  Errors: ${errors.length}`)
  }

  process.exit(0)
}

// ── Helpers ──

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query.trim())}`,
  })

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<OverpassResponse>
}

function resolveWayGeometry(
  wayIds: number[],
  wayMap: Map<number, number[]>,
  nodeMap: Map<number, { lat: number; lon: number }>,
): Array<[number, number]> {
  const coords: Array<[number, number]> = [] // [lng, lat]

  for (const wayId of wayIds) {
    const nodeIds = wayMap.get(wayId)
    if (!nodeIds) continue

    const wayCoords: Array<[number, number]> = []
    for (const nodeId of nodeIds) {
      const node = nodeMap.get(nodeId)
      if (node) {
        wayCoords.push([node.lon, node.lat])
      }
    }

    if (wayCoords.length === 0) continue

    // Chain ways: if the last point of coords matches the first of this way, append
    // If it matches the last, reverse this way then append
    if (coords.length === 0) {
      coords.push(...wayCoords)
    } else {
      const lastCoord = coords[coords.length - 1]
      const firstWay = wayCoords[0]
      const lastWay = wayCoords[wayCoords.length - 1]

      const distToFirst = haversine(lastCoord[1], lastCoord[0], firstWay[1], firstWay[0])
      const distToLast = haversine(lastCoord[1], lastCoord[0], lastWay[1], lastWay[0])

      if (distToLast < distToFirst) {
        // Reverse the way to chain properly
        wayCoords.reverse()
      }

      // Skip the first point if it matches the last (avoid duplicates)
      const startIdx = haversine(lastCoord[1], lastCoord[0], wayCoords[0][1], wayCoords[0][0]) < 10 ? 1 : 0
      coords.push(...wayCoords.slice(startIdx))
    }
  }

  return coords
}

async function upsertShape(routeId: string, direction: 'OUTBOUND' | 'INBOUND', geometry: Array<[number, number]>, distance: number) {
  const [existing] = await db.select().from(routeShapes)
    .where(eq(routeShapes.routeId, routeId))
    .limit(1)

  if (existing) {
    await db.update(routeShapes).set({
      geometry,
      distanceMeters: distance,
    }).where(eq(routeShapes.id, existing.id))
  } else {
    await db.insert(routeShapes).values({
      routeId,
      direction,
      geometry,
      distanceMeters: distance,
    })
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

function calculatePolylineDistance(coords: Array<[number, number]>): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
  }
  return total
}

function distanceAlongPolyline(polyline: Array<[number, number]>, lat: number, lng: number): number {
  let minDist = Infinity
  let distAlong = 0
  let bestDistAlong = 0

  for (let i = 0; i < polyline.length; i++) {
    const dist = haversine(lat, lng, polyline[i][1], polyline[i][0])
    if (i > 0) {
      distAlong += haversine(polyline[i - 1][1], polyline[i - 1][0], polyline[i][1], polyline[i][0])
    }
    if (dist < minDist) {
      minDist = dist
      bestDistAlong = distAlong
    }
  }

  return bestDistAlong
}

function printSummary(parsedRoutes: ParsedRoute[], parsedStops: ParsedStop[]) {
  console.log('\n--- Routes ---')
  for (const r of parsedRoutes) {
    console.log(`  ${r.ref.padEnd(6)} ${r.name.padEnd(50)} stops:${r.stopMembers.length} ways:${r.wayMembers.length} op:${r.operator || '?'}`)
  }
  console.log(`\n--- Stops: ${parsedStops.length} total ---`)
  const namedStops = parsedStops.filter(s => !s.name.startsWith('Stop '))
  console.log(`  Named: ${namedStops.length}, Unnamed: ${parsedStops.length - namedStops.length}`)
}

main().catch(err => {
  console.error('Import failed:', err)
  process.exit(1)
})
