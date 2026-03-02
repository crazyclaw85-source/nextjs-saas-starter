import { eq, and } from 'drizzle-orm'
import { db } from './index'
import { getTenantContext, type TenantContext } from '../multi-tenant'

/**
 * Org-scoped database operations
 * All queries automatically include organization filtering
 */

export class OrgScopedDb {
  constructor(private context: TenantContext) {}

  /**
   * Create a filter condition that includes org scoping
   */
  private withOrgScope<T extends Record<string, any>>(
    table: T & { organizationId: any },
    additionalFilter?: any
  ) {
    const orgFilter = eq(table.organizationId, this.context.organizationDbId)
    return additionalFilter ? and(orgFilter, additionalFilter) : orgFilter
  }

  /**
   * Find many records with automatic org scoping
   */
  async findMany<T extends { organizationId: any }>(
    table: T,
    options?: {
      where?: any
      limit?: number
      offset?: number
      orderBy?: any
    }
  ) {
    const whereClause = this.withOrgScope(table, options?.where)
    
    return db.select()
      .from(table)
      .where(whereClause)
      .limit(options?.limit || 1000)
      .offset(options?.offset || 0)
  }

  /**
   * Find a single record with automatic org scoping
   */
  async findFirst<T extends { organizationId: any }>(
    table: T,
    options?: {
      where?: any
    }
  ) {
    const whereClause = this.withOrgScope(table, options?.where)
    
    const results = await db.select()
      .from(table)
      .where(whereClause)
      .limit(1)
    
    return results[0] || null
  }

  /**
   * Insert a record with automatic org scoping
   */
  async insert<T extends { organizationId: any }>(
    table: T,
    values: Omit<any, 'organizationId'> & Partial<{ organizationId: string }>
  ) {
    const valuesWithOrg = {
      ...values,
      organizationId: this.context.organizationDbId,
    }
    
    return db.insert(table).values(valuesWithOrg).returning()
  }

  /**
   * Update records with automatic org scoping
   */
  async update<T extends { organizationId: any }>(
    table: T,
    values: any,
    where: any
  ) {
    const whereClause = this.withOrgScope(table, where)
    
    return db.update(table)
      .set(values)
      .where(whereClause)
      .returning()
  }

  /**
   * Delete records with automatic org scoping
   */
  async delete<T extends { organizationId: any }>(
    table: T,
    where: any
  ) {
    const whereClause = this.withOrgScope(table, where)
    
    return db.delete(table)
      .where(whereClause)
      .returning()
  }

  /**
   * Count records with automatic org scoping
   */
  async count<T extends { organizationId: any }>(
    table: T,
    where?: any
  ) {
    const whereClause = this.withOrgScope(table, where)
    
    const result = await db.select({ count: count() })
      .from(table)
      .where(whereClause)
    
    return result[0]?.count || 0
  }

  /**
   * Get the current organization ID
   */
  get organizationId() {
    return this.context.organizationDbId
  }

  /**
   * Get the current user ID
   */
  get userId() {
    return this.context.userId
  }

  /**
   * Get the user's role in the current organization
   */
  get userRole() {
    return this.context.role
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: string) {
    return this.context.permissions.includes(permission as any)
  }
}

/**
 * Get an org-scoped database instance for the current request
 */
export async function getOrgScopedDb(orgId?: string): Promise<OrgScopedDb> {
  const context = await getTenantContext(orgId)
  if (!context) {
    throw new Error('No tenant context available')
  }
  return new OrgScopedDb(context)
}

/**
 * Utility function to safely execute org-scoped operations
 */
export async function withOrgScope<T>(
  operation: (db: OrgScopedDb) => Promise<T>,
  orgId?: string
): Promise<T> {
  const orgDb = await getOrgScopedDb(orgId)
  return operation(orgDb)
}

// Helper for count function - import from drizzle-orm
import { count } from 'drizzle-orm'