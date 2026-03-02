import { NextRequest, NextResponse } from 'next/server'
import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { organizationInvites, organizationMembers, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const acceptInviteSchema = z.object({
  token: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { token } = acceptInviteSchema.parse(body)

    // Find the invite
    const invite = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.token, token),
      with: {
        organization: true,
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })
    }

    // Check if invite is expired
    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    // Check if invite is still pending
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already processed' }, { status: 400 })
    }

    // Get the accepting user from our database
    const acceptingUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    })

    if (!acceptingUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    // Verify email matches
    if (acceptingUser.email !== invite.email) {
      return NextResponse.json({ 
        error: 'Email mismatch. This invitation was sent to a different email address.' 
      }, { status: 400 })
    }

    // Check if user is already a member
    const existingMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, invite.organizationId),
        eq(organizationMembers.userId, acceptingUser.id)
      ),
    })

    if (existingMembership) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 })
    }

    // Start transaction to update invite and create membership
    await db.transaction(async (tx) => {
      // Mark invite as accepted
      await tx.update(organizationInvites)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: acceptingUser.id,
          updatedAt: new Date(),
        })
        .where(eq(organizationInvites.id, invite.id))

      // Create organization membership
      await tx.insert(organizationMembers).values({
        organizationId: invite.organizationId,
        userId: acceptingUser.id,
        role: invite.role,
        joinedAt: new Date(),
      })
    })

    // Add user to Clerk organization
    try {
      await clerkClient.organizations.createOrganizationMembership({
        organizationId: invite.organization.clerkOrgId!,
        userId: user.id,
        role: invite.role === 'admin' ? 'admin' : 'basic_member',
      })
    } catch (clerkError) {
      console.error('Failed to add user to Clerk organization:', clerkError)
      // Continue execution - the user is added to our database
      // They might need to manually join the Clerk organization
    }

    return NextResponse.json({
      success: true,
      organizationId: invite.organization.clerkOrgId,
      organizationName: invite.organization.name,
      role: invite.role,
    })
  } catch (error) {
    console.error('Accept invite error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}