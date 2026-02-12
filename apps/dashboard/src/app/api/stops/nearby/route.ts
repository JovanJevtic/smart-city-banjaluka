import { NextRequest, NextResponse } from 'next/server'
import { db, stops, sql } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius = parseInt(searchParams.get('radius') || '500', 10)

    if (lat === 0 || lng === 0) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }

    // Approximate degree-to-meter at Banja Luka latitude (~44.77°)
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

    // Add approximate distance using haversine
    const results = data.map(stop => ({
      ...stop,
      distance: Math.round(haversine(lat, lng, stop.latitude, stop.longitude)),
    }))

    return NextResponse.json(results)
  } catch (error) {
    console.error('Failed to fetch nearby stops:', error)
    return NextResponse.json({ error: 'Failed to fetch nearby stops' }, { status: 500 })
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
