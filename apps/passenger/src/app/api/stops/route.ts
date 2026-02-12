import { NextRequest, NextResponse } from 'next/server'
import { db, stops } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') || ''
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10)

    let allStops = await db.select().from(stops).limit(Math.min(limit, 500))

    if (search) {
      const q = search.toLowerCase()
      allStops = allStops.filter(s => s.name.toLowerCase().includes(q))
    }

    return NextResponse.json({
      stops: allStops.map(s => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        zone: s.zone,
        wheelchairAccessible: s.wheelchairAccessible,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch stops:', error)
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 })
  }
}
