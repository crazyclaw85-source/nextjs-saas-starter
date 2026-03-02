import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from './db'
import { organizations, organizationMembers, users } from './db/schema'
import { eq, and } from 'drizzle-orm'
import { cache } from 'react'

/**
 * Multi-tenant context for the current request
 */
export interface TenantContext {
  userId: string
  organizationId: string
  organizationDbId: string
  role: 'owner' | 'admin' | 'member'
  permissions: Permission[]
}

export type Permission = 
  | 'read'
  | 'write' 
  | 'admin'
  | 'invite_members'
  | 'remove_members'
  | 'manage_billing'
  | 'delete_organization'

/**
 * Get the current tenant context for the authenticated user
 * This should be used in API routes and server components
 */
export const getTenantContext = cache(async (orgId?: string): Promise<TenantContext | null> => {
  const user = await currentUser()
  if (!user) return null

  // Get organization ID from various sources
  let organizationId = orgId
  
  if (!organizationId) {
    const session = await auth()
    organizationId = session.orgId || undefined
  }

  if (!organizationId) {
    // Get user's first organization as fallback
    const userMemberships = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, user.id),
      with: {
        organization: {
          columns: {
            id: true,
            clerkOrgId: true,
          },
        },
      },
      limit: 1,
    })
    
    if (userMemberships.length > 0) {
      organizationId = userMemberships[0].organization.clerkOrgId!
    }
  }

  if (!organizationId) {
    throw new Error('No organization context available')
  }

  // Get user from our database
  const dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, user.id),
  })

  if (!dbUser) {
    throw new Error('User not found in database')
  }

  // Get organization from our database
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.clerkOrgId, organizationId),
  })

  if (!organization) {
    throw new Error('Organization not found')
  }

  // Get user's membership in this organization
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, dbUser.id),
      eq(organizationMembers.organizationId, organization.id)
    ),
  })

  if (!membership) {
    throw new Error('User is not a member of this organization')
  }

  // Calculate permissions based on role
  const permissions = getPermissionsForRole(membership.role)

  return {
    userId: dbUser.id,
    organizationId,
    organizationDbId: organization.id,
    role: membership.role,
    permissions,
  }
})

/**
 * Get permissions for a given role
 */
function getPermissionsForRole(role: 'owner' | 'admin' | 'member'): Permission[] {
  const basePermissions: Permission[] = ['read']
  
  switch (role) {
    case 'owner':
      return [
        ...basePermissions,
        'write',
        'admin',
        'invite_members',
        'remove_members',
        'manage_billing',
        'delete_organization',
      ]
    case 'admin':
      return [
        ...basePermissions,
        'write',
        'admin',
        'invite_members',
        'remove_members',
      ]
    case 'member':
      return [
        ...basePermissions,
        'write',
      ]
    default:
      return basePermissions
  }
}

/**
 * Check if the current user has a specific permission
 */
export function hasPermission(context: TenantContext, permission: Permission): boolean {
  return context.permissions.includes(permission)
}

/**
 * Require a specific permission, throwing an error if not granted
 */
export function requirePermission(context: TenantContext, permission: Permission): void {
  if (!hasPermission(context, permission)) {
    throw new Error(`Permission '${permission}' required`)
  }
}

/**
 * Create an org-scoped database query helper
 * This ensures all queries are automatically scoped to the current organization
 */
export function createOrgScopedDb(organizationId: string) {
  return {
    // Helper to add org scoping to queries
    withOrgScope: <T extends Record<string, any>>(
      table: any,
      additionalFilters?: any
    ) => {
      const orgFilter = eq(table.organizationId, organizationId)
      return additionalFilters 
        ? and(orgFilter, additionalFilters)
        : orgFilter
    },

    // Scoped query methods
    query: {
      // Add methods here for common org-scoped queries
      // This can be extended as needed
    }
  }
}

/**
 * Middleware helper to validate tenant access
 */
export async function validateTenantAccess(
  requiredPermission?: Permission
): Promise<TenantContext> {
  const context = await getTenantContext()
  
  if (!context) {
    throw new Error('Authentication required')
  }

  if (requiredPermission) {
    requirePermission(context, requiredPermission)
  }

  return context
}

/**
 * Safe organization switching
 * Validates that the user has access to the target organization
 */
export async function switchOrganization(targetOrgId: string): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false

  // Get user from our database
  const dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, user.id),
  })

  if (!dbUser) return false

  // Get target organization
  const targetOrg = await db.query.organizations.findFirst({
    where: eq(organizations.clerkOrgId, targetOrgId),
  })

  if (!targetOrg) return false

  // Check if user is a member of the target organization
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, dbUser.id),
      eq(organizationMembers.organizationId, targetOrg.id)
    ),
  })

  return !!membership
}

/**
 * Data isolation test helper
 * This can be used in tests to verify multi-tenancy
 */
export async function testDataIsolation(
  org1Id: string,
  org2Id: string,
  testQuery: (orgId: string) => Promise<any[]>
) {
  const org1Data = await testQuery(org1Id)
  const org2Data = await testQuery(org2Id)

  // Check that data doesn't leak between organizations
  const org1Ids = new Set(org1Data.map(item => item.id))
  const org2Ids = new Set(org2Data.map(item => item.id))
  
  const intersection = new Set([...org1Ids].filter(x => org2Ids.has(x)))
  
  if (intersection.size > 0) {
    throw new Error(`Data leakage detected: ${intersection.size} shared records between organizations`)
  }

  return {
    org1Count: org1Data.length,
    org2Count: org2Data.length,
    isolated: true,
  }
}