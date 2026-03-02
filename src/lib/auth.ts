import { auth as clerkAuth, currentUser } from '@clerk/nextjs/server'
import { db } from './db'
import { users, organizations, organizationMembers } from './db/schema'
import { eq, and } from 'drizzle-orm'

export interface AuthContext {
  userId: string | null
  orgId: string | null
  user: typeof users.$inferSelect | null
  organization: typeof organizations.$inferSelect | null
  membership: typeof organizationMembers.$inferSelect | null
  clerkUser: Awaited<ReturnType<typeof currentUser>>
}

export async function getAuthContext(): Promise<AuthContext> {
  const { userId, orgId } = await clerkAuth()
  const clerkUser = await currentUser()
  
  if (!userId) {
    return {
      userId: null,
      orgId: null,
      user: null,
      organization: null,
      membership: null,
      clerkUser: null,
    }
  }
  
  // Get or create user in our database
  let user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })
  
  if (!user && clerkUser) {
    const [newUser] = await db.insert(users).values({
      clerkId: userId,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      name: clerkUser.firstName + ' ' + clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl,
    }).returning()
    user = newUser
  }
  
  let organization: typeof organizations.$inferSelect | null = null
  let membership: typeof organizationMembers.$inferSelect | null = null
  
  if (orgId && user) {
    organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })
    
    if (organization) {
      membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, user.id)
        ),
      })
    }
  }
  
  return {
    userId,
    orgId,
    user,
    organization,
    membership,
    clerkUser,
  }
}

export function requireAuth(context: AuthContext): asserts context is AuthContext & { userId: string; user: NonNullable<AuthContext['user']> } {
  if (!context.userId || !context.user) {
    throw new Error('Unauthorized')
  }
}

export function requireOrg(context: AuthContext): asserts context is AuthContext & { orgId: string; organization: NonNullable<AuthContext['organization']>; membership: NonNullable<AuthContext['membership']> } {
  requireAuth(context)
  if (!context.orgId || !context.organization || !context.membership) {
    throw new Error('Organization required')
  }
}

export function requireOwnerOrAdmin(context: AuthContext) {
  requireOrg(context)
  if (!['owner', 'admin'].includes(context.membership!.role)) {
    throw new Error('Insufficient permissions')
  }
}