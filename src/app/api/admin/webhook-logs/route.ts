import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { paddleEvents } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { getTenantContext } from '@/lib/multi-tenant'

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context to verify admin access
    const context = await getTenantContext()
    if (!context || !context.permissions.includes('admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const eventType = searchParams.get('eventType')

    // Build query conditions
    let whereCondition
    if (eventType) {
      whereCondition = eq(paddleEvents.eventType, eventType)
    }

    // Get webhook events
    const events = await db.query.paddleEvents.findMany({
      where: whereCondition,
      limit: Math.min(limit, 100), // Cap at 100
      offset,
      orderBy: [desc(paddleEvents.createdAt)],
    })

    // Get total count for pagination
    const totalCount = await db.$count(paddleEvents, whereCondition)

    const formattedEvents = events.map(event => ({
      id: event.id,
      eventId: event.eventId,
      eventType: event.eventType,
      processed: event.processed,
      processingDurationMs: event.processingDurationMs,
      createdAt: event.createdAt,
      processedAt: event.processedAt,
      error: event.error,
      payload: event.payload,
    }))

    return NextResponse.json({
      events: formattedEvents,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    })
  } catch (error) {
    console.error('Get webhook logs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhook logs' },
      { status: 500 }
    )
  }
}

// Add eq import
import { eq } from 'drizzle-orm'