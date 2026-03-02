import Paddle from '@paddle/paddle-node-sdk'
import { initializePaddle } from '@paddle/paddle-js'

if (!process.env.PADDLE_API_KEY) {
  throw new Error('PADDLE_API_KEY is not set')
}

if (!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) {
  throw new Error('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set')
}

// Server-side Paddle SDK
export const paddle = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
})

// Client-side Paddle instance
export const getPaddleClient = () => {
  return initializePaddle({
    token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
    environment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  })
}

// Pricing plans configuration
export const PRICING_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'For individuals and small projects',
    price: 0,
    features: [
      'Up to 3 team members',
      '1,000 API requests/month',
      'Basic analytics',
      'Email support',
    ],
    limits: {
      members: 3,
      apiRequests: 1000,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For growing teams',
    priceId: process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID,
    price: 29,
    features: [
      'Up to 10 team members',
      '10,000 API requests/month',
      'Advanced analytics',
      'Priority support',
      'Custom integrations',
    ],
    limits: {
      members: 10,
      apiRequests: 10000,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For larger organizations',
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID,
    price: 99,
    features: [
      'Unlimited team members',
      '100,000 API requests/month',
      'Premium analytics',
      '24/7 support',
      'Custom integrations',
      'SSO/SAML',
      'Audit logs',
    ],
    limits: {
      members: null,
      apiRequests: 100000,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large scale deployments',
    priceId: process.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE_ID,
    price: null,
    features: [
      'Unlimited everything',
      'Custom API limits',
      'Dedicated support',
      'SLA guarantee',
      'Custom contracts',
      'On-premise option',
    ],
    limits: {
      members: null,
      apiRequests: null,
    },
  },
} as const

export type PlanId = keyof typeof PRICING_PLANS