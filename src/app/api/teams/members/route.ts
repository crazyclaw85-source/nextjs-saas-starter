import { NextRequest, NextResponse } from 'next/server'
import { getOrgScopedDb } from '@/lib/db/org-scoped'
import { organizationMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/teams/members - Get current organization members (org-scoped)
export async function GET(req: NextRequest) {
  try {
    const orgDb = await getOrgScopedDb()
    
    // Get all members for the current organization
    const members = await orgDb.findMany(organizationMembers, {
      // Additional filters can be added here
      orderBy: (members, { asc }) => [asc(members.joinedAt)],
    })

    // Get user details for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const user = await db.query.users.findFirst({
          where: eq(users.id, member.userId),
          columns: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            clerkId: true,
          },
        })

        return {
          id: member.id,
          userId: member.userId,
          clerkId: user?.clerkId,
          name: user?.name,
          email: user?.email,
          imageUrl: user?.imageUrl,
          role: member.role,
          joinedAt: member.joinedAt,
        }
      })
    )

    return NextResponse.json({ 
      members: membersWithDetails,
      userRole: orgDb.userRole,
      organizationId: orgDb.organizationId,
    })
  } catch (error) {
    console.error('Get org members error:', error)
    
    if (error instanceof Error && error.message.includes('No tenant context')) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch organization members' },
      { status: 500 }
    )
  }
}

// POST /api/teams/members - Add member to current organization (org-scoped)
export async function POST(req: NextRequest) {
  try {
    const orgDb = await getOrgScopedDb()
    
    // Check admin permission
    if (!orgDb.hasPermission('invite_members')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, role = 'member' } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check if user is already a member
    const existingMember = await orgDb.findFirst(organizationMembers, {
      where: eq(organizationMembers.userId, userId),
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 })
    }

    // Add the member (org ID is automatically scoped)
    const [newMember] = await orgDb.insert(organizationMembers, {
      userId,
      role,
      joinedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      member: newMember,
      message: 'Member added successfully',
    })
  } catch (error) {
    console.error('Add org member error:', error)
    return NextResponse.json(
      { error: 'Failed to add organization member' },
      { status: 500 }
    )
  }
}

// DELETE /api/teams/members - Remove member from current organization (org-scoped)
export async function DELETE(req: NextRequest) {
  try {
    const orgDb = await getOrgScopedDb()
    
    // Check admin permission
    if (!orgDb.hasPermission('remove_members')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const memberUserId = searchParams.get('userId')

    if (!memberUserId) {
      return NextResponse.json({ error: 'Member user ID required' }, { status: 400 })
    }

    // Find the member to remove (automatically org-scoped)
    const memberToRemove = await orgDb.findFirst(organizationMembers, {
      where: eq(organizationMembers.userId, memberUserId),
    })

    if (!memberToRemove) {
      return NextResponse.json({ error: 'Member not found in organization' }, { status: 404 })
    }

    // Don't allow removing the owner
    if (memberToRemove.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove organization owner' }, { status: 400 })
    }

    // Don't allow removing yourself unless you're transferring ownership
    if (memberToRemove.userId === orgDb.userId && memberToRemove.role !== 'owner') {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    // Remove the member (automatically org-scoped)
    await orgDb.delete(organizationMembers, eq(organizationMembers.id, memberToRemove.id))

    return NextResponse.json({ 
      success: true,
      message: 'Member removed successfully',
    })
  } catch (error) {
    console.error('Remove org member error:', error)
    return NextResponse.json(
      { error: 'Failed to remove organization member' },
      { status: 500 }
    )
  }
}

// Need to import the missing dependencies
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'