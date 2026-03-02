import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure, orgProcedure, adminProcedure } from './trpc'
import { db } from '@/lib/db'
import { users, organizations, organizationMembers, organizationInvites, apiKeys, paddleEvents, auditLogs } from '@/lib/db/schema'
import { eq, and, desc, asc } from 'drizzle-orm'
import { paddle, PRICING_PLANS } from '@/lib/paddle'
import { TRPCError } from '@trpc/server'
import crypto from 'crypto'

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }),

  user: createTRPCRouter({
    me: protectedProcedure.query(async ({ ctx }) => {
      return ctx.user
    }),
    
    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        onboardingCompleted: z.boolean().optional(),
        onboardingStep: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [updated] = await db.update(users)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(users.id, ctx.user.id))
          .returning()
        return updated
      }),

    organizations: protectedProcedure.query(async ({ ctx }) => {
      const memberships = await db.query.organizationMembers.findMany({
        where: eq(organizationMembers.userId, ctx.user.id),
        with: { organization: true },
      })
      return memberships
    }),
  }),

  organization: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const memberships = await db.query.organizationMembers.findMany({
        where: eq(organizationMembers.userId, ctx.user.id),
        with: { organization: true },
      })
      return memberships.map(m => m.organization)
    }),

    get: orgProcedure.query(async ({ ctx }) => {
      return ctx.organization
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.query.organizations.findFirst({
          where: eq(organizations.slug, input.slug),
        })
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Organization slug already exists' })
        }

        const [org] = await db.insert(organizations).values({
          ...input,
          ownerId: ctx.user.id,
          subscriptionPlan: 'free',
        }).returning()

        await db.insert(organizationMembers).values({
          organizationId: org.id,
          userId: ctx.user.id,
          role: 'owner',
        })

        return org
      }),

    update: adminProcedure
      .input(z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        website: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [updated] = await db.update(organizations)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(organizations.id, ctx.orgId))
          .returning()
        return updated
      }),

    members: orgProcedure.query(async ({ ctx }) => {
      const members = await db.query.organizationMembers.findMany({
        where: eq(organizationMembers.organizationId, ctx.orgId),
        with: { user: true },
      })
      return members
    }),
  }),

  invites: createTRPCRouter({
    list: orgProcedure.query(async ({ ctx }) => {
      const invites = await db.query.organizationInvites.findMany({
        where: eq(organizationInvites.organizationId, ctx.orgId),
        with: { inviter: true },
        orderBy: desc(organizationInvites.createdAt),
      })
      return invites
    }),

    create: adminProcedure
      .input(z.object({
        email: z.string().email(),
        role: z.enum(['admin', 'member']),
      }))
      .mutation(async ({ ctx, input }) => {
        const token = crypto.randomUUID()
        const [invite] = await db.insert(organizationInvites).values({
          organizationId: ctx.orgId,
          email: input.email,
          role: input.role,
          invitedBy: ctx.user.id,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        }).returning()
        return invite
      }),

    accept: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const invite = await db.query.organizationInvites.findFirst({
          where: and(
            eq(organizationInvites.token, input.token),
            eq(organizationInvites.status, 'pending'),
          ),
        })
        
        if (!invite) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' })
        }
        
        if (invite.expiresAt < new Date()) {
          await db.update(organizationInvites)
            .set({ status: 'expired' })
            .where(eq(organizationInvites.id, invite.id))
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite expired' })
        }

        await db.insert(organizationMembers).values({
          organizationId: invite.organizationId,
          userId: ctx.user.id,
          role: invite.role,
        })

        await db.update(organizationInvites)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: ctx.user.id,
          })
          .where(eq(organizationInvites.id, invite.id))

        return { success: true }
      }),

    cancel: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.update(organizationInvites)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(and(
            eq(organizationInvites.id, input.id),
            eq(organizationInvites.organizationId, ctx.orgId)
          ))
        return { success: true }
      }),
  }),

  subscription: createTRPCRouter({
    get: orgProcedure.query(async ({ ctx }) => {
      return {
        organization: ctx.organization,
        plan: PRICING_PLANS[ctx.organization.subscriptionPlan as keyof typeof PRICING_PLANS],
      }
    }),

    createCheckout: orgProcedure
      .input(z.object({ priceId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const checkout = await paddle.checkouts.create({
          items: [{ priceId: input.priceId, quantity: 1 }],
          customer: ctx.organization.paddleCustomerId ? { id: ctx.organization.paddleCustomerId } : undefined,
          customData: {
            organizationId: ctx.orgId,
          },
        })
        return checkout
      }),

    getCustomerPortal: orgProcedure.mutation(async ({ ctx }) => {
      if (!ctx.organization.paddleCustomerId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No subscription found' })
      }
      const portal = await paddle.customers.createPortalSession(ctx.organization.paddleCustomerId)
      return portal
    }),
  }),

  apiKey: createTRPCRouter({
    list: orgProcedure.query(async ({ ctx }) => {
      const keys = await db.query.apiKeys.findMany({
        where: and(
          eq(apiKeys.organizationId, ctx.orgId),
          eq(apiKeys.revokedAt, null)
        ),
        orderBy: desc(apiKeys.createdAt),
      })
      return keys.map(k => ({ ...k, keyHash: undefined }))
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        permissions: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const keyValue = `pk_${crypto.randomBytes(32).toString('hex')}`
        const prefix = keyValue.slice(0, 16)
        const hash = crypto.createHash('sha256').update(keyValue).digest('hex')
        
        const [key] = await db.insert(apiKeys).values({
          organizationId: ctx.orgId,
          name: input.name,
          keyPrefix: prefix,
          keyHash: hash,
          permissions: input.permissions || [],
          createdBy: ctx.user.id,
        }).returning()
        
        return { ...key, value: keyValue }
      }),

    revoke: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.update(apiKeys)
          .set({ revokedAt: new Date() })
          .where(and(
            eq(apiKeys.id, input.id),
            eq(apiKeys.organizationId, ctx.orgId)
          ))
        return { success: true }
      }),
  }),

  audit: createTRPCRouter({
    list: orgProcedure
      .input(z.object({
        limit: z.number().default(50),
        cursor: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const logs = await db.query.auditLogs.findMany({
          where: eq(auditLogs.organizationId, ctx.orgId),
          limit: input.limit,
          orderBy: desc(auditLogs.createdAt),
        })
        return logs
      }),
  }),
})

export type AppRouter = typeof appRouter
