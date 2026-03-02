import { NextRequest, NextResponse } from 'next/server'
import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = params

    // Verify user is part of the organization
    const organizationMemberships = await clerkClient.users.getOrganizationMembershipList({
      userId: user.id,
    })
    
    const isMember = organizationMemberships.some(
      membership => membership.organization.id === orgId
    )
    
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch organization subscription data
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, orgId),
      columns: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
        subscriptionCancelAtPeriodEnd: true,
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({
      plan: organization.subscriptionPlan || 'free',
      status: organization.subscriptionStatus || 'inactive',
      currentPeriodEnd: organization.subscriptionCurrentPeriodEnd?.toISOString(),
      cancelAtPeriodEnd: organization.subscriptionCancelAtPeriodEnd || false,
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}