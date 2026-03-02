import { NextRequest, NextResponse } from 'next/server'
import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { organizations, organizationMembers, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// GET /api/teams/[teamId]/members - Get team members
export async function GET(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { teamId } = params

    // Get user from our database
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find the organization (supports both UUID and Clerk org ID)
    let organization
    
    // Try to find by Clerk org ID first
    organization = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, teamId),
    })

    // If not found, try by UUID
    if (!organization) {
      organization = await db.query.organizations.findFirst({
        where: eq(organizations.id, teamId),
      })
    }

    if (!organization) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Verify user is a member
    const userMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.userId, dbUser.id)
      ),
    })

    if (!userMembership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get all team members
    const members = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, organization.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            clerkId: true,
          },
        },
      },
      orderBy: (members, { asc }) => [asc(members.joinedAt)],
    })

    const formattedMembers = members.map(member => ({
      id: member.id,
      userId: member.user.id,
      clerkId: member.user.clerkId,
      name: member.user.name,
      email: member.user.email,
      imageUrl: member.user.imageUrl,
      role: member.role,
      joinedAt: member.joinedAt,
    }))

    return NextResponse.json({ 
      members: formattedMembers,
      userRole: userMembership.role,
    })
  } catch (error) {
    console.error('Get team members error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    )
  }
}

// DELETE /api/teams/[teamId]/members - Remove team member
export async function DELETE(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const memberUserId = searchParams.get('userId')

    if (!memberUserId) {
      return NextResponse.json({ error: 'Member user ID required' }, { status: 400 })
    }

    const { teamId } = params

    // Get user from our database
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find the organization
    let organization
    organization = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, teamId),
    })

    if (!organization) {
      organization = await db.query.organizations.findFirst({
        where: eq(organizations.id, teamId),
      })
    }

    if (!organization) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Verify user has admin rights
    const userMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.userId, dbUser.id)
      ),
    })

    if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Find the member to remove
    const memberToRemove = await db.query.users.findFirst({
      where: eq(users.clerkId, memberUserId),
    })

    if (!memberToRemove) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Find their membership
    const membershipToRemove = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.userId, memberToRemove.id)
      ),
    })

    if (!membershipToRemove) {
      return NextResponse.json({ error: 'Member not in team' }, { status: 404 })
    }

    // Don't allow removing the owner
    if (membershipToRemove.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove team owner' }, { status: 400 })
    }

    // Remove from our database
    await db.delete(organizationMembers)
      .where(eq(organizationMembers.id, membershipToRemove.id))

    // Remove from Clerk organization
    try {
      await clerkClient.organizations.deleteOrganizationMembership({
        organizationId: organization.clerkOrgId!,
        userId: memberUserId,
      })
    } catch (clerkError) {
      console.error('Failed to remove user from Clerk organization:', clerkError)
      // Continue - they're removed from our database
    }

    return NextResponse.json({ 
      success: true,
      message: 'Member removed successfully',
    })
  } catch (error) {
    console.error('Remove team member error:', error)
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    )
  }
}