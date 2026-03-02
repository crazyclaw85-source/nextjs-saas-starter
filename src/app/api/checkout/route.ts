import { NextRequest, NextResponse } from 'next/server'
import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { paddle } from '@/lib/paddle'
import { z } from 'zod'

const checkoutSchema = z.object({
  priceId: z.string(),
  organizationId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { priceId, organizationId } = checkoutSchema.parse(body)

    // Verify user is part of the organization
    const organizationMemberships = await clerkClient.users.getOrganizationMembershipList({
      userId: user.id,
    })
    
    const isMember = organizationMemberships.some(
      membership => membership.organization.id === organizationId
    )
    
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create Paddle checkout session
    const checkout = await paddle.checkout.create({
      items: [
        {
          priceId,
          quantity: 1,
        },
      ],
      customer: {
        email: user.emailAddresses[0]?.emailAddress,
      },
      customData: {
        organizationId,
        userId: user.id,
      },
      settings: {
        successUrl: `${req.nextUrl.origin}/dashboard?checkout=success`,
        cancelUrl: `${req.nextUrl.origin}/pricing`,
      },
    })

    return NextResponse.json({
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    })
  } catch (error) {
    console.error('Checkout creation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    )
  }
}