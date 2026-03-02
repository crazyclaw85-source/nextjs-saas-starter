import { initTRPC, TRPCError } from '@trpc/server'
import { type NextRequest } from 'next/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { getAuthContext, requireAuth, requireOrg, requireOwnerOrAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

type CreateContextOptions = {
  req: NextRequest
}

export const createTRPCContext = async (opts: CreateContextOptions) => {
  const authContext = await getAuthContext()
  
  return {
    ...authContext,
    db,
    req: opts.req,
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      user: ctx.user,
    },
  })
})

export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.orgId || !ctx.organization || !ctx.membership) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization required' })
  }
  return next({
    ctx: {
      ...ctx,
      orgId: ctx.orgId,
      organization: ctx.organization,
      membership: ctx.membership,
    },
  })
})

export const adminProcedure = orgProcedure.use(async ({ ctx, next }) => {
  if (!['owner', 'admin'].includes(ctx.membership.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
  }
  return next()
})
