import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Upstash Redis credentials not configured')
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Rate limiters
export const ratelimit = {
  // Strict limit for auth endpoints
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  
  // General API limit
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  
  // Generous limit for webhooks
  webhook: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 m'),
    analytics: true,
    prefix: 'ratelimit:webhook',
  }),
  
  // Organization-scoped limits
  org: (orgId: string) => new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 h'),
    analytics: true,
    prefix: `ratelimit:org:${orgId}`,
  }),
}

export async function checkRateLimit(
  type: 'auth' | 'api' | 'webhook',
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = ratelimit[type]
  const result = await limiter.limit(identifier)
  
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

export async function checkOrgRateLimit(
  orgId: string,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = ratelimit.org(orgId)
  const result = await limiter.limit(identifier)
  
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}