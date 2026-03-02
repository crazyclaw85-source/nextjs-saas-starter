import { NextRequest, NextResponse } from 'next/server'
import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { organizations, organizationMembers, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const createTeamSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().optional(),
})

// GET /api/teams - List user's teams
export async function GET(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from our database
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's team memberships
    const memberships = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, dbUser.id),
      with: {
        organization: {
          columns: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logoUrl: true,
            clerkOrgId: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: (memberships, { desc }) => [desc(memberships.joinedAt)],
    })

    const teams = memberships.map(membership => ({
      ...membership.organization,
      userRole: membership.role,
      joinedAt: membership.joinedAt,
    }))

    return NextResponse.json({ teams })
  } catch (error) {
    console.error('Get teams error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}

// POST /api/teams - Create a new team
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description } = createTeamSchema.parse(body)

    // Get user from our database
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create slug from name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Check if slug is available
    const existingOrg = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    })

    if (existingOrg) {
      return NextResponse.json({ 
        error: 'Team name not available. Please choose a different name.' 
      }, { status: 400 })
    }

    // Create Clerk organization first
    let clerkOrg
    try {
      clerkOrg = await clerkClient.organizations.createOrganization({
        name,
        createdBy: user.id,
      })
    } catch (clerkError) {
      console.error('Failed to create Clerk organization:', clerkError)
      return NextResponse.json({ 
        error: 'Failed to create team in authentication system' 
      }, { status: 500 })
    }

    // Create organization in our database
    const [organization] = await db.insert(organizations).values({
      name,
      slug,
      description: description || null,
      ownerId: dbUser.id,
      clerkOrgId: clerkOrg.id,
    }).returning()

    // Add the creator as owner in our database
    await db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: dbUser.id,
      role: 'owner',
      joinedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      team: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        description: organization.description,
        clerkOrgId: organization.clerkOrgId,
        userRole: 'owner',
      },
    })
  } catch (error) {
    console.error('Create team error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    )
  }
}