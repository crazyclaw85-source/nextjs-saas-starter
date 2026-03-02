import { NextRequest, NextResponse } from 'next/server'
import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { organizationInvites, organizations, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import crypto from 'crypto'

const inviteSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
  role: z.enum(['member', 'admin']),
})

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { organizationId, email, role } = inviteSchema.parse(body)

    // Verify user is part of the organization with admin rights
    const organizationMemberships = await clerkClient.users.getOrganizationMembershipList({
      userId: user.id,
    })
    
    const membership = organizationMemberships.find(
      m => m.organization.id === organizationId
    )
    
    if (!membership || !['admin', 'basic_member'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get the inviting user from our database
    const invitingUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    })

    if (!invitingUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    // Get the organization from our database
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, organizationId),
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if user is already invited
    const existingInvite = await db.query.organizationInvites.findFirst({
      where: and(
        eq(organizationInvites.organizationId, organization.id),
        eq(organizationInvites.email, email),
        eq(organizationInvites.status, 'pending')
      ),
    })

    if (existingInvite) {
      return NextResponse.json({ error: 'User already invited' }, { status: 400 })
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')

    // Create invite
    const [invite] = await db.insert(organizationInvites).values({
      organizationId: organization.id,
      email,
      role,
      invitedBy: invitingUser.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }).returning()

    // TODO: Send email invitation
    // For now, we'll just return the invite link
    const inviteUrl = `${req.nextUrl.origin}/invite/${token}`

    // In production, send email here
    console.log(`Invite sent to ${email}: ${inviteUrl}`)

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      inviteUrl, // Remove this in production
      message: 'Invitation sent successfully',
    })
  } catch (error) {
    console.error('Team invite error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Verify user is part of the organization
    const organizationMemberships = await clerkClient.users.getOrganizationMembershipList({
      userId: user.id,
    })
    
    const isMember = organizationMemberships.some(
      m => m.organization.id === organizationId
    )
    
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the organization from our database
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, organizationId),
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch pending invites
    const invites = await db.query.organizationInvites.findMany({
      where: and(
        eq(organizationInvites.organizationId, organization.id),
        eq(organizationInvites.status, 'pending')
      ),
      with: {
        inviter: {
          columns: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: (invites, { desc }) => [desc(invites.createdAt)],
    })

    return NextResponse.json({ invites })
  } catch (error) {
    console.error('Get invites error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}