import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { organizations, paddleEvents, users, auditLogs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET!

interface PaddleEvent {
  event_id: string
  event_type: string
  occurred_at: string
  data: any
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let eventId: string | null = null
  
  try {
    console.log('🪝 Paddle webhook received')
    
    const body = await req.text()
    const signature = req.headers.get('paddle-signature')
    const isTestMode = req.headers.get('x-test-mode') === 'true'
    
    if (!isTestMode && !signature) {
      console.error('❌ Missing Paddle signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }
    
    // Verify webhook signature (skip for test mode)
    if (!isTestMode) {
      const isValid = verifyWebhookSignature(body, signature!, WEBHOOK_SECRET)
      if (!isValid) {
        console.error('❌ Invalid Paddle webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      console.log('🧪 Test mode enabled - skipping signature verification')
    }
    
    console.log('✅ Webhook signature verified')
    
    const event: PaddleEvent = JSON.parse(body)
    eventId = event.event_id
    const eventType = event.event_type
    
    console.log(`📨 Processing event: ${eventType} (${eventId})`)
    
    // Check for duplicate events (idempotency)
    const existingEvent = await db.query.paddleEvents.findFirst({
      where: eq(paddleEvents.eventId, eventId),
    })
    
    if (existingEvent) {
      console.log(`🔄 Event ${eventId} already processed, returning cached result`)
      return NextResponse.json({ 
        success: true, 
        message: 'Event already processed',
        cached: true 
      })
    }
    
    // Store event for processing
    const [storedEvent] = await db.insert(paddleEvents).values({
      eventId,
      eventType,
      payload: event,
      processed: false,
      createdAt: new Date(),
    }).returning()
    
    console.log(`💾 Event ${eventId} stored in database`)
    
    // Process the event based on type
    const processingResult = await processPaddleEvent(eventType, event.data, event)
    
    // Mark event as processed
    await db.update(paddleEvents)
      .set({ 
        processed: true, 
        processedAt: new Date(),
        processingDurationMs: Date.now() - startTime,
        processingResult: processingResult,
      })
      .where(eq(paddleEvents.id, storedEvent.id))
    
    console.log(`✅ Event ${eventId} processed successfully in ${Date.now() - startTime}ms`)
    
    return NextResponse.json({ 
      success: true,
      eventId,
      eventType,
      processingTime: Date.now() - startTime,
      result: processingResult,
    })
    
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('💥 Paddle webhook error:', error)
    
    // Log error to database if we have an event ID
    if (eventId) {
      try {
        await db.update(paddleEvents)
          .set({ 
            processed: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingDurationMs: processingTime,
          })
          .where(eq(paddleEvents.eventId, eventId))
      } catch (logError) {
        console.error('Failed to log error to database:', logError)
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        eventId,
        processingTime,
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Webhook processing failed'
      },
      { status: 500 }
    )
  }
}

/**
 * Verify Paddle webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.error('❌ PADDLE_WEBHOOK_SECRET not configured')
    return false
  }
  
  try {
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace(/^sha256=/, '')
    
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body, 'utf8')
    const computed = hmac.digest('hex')
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(cleanSignature, 'hex')
    )
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Process different types of Paddle events
 */
async function processPaddleEvent(eventType: string, data: any, fullEvent: PaddleEvent): Promise<any> {
  console.log(`🔄 Processing ${eventType} event`)
  
  switch (eventType) {
    // Subscription lifecycle events
    case 'subscription.created':
      return await handleSubscriptionCreated(data)
    case 'subscription.updated':
      return await handleSubscriptionUpdated(data)
    case 'subscription.canceled':
      return await handleSubscriptionCanceled(data)
    case 'subscription.paused':
      return await handleSubscriptionPaused(data)
    case 'subscription.resumed':
      return await handleSubscriptionResumed(data)
    
    // Payment events
    case 'transaction.completed':
      return await handlePaymentCompleted(data)
    case 'transaction.payment_failed':
      return await handlePaymentFailed(data)
    case 'transaction.updated':
      return await handleTransactionUpdated(data)
    
    // Invoice events
    case 'subscription.past_due':
      return await handleSubscriptionPastDue(data)
    
    // Customer events
    case 'customer.created':
      return await handleCustomerCreated(data)
    case 'customer.updated':
      return await handleCustomerUpdated(data)
    
    default:
      console.log(`⚠️ Unhandled event type: ${eventType}`)
      return { handled: false, reason: 'Unhandled event type' }
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(data: any): Promise<any> {
  const subscription = data.subscription || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) {
    console.warn('⚠️ No organization ID in subscription.created event')
    return { handled: false, reason: 'Missing organization ID' }
  }
  
  const updateData = {
    paddleCustomerId: data.customer?.id,
    paddleSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionPlan: subscription.items?.[0]?.price?.product?.name?.toLowerCase() || 'unknown',
    subscriptionCurrentPeriodStart: new Date(subscription.current_billing_period?.starts_at),
    subscriptionCurrentPeriodEnd: new Date(subscription.current_billing_period?.ends_at),
    subscriptionCancelAtPeriodEnd: false,
    updatedAt: new Date(),
  }
  
  await db.update(organizations)
    .set(updateData)
    .where(eq(organizations.id, organizationId))
  
  // Create audit log
  await createAuditLog(organizationId, 'subscription.created', {
    subscriptionId: subscription.id,
    status: subscription.status,
    plan: updateData.subscriptionPlan,
  })
  
  console.log(`✅ Subscription created for org ${organizationId}`)
  return { handled: true, organizationId, subscriptionId: subscription.id }
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(data: any): Promise<any> {
  const subscription = data.subscription || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) {
    console.warn('⚠️ No organization ID in subscription.updated event')
    return { handled: false, reason: 'Missing organization ID' }
  }
  
  const updateData = {
    subscriptionStatus: subscription.status,
    subscriptionCurrentPeriodStart: new Date(subscription.current_billing_period?.starts_at),
    subscriptionCurrentPeriodEnd: new Date(subscription.current_billing_period?.ends_at),
    subscriptionCancelAtPeriodEnd: subscription.scheduled_change?.action === 'cancel',
    updatedAt: new Date(),
  }
  
  await db.update(organizations)
    .set(updateData)
    .where(eq(organizations.id, organizationId))
  
  await createAuditLog(organizationId, 'subscription.updated', {
    subscriptionId: subscription.id,
    status: subscription.status,
    changes: updateData,
  })
  
  console.log(`✅ Subscription updated for org ${organizationId}`)
  return { handled: true, organizationId, changes: updateData }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(data: any): Promise<any> {
  const subscription = data.subscription || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) {
    console.warn('⚠️ No organization ID in subscription.canceled event')
    return { handled: false, reason: 'Missing organization ID' }
  }
  
  const updateData = {
    subscriptionStatus: 'canceled',
    subscriptionPlan: 'free',
    subscriptionCancelAtPeriodEnd: true,
    updatedAt: new Date(),
  }
  
  await db.update(organizations)
    .set(updateData)
    .where(eq(organizations.id, organizationId))
  
  await createAuditLog(organizationId, 'subscription.canceled', {
    subscriptionId: subscription.id,
    canceledAt: new Date(),
  })
  
  console.log(`✅ Subscription canceled for org ${organizationId}`)
  return { handled: true, organizationId, action: 'downgraded_to_free' }
}

/**
 * Handle subscription paused
 */
async function handleSubscriptionPaused(data: any): Promise<any> {
  const subscription = data.subscription || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) return { handled: false, reason: 'Missing organization ID' }
  
  await db.update(organizations)
    .set({
      subscriptionStatus: 'paused',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
  
  await createAuditLog(organizationId, 'subscription.paused', {
    subscriptionId: subscription.id,
  })
  
  return { handled: true, organizationId, action: 'paused' }
}

/**
 * Handle subscription resumed
 */
async function handleSubscriptionResumed(data: any): Promise<any> {
  const subscription = data.subscription || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) return { handled: false, reason: 'Missing organization ID' }
  
  await db.update(organizations)
    .set({
      subscriptionStatus: 'active',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
  
  await createAuditLog(organizationId, 'subscription.resumed', {
    subscriptionId: subscription.id,
  })
  
  return { handled: true, organizationId, action: 'resumed' }
}

/**
 * Handle successful payment
 */
async function handlePaymentCompleted(data: any): Promise<any> {
  const transaction = data.transaction || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) return { handled: false, reason: 'Missing organization ID' }
  
  await createAuditLog(organizationId, 'payment.completed', {
    transactionId: transaction.id,
    amount: transaction.details?.total_amount,
    currency: transaction.currency_code,
  })
  
  console.log(`💰 Payment completed for org ${organizationId}: ${transaction.details?.total_amount} ${transaction.currency_code}`)
  return { handled: true, organizationId, transactionId: transaction.id }
}

/**
 * Handle failed payment - Critical for subscription management
 */
async function handlePaymentFailed(data: any): Promise<any> {
  const transaction = data.transaction || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) return { handled: false, reason: 'Missing organization ID' }
  
  // Update organization with failed payment status
  await db.update(organizations)
    .set({
      subscriptionStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
  
  await createAuditLog(organizationId, 'payment.failed', {
    transactionId: transaction.id,
    amount: transaction.details?.total_amount,
    currency: transaction.currency_code,
    failureReason: transaction.failure_reason,
  })
  
  console.error(`💳 Payment failed for org ${organizationId}: ${transaction.failure_reason}`)
  
  // TODO: Implement email notification to customer
  // TODO: Implement retry logic if needed
  
  return { 
    handled: true, 
    organizationId, 
    transactionId: transaction.id,
    action: 'marked_past_due',
    failureReason: transaction.failure_reason,
  }
}

/**
 * Handle transaction updates
 */
async function handleTransactionUpdated(data: any): Promise<any> {
  const transaction = data.transaction || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) return { handled: false, reason: 'Missing organization ID' }
  
  await createAuditLog(organizationId, 'transaction.updated', {
    transactionId: transaction.id,
    status: transaction.status,
  })
  
  return { handled: true, organizationId, transactionId: transaction.id }
}

/**
 * Handle past due subscription
 */
async function handleSubscriptionPastDue(data: any): Promise<any> {
  const subscription = data.subscription || data
  const organizationId = data.custom_data?.organizationId
  
  if (!organizationId) return { handled: false, reason: 'Missing organization ID' }
  
  await db.update(organizations)
    .set({
      subscriptionStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
  
  await createAuditLog(organizationId, 'subscription.past_due', {
    subscriptionId: subscription.id,
  })
  
  return { handled: true, organizationId, action: 'marked_past_due' }
}

/**
 * Handle customer creation
 */
async function handleCustomerCreated(data: any): Promise<any> {
  const customer = data.customer || data
  // Customer events might not have org context initially
  
  await createAuditLog(null, 'customer.created', {
    customerId: customer.id,
    email: customer.email,
  })
  
  return { handled: true, customerId: customer.id }
}

/**
 * Handle customer updates
 */
async function handleCustomerUpdated(data: any): Promise<any> {
  const customer = data.customer || data
  
  await createAuditLog(null, 'customer.updated', {
    customerId: customer.id,
    email: customer.email,
  })
  
  return { handled: true, customerId: customer.id }
}

/**
 * Create audit log entry
 */
async function createAuditLog(
  organizationId: string | null,
  action: string,
  metadata: any
): Promise<void> {
  if (!organizationId) return // Skip audit logs for events without org context
  
  try {
    await db.insert(auditLogs).values({
      organizationId,
      action,
      entityType: 'subscription',
      entityId: metadata.subscriptionId || metadata.customerId || null,
      metadata,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit log failure shouldn't break webhook processing
  }
}