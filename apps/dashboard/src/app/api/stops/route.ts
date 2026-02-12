import { NextRequest, NextResponse } from 'next/server'
import { db, stops, sql } from '@smart-city/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = (page - 1) * limit

    const where = search
      ? sql`lower(${stops.name}) like ${`%${search.toLowerCase()}%`}`
      : undefined

    const [data, countResult] = await Promise.all([
      db.select().from(stops).where(where).limit(limit).offset(offset).orderBy(stops.name),
      db.select({ count: sql<number>`count(*)::int` }).from(stops).where(where),
    ])

    return NextResponse.json({
      data,
      total: countResult[0].count,
      page,
      limit,
    })
  } catch (error) {
    console.error('Failed to fetch stops:', error)
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 })
  }
}
