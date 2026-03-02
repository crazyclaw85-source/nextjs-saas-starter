import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  uuid,
  jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member'])
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'canceled',
  'past_due',
  'paused',
  'trialing',
])
export const inviteStatusEnum = pgEnum('invite_status', [
  'pending',
  'accepted',
  'expired',
  'cancelled',
])

// Users table - synced from Clerk
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkId: varchar('clerk_id', { length: 256 }).notNull().unique(),
    email: varchar('email', { length: 256 }).notNull().unique(),
    name: varchar('name', { length: 256 }),
    imageUrl: text('image_url'),
    onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
    onboardingStep: varchar('onboarding_step', { length: 50 }).default('start'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    clerkIdIdx: index('users_clerk_id_idx').on(table.clerkId),
    emailIdx: index('users_email_idx').on(table.email),
  })
)

// Organizations table
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 256 }).notNull(),
    slug: varchar('slug', { length: 256 }).notNull().unique(),
    description: text('description'),
    logoUrl: text('logo_url'),
    website: varchar('website', { length: 256 }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clerkOrgId: varchar('clerk_org_id', { length: 256 }).unique(),
    // Subscription fields
    paddleCustomerId: varchar('paddle_customer_id', { length: 256 }),
    paddleSubscriptionId: varchar('paddle_subscription_id', { length: 256 }),
    subscriptionStatus: subscriptionStatusEnum('subscription_status'),
    subscriptionPlan: varchar('subscription_plan', { length: 50 }).default('free'),
    subscriptionCurrentPeriodStart: timestamp('subscription_current_period_start'),
    subscriptionCurrentPeriodEnd: timestamp('subscription_current_period_end'),
    subscriptionCancelAtPeriodEnd: boolean('subscription_cancel_at_period_end').default(false),
    // Rate limiting
    apiRequestsThisMonth: integer('api_requests_this_month').default(0),
    apiRequestsResetAt: timestamp('api_requests_reset_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
    ownerIdIdx: index('organizations_owner_id_idx').on(table.ownerId),
    paddleCustomerIdx: index('organizations_paddle_customer_idx').on(table.paddleCustomerId),
    paddleSubIdx: index('organizations_paddle_subscription_idx').on(table.paddleSubscriptionId),
  })
)

// Organization members (junction table)
export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgRoleEnum('role').default('member').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgUserIdx: uniqueIndex('org_members_org_user_idx').on(
      table.organizationId,
      table.userId
    ),
    userIdIdx: index('org_members_user_id_idx').on(table.userId),
  })
)

// Organization invites
export const organizationInvites = pgTable(
  'organization_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 256 }).notNull(),
    role: orgRoleEnum('role').default('member').notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 256 }).notNull().unique(),
    status: inviteStatusEnum('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('org_invites_org_idx').on(table.organizationId),
    tokenIdx: uniqueIndex('org_invites_token_idx').on(table.token),
    emailIdx: index('org_invites_email_idx').on(table.email),
    statusIdx: index('org_invites_status_idx').on(table.status),
  })
)

// Audit logs for organizations
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: varchar('entity_id', { length: 256 }),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('audit_logs_org_idx').on(table.organizationId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
)

// API keys for organization
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 256 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    keyHash: varchar('key_hash', { length: 256 }).notNull(),
    permissions: jsonb('permissions').$type<string[]>().default([]),
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('api_keys_org_idx').on(table.organizationId),
    keyPrefixIdx: index('api_keys_prefix_idx').on(table.keyPrefix),
  })
)

// Paddle webhook events log
export const paddleEvents = pgTable(
  'paddle_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: varchar('event_id', { length: 256 }).notNull().unique(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    payload: jsonb('payload').notNull(),
    processed: boolean('processed').default(false),
    processedAt: timestamp('processed_at'),
    processingDurationMs: integer('processing_duration_ms'),
    processingResult: jsonb('processing_result'),
    error: text('error'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    eventIdIdx: uniqueIndex('paddle_events_event_id_idx').on(table.eventId),
    eventTypeIdx: index('paddle_events_type_idx').on(table.eventType),
    orgIdx: index('paddle_events_org_idx').on(table.organizationId),
    processedIdx: index('paddle_events_processed_idx').on(table.processed),
  })
)

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedOrganizations: many(organizations, { relationName: 'owner' }),
  memberships: many(organizationMembers),
  invitesSent: many(organizationInvites, { relationName: 'inviter' }),
  invitesAccepted: many(organizationInvites, { relationName: 'accepter' }),
}))

export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [organizations.ownerId],
      references: [users.id],
      relationName: 'owner',
    }),
    members: many(organizationMembers),
    invites: many(organizationInvites),
    auditLogs: many(auditLogs),
    apiKeys: many(apiKeys),
    paddleEvents: many(paddleEvents),
  })
)

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  })
)

export const organizationInvitesRelations = relations(
  organizationInvites,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvites.organizationId],
      references: [organizations.id],
    }),
    inviter: one(users, {
      fields: [organizationInvites.invitedBy],
      references: [users.id],
      relationName: 'inviter',
    }),
    accepter: one(users, {
      fields: [organizationInvites.acceptedBy],
      references: [users.id],
      relationName: 'accepter',
    }),
  })
)