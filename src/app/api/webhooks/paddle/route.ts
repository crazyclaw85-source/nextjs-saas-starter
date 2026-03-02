import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { organizations, paddleEvents } from '@/lib/db/schema'
import { paddle } from '@/lib/paddle'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('paddle-signature')
    
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }
    
    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature, WEBHOOK_SECRET)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    
    const event = JSON.parse(body)
    const eventId = event.event_id
    const eventType = event.event_type
    
    // Check for duplicate events
    const existing = await db.query.paddleEvents.findFirst({
      where: eq(paddleEvents.eventId, eventId),
    })
    
    if (existing) {
      return NextResponse.json({ message: 'Event already processed' })
    }
    
    // Store event
    const [paddleEvent] = await db.insert(paddleEvents).values({
      eventId,
      eventType,
      payload: event,
    }).returning()
    
    // Process the event
    await processPaddleEvent(eventType, event.data)
    
    // Mark as processed
    await db.update(paddleEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(paddleEvents.id, paddleEvent.id))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Paddle webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body)
    const computed = hmac.digest('hex')
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
  } catch {
    return false
  }
}

async function processPaddleEvent(eventType: string, data: any) {
  const organizationId = data.custom_data?.organizationId
  if (!organizationId) return
  
  switch (eventType) {
    case 'subscription.created':
    case 'subscription.updated':
      await handleSubscriptionUpdate(organizationId, data)
      break
    case 'subscription.canceled':
      await handleSubscriptionCancel(organizationId, data)
      break
  }
}

async function handleSubscriptionUpdate(orgId: string, data: any) {
  const subscription = data.subscription || data
  await db.update(organizations)
    .set({
      paddleSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodStart: new Date(subscription.current_billing_period?.starts_at),
      subscriptionCurrentPeriodEnd: new Date(subscription.current_billing_period?.ends_at),
      subscriptionCancelAtPeriodEnd: subscription.scheduled_change?.action === 'cancel',
    })
    .where(eq(organizations.id, orgId))
}

async function handleSubscriptionCancel(orgId: string, data: any) {
  await db.update(organizations)
    .set({ subscriptionStatus: 'canceled', subscriptionPlan: 'free' })
    .where(eq(organizations.id, orgId))
}
