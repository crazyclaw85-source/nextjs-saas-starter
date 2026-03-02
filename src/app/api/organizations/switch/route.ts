import { NextRequest, NextResponse } from 'next/server'
import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { switchOrganization } from '@/lib/multi-tenant'
import { z } from 'zod'

const switchOrgSchema = z.object({
  organizationId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { organizationId } = switchOrgSchema.parse(body)

    // Validate that the user can switch to this organization
    const canSwitch = await switchOrganization(organizationId)
    
    if (!canSwitch) {
      return NextResponse.json({ 
        error: 'You do not have access to this organization' 
      }, { status: 403 })
    }

    // Update the user's active organization in Clerk
    try {
      await clerkClient.users.updateUser(user.id, {
        publicMetadata: {
          ...user.publicMetadata,
          activeOrganization: organizationId,
        },
      })
    } catch (clerkError) {
      console.error('Failed to update active organization in Clerk:', clerkError)
      // Continue - switching is still valid from our perspective
    }

    return NextResponse.json({
      success: true,
      organizationId,
      message: 'Organization switched successfully',
    })
  } catch (error) {
    console.error('Organization switch error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to switch organization' },
      { status: 500 }
    )
  }
}

// GET endpoint to list available organizations for switching
export async function GET(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization memberships from Clerk
    const memberships = await clerkClient.users.getOrganizationMembershipList({
      userId: user.id,
    })

    const organizations = memberships.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
      imageUrl: membership.organization.imageUrl,
    }))

    return NextResponse.json({
      organizations,
      currentOrganization: user.publicMetadata?.activeOrganization,
    })
  } catch (error) {
    console.error('Get organizations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}