import { NextRequest, NextResponse } from 'next/server'
import { db, routes, routeShapes, eq } from '@smart-city/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    const shapes = await db.select()
      .from(routeShapes)
      .where(eq(routeShapes.routeId, id))

    return NextResponse.json({
      routeId: id,
      routeNumber: route.number,
      routeName: route.name,
      color: route.color,
      shapes,
    })
  } catch (error) {
    console.error('Failed to fetch route shape:', error)
    return NextResponse.json({ error: 'Failed to fetch route shape' }, { status: 500 })
  }
}
