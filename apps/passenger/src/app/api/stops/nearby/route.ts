import { NextRequest, NextResponse } from 'next/server'
import { db, stops } from '@smart-city/database'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(request: NextRequest) {
  try {
    const lat = parseFloat(request.nextUrl.searchParams.get('lat') || '')
    const lng = parseFloat(request.nextUrl.searchParams.get('lng') || '')
    const radius = parseInt(request.nextUrl.searchParams.get('radius') || '500', 10)
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10)

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }

    const allStops = await db.select().from(stops)

    const nearby = allStops
      .map(s => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        zone: s.zone,
        wheelchairAccessible: s.wheelchairAccessible,
        distance: Math.round(haversine(lat, lng, s.latitude, s.longitude)),
      }))
      .filter(s => s.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)

    return NextResponse.json(nearby)
  } catch (error) {
    console.error('Failed to fetch nearby stops:', error)
    return NextResponse.json({ error: 'Failed to fetch nearby stops' }, { status: 500 })
  }
}
