/**
 * GTFS Static Feed Generator
 * Generates a GTFS-compliant ZIP file from the database.
 *
 * Usage:
 *   pnpm --filter @smart-city/database tsx src/scripts/generate-gtfs.ts [--output /path/to/output]
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { db, routes, stops, routeStops, routeShapes, schedules, scheduleEntries, eq, asc } from '../index.js'

const OUTPUT_DIR = process.argv.includes('--output')
  ? process.argv[process.argv.indexOf('--output') + 1]
  : path.join(process.cwd(), 'data', 'gtfs')

async function main() {
  console.log('Generating GTFS Static feed...')

  const tmpDir = path.join(OUTPUT_DIR, 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })

  // 1. agency.txt
  const agencyTxt = [
    'agency_id,agency_name,agency_url,agency_timezone,agency_lang,agency_phone',
    'pavlovic,Pavlovic Turs,https://busbanjaluka.com,Europe/Sarajevo,bs,051-244-498',
    'gradski,Gradski Prevoz,https://busbanjaluka.com,Europe/Sarajevo,bs,',
    'autoprevoz,Autoprevoz GS,https://autoprevoz-gs.com,Europe/Sarajevo,bs,',
  ].join('\n')
  fs.writeFileSync(path.join(tmpDir, 'agency.txt'), agencyTxt)
  console.log('  agency.txt')

  // 2. routes.txt
  const allRoutes = await db.select().from(routes).where(eq(routes.isActive, true)).orderBy(routes.number)
  const routeRows = allRoutes.map(r => {
    const agencyId = mapOperatorToAgency(r.operator)
    const color = (r.color || '').replace('#', '')
    return `${r.id},${agencyId},${r.number},"${escapeCsv(r.name)}",3,${color},FFFFFF`
  })
  fs.writeFileSync(path.join(tmpDir, 'routes.txt'),
    'route_id,agency_id,route_short_name,route_long_name,route_type,route_color,route_text_color\n' +
    routeRows.join('\n')
  )
  console.log(`  routes.txt (${allRoutes.length} routes)`)

  // 3. stops.txt
  const allStops = await db.select().from(stops)
  const stopRows = allStops.map(s =>
    `${s.id},"${escapeCsv(s.name)}",${s.latitude},${s.longitude},${s.wheelchairAccessible ? 1 : 0}`
  )
  fs.writeFileSync(path.join(tmpDir, 'stops.txt'),
    'stop_id,stop_name,stop_lat,stop_lon,wheelchair_boarding\n' +
    stopRows.join('\n')
  )
  console.log(`  stops.txt (${allStops.length} stops)`)

  // 4. calendar.txt
  const year = new Date().getFullYear()
  const calendarTxt = [
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
    `weekday,1,1,1,1,1,0,0,${year}0101,${year}1231`,
    `saturday,0,0,0,0,0,1,0,${year}0101,${year}1231`,
    `sunday,0,0,0,0,0,0,1,${year}0101,${year}1231`,
  ].join('\n')
  fs.writeFileSync(path.join(tmpDir, 'calendar.txt'), calendarTxt)
  console.log('  calendar.txt')

  // 5. trips.txt + stop_times.txt
  const allSchedules = await db.select().from(schedules).where(eq(schedules.isActive, true))
  const allEntries = await db.select().from(scheduleEntries)

  const tripRows: string[] = []
  const stopTimeRows: string[] = []
  let tripCount = 0

  for (const sched of allSchedules) {
    const serviceId = mapDaysToServiceId(sched.daysOfWeek)
    if (!serviceId) continue

    const tripId = `${sched.routeId}_${sched.direction}_${sched.departureTime.replace(/:/g, '')}_${serviceId}`
    const directionId = sched.direction === 'OUTBOUND' ? 0 : 1

    // Get route stops for this direction to find headsign
    const stopsForRoute = await db
      .select({ name: stops.name, sequence: routeStops.sequence })
      .from(routeStops)
      .innerJoin(stops, eq(routeStops.stopId, stops.id))
      .where(eq(routeStops.routeId, sched.routeId))
      .orderBy(asc(routeStops.sequence))

    const dirStops = stopsForRoute
    const headsign = dirStops.length > 0 ? dirStops[dirStops.length - 1].name : ''

    const shapeId = `${sched.routeId}_${sched.direction}`

    tripRows.push(`${tripId},${sched.routeId},${serviceId},${directionId},"${escapeCsv(headsign)}",${shapeId}`)

    // Stop times
    const entries = allEntries.filter(e => e.scheduleId === sched.id).sort((a, b) => a.sequence - b.sequence)
    const [depH, depM] = sched.departureTime.split(':').map(Number)
    const depBase = depH * 3600 + depM * 60

    for (const entry of entries) {
      const arrivalSec = depBase + entry.arrivalOffset
      const departureSec = depBase + entry.departureOffset
      stopTimeRows.push(`${tripId},${formatGtfsTime(arrivalSec)},${formatGtfsTime(departureSec)},${entry.stopId},${entry.sequence}`)
    }

    tripCount++
  }

  fs.writeFileSync(path.join(tmpDir, 'trips.txt'),
    'trip_id,route_id,service_id,direction_id,trip_headsign,shape_id\n' +
    tripRows.join('\n')
  )
  console.log(`  trips.txt (${tripCount} trips)`)

  fs.writeFileSync(path.join(tmpDir, 'stop_times.txt'),
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
    stopTimeRows.join('\n')
  )
  console.log(`  stop_times.txt (${stopTimeRows.length} stop times)`)

  // 6. shapes.txt
  const allShapes = await db.select().from(routeShapes)
  const shapeRows: string[] = []

  for (const shape of allShapes) {
    const shapeId = `${shape.routeId}_${shape.direction}`
    const coords = shape.geometry as [number, number][]
    if (!Array.isArray(coords)) continue

    let totalDist = 0
    coords.forEach(([lng, lat], i) => {
      if (i > 0) {
        const [prevLng, prevLat] = coords[i - 1]
        totalDist += haversine(prevLat, prevLng, lat, lng)
      }
      shapeRows.push(`${shapeId},${lat},${lng},${i + 1},${totalDist.toFixed(1)}`)
    })
  }

  fs.writeFileSync(path.join(tmpDir, 'shapes.txt'),
    'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled\n' +
    shapeRows.join('\n')
  )
  console.log(`  shapes.txt (${shapeRows.length} points)`)

  // 7. feed_info.txt
  const feedInfo = [
    'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version',
    `Smart City Banja Luka,https://busbanjaluka.com,bs,${year}0101,${year}1231,${new Date().toISOString().split('T')[0]}`,
  ].join('\n')
  fs.writeFileSync(path.join(tmpDir, 'feed_info.txt'), feedInfo)
  console.log('  feed_info.txt')

  // 8. ZIP
  const zipPath = path.join(OUTPUT_DIR, 'gtfs-banjaluka.zip')
  try {
    // Try using powershell Compress-Archive on Windows
    const files = fs.readdirSync(tmpDir).map(f => path.join(tmpDir, f)).join('","')
    execSync(`powershell -Command "Compress-Archive -Path '${files}' -DestinationPath '${zipPath}' -Force"`)
  } catch {
    try {
      // Try zip command on Linux
      execSync(`cd "${tmpDir}" && zip -j "${zipPath}" *.txt`)
    } catch {
      console.log('  WARNING: Could not create ZIP. Files are in:', tmpDir)
    }
  }

  if (fs.existsSync(zipPath)) {
    const size = (fs.statSync(zipPath).size / 1024).toFixed(1)
    console.log(`\nGTFS feed generated: ${zipPath} (${size} KB)`)
  }

  // Cleanup tmp
  try { fs.rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }

  process.exit(0)
}

function mapOperatorToAgency(operator: string | null): string {
  if (!operator) return 'gradski'
  const lower = operator.toLowerCase()
  if (lower.includes('pavlovic') || lower.includes('pavlović')) return 'pavlovic'
  if (lower.includes('autoprevoz')) return 'autoprevoz'
  return 'gradski'
}

function mapDaysToServiceId(days: number[] | null): string | null {
  if (!days || days.length === 0) return null
  const set = new Set(days)
  if (set.has(6) && set.size === 1) return 'saturday'
  if (set.has(0) && set.size === 1) return 'sunday'
  if ([1, 2, 3, 4, 5].every(d => set.has(d))) return 'weekday'
  return 'weekday' // fallback
}

function formatGtfsTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function escapeCsv(s: string): string {
  return (s || '').replace(/"/g, '""')
}

main().catch(err => {
  console.error('GTFS generation failed:', err)
  process.exit(1)
})
