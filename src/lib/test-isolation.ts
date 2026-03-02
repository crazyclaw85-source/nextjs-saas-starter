import { db } from './db'
import { organizations, organizationMembers, users } from './db/schema'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'

/**
 * Test utilities for verifying multi-tenant data isolation
 */

export interface TestOrganization {
  id: string
  clerkOrgId: string
  name: string
  ownerId: string
}

export interface TestUser {
  id: string
  clerkId: string
  email: string
  name: string
}

/**
 * Create test organizations and users for isolation testing
 */
export async function createTestTenants() {
  // Create test users
  const user1: TestUser = {
    id: crypto.randomUUID(),
    clerkId: `clerk_test_${Date.now()}_1`,
    email: `test1-${Date.now()}@example.com`,
    name: 'Test User 1',
  }

  const user2: TestUser = {
    id: crypto.randomUUID(),
    clerkId: `clerk_test_${Date.now()}_2`,
    email: `test2-${Date.now()}@example.com`,
    name: 'Test User 2',
  }

  // Insert test users
  await db.insert(users).values([
    {
      id: user1.id,
      clerkId: user1.clerkId,
      email: user1.email,
      name: user1.name,
    },
    {
      id: user2.id,
      clerkId: user2.clerkId,
      email: user2.email,
      name: user2.name,
    },
  ])

  // Create test organizations
  const org1: TestOrganization = {
    id: crypto.randomUUID(),
    clerkOrgId: `org_test_${Date.now()}_1`,
    name: 'Test Organization 1',
    ownerId: user1.id,
  }

  const org2: TestOrganization = {
    id: crypto.randomUUID(),
    clerkOrgId: `org_test_${Date.now()}_2`,
    name: 'Test Organization 2',
    ownerId: user2.id,
  }

  // Insert test organizations
  await db.insert(organizations).values([
    {
      id: org1.id,
      clerkOrgId: org1.clerkOrgId,
      name: org1.name,
      slug: `test-org-1-${Date.now()}`,
      ownerId: org1.ownerId,
    },
    {
      id: org2.id,
      clerkOrgId: org2.clerkOrgId,
      name: org2.name,
      slug: `test-org-2-${Date.now()}`,
      ownerId: org2.ownerId,
    },
  ])

  // Create memberships
  await db.insert(organizationMembers).values([
    {
      organizationId: org1.id,
      userId: user1.id,
      role: 'owner',
    },
    {
      organizationId: org2.id,
      userId: user2.id,
      role: 'owner',
    },
  ])

  return {
    users: [user1, user2],
    organizations: [org1, org2],
  }
}

/**
 * Clean up test data
 */
export async function cleanupTestTenants(testData: {
  users: TestUser[]
  organizations: TestOrganization[]
}) {
  // Delete in reverse dependency order
  for (const org of testData.organizations) {
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, org.id))
    await db.delete(organizations).where(eq(organizations.id, org.id))
  }

  for (const user of testData.users) {
    await db.delete(users).where(eq(users.id, user.id))
  }
}

/**
 * Test data isolation between organizations
 */
export async function testDataIsolation() {
  console.log('🧪 Starting data isolation tests...')
  
  const testData = await createTestTenants()
  const [org1, org2] = testData.organizations
  
  try {
    // Test 1: Organization members should not leak
    console.log('Testing organization member isolation...')
    
    const org1Members = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, org1.id),
    })
    
    const org2Members = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, org2.id),
    })
    
    // Verify no cross-contamination
    const org1UserIds = new Set(org1Members.map(m => m.userId))
    const org2UserIds = new Set(org2Members.map(m => m.userId))
    
    const sharedUsers = [...org1UserIds].filter(id => org2UserIds.has(id))
    if (sharedUsers.length > 0) {
      throw new Error(`Data leakage: ${sharedUsers.length} shared users between organizations`)
    }
    
    console.log('✅ Organization member isolation verified')
    
    // Test 2: Query with wrong org ID should return empty
    console.log('Testing query isolation...')
    
    const wrongOrgQuery = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, 'non-existent-org'),
    })
    
    if (wrongOrgQuery.length > 0) {
      throw new Error('Query with invalid org ID returned data')
    }
    
    console.log('✅ Query isolation verified')
    
    // Test 3: Verify each org only sees its own data
    console.log('Testing org-specific data access...')
    
    if (org1Members.length !== 1 || org2Members.length !== 1) {
      throw new Error('Each test org should have exactly 1 member')
    }
    
    if (org1Members[0].organizationId !== org1.id) {
      throw new Error('Org1 member has wrong organization ID')
    }
    
    if (org2Members[0].organizationId !== org2.id) {
      throw new Error('Org2 member has wrong organization ID')
    }
    
    console.log('✅ Org-specific data access verified')
    
    return {
      success: true,
      tests: [
        { name: 'Member isolation', passed: true },
        { name: 'Query isolation', passed: true },
        { name: 'Org-specific access', passed: true },
      ],
      message: 'All data isolation tests passed',
    }
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tests: [],
    }
  } finally {
    // Clean up test data
    await cleanupTestTenants(testData)
    console.log('🧹 Test data cleaned up')
  }
}

/**
 * Test API endpoint isolation
 */
export async function testApiIsolation(
  endpoint: string,
  org1Token: string,
  org2Token: string
): Promise<{
  success: boolean
  org1Data: any[]
  org2Data: any[]
  leakage: boolean
  sharedRecords: number
}> {
  try {
    // Make requests with different org tokens
    const [org1Response, org2Response] = await Promise.all([
      fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${org1Token}` }
      }),
      fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${org2Token}` }
      })
    ])
    
    const org1Data = await org1Response.json()
    const org2Data = await org2Response.json()
    
    // Check for data leakage
    const org1Ids = new Set(org1Data.map((item: any) => item.id))
    const org2Ids = new Set(org2Data.map((item: any) => item.id))
    
    const sharedRecords = [...org1Ids].filter(id => org2Ids.has(id)).length
    
    return {
      success: true,
      org1Data,
      org2Data,
      leakage: sharedRecords > 0,
      sharedRecords,
    }
  } catch (error) {
    return {
      success: false,
      org1Data: [],
      org2Data: [],
      leakage: false,
      sharedRecords: 0,
    }
  }
}

/**
 * Performance test for org-scoped queries
 */
export async function testQueryPerformance(orgId: string, iterations = 100) {
  const start = Date.now()
  
  for (let i = 0; i < iterations; i++) {
    await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, orgId),
    })
  }
  
  const duration = Date.now() - start
  const avgMs = duration / iterations
  
  return {
    totalMs: duration,
    avgMs: avgMs,
    qps: 1000 / avgMs,
    acceptable: avgMs < 100, // Queries should be under 100ms
  }
}