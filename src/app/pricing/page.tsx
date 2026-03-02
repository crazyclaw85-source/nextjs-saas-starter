'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckIcon } from 'lucide-react'
import { PRICING_PLANS, getPaddleClient } from '@/lib/paddle'
import { useUser, useOrganization } from '@clerk/nextjs'

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const { user } = useUser()
  const { organization } = useOrganization()

  const handleCheckout = async (priceId: string, planId: string) => {
    if (!user || !organization) return

    try {
      setLoading(planId)
      const paddle = await getPaddleClient()
      
      if (!paddle) {
        throw new Error('Paddle not initialized')
      }

      await paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: {
          email: user.emailAddresses[0]?.emailAddress,
        },
        customData: {
          organizationId: organization.id,
          userId: user.id,
        },
        settings: {
          allowLogout: false,
          successUrl: `${window.location.origin}/dashboard?checkout=success`,
        },
      })
    } catch (error) {
      console.error('Checkout error:', error)
      // In a real app, show error toast
      alert('Checkout failed. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground">
          Select the perfect plan for your team
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
        {Object.entries(PRICING_PLANS).map(([id, plan]) => (
          <Card 
            key={id} 
            className={`relative ${plan.id === 'starter' ? 'border-primary shadow-lg scale-105' : ''}`}
          >
            {plan.id === 'starter' && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <p className="text-sm text-muted-foreground mb-4">
                {plan.description}
              </p>
              <div className="text-3xl font-bold">
                {plan.price === null ? (
                  <span>Custom</span>
                ) : plan.price === 0 ? (
                  <span>Free</span>
                ) : (
                  <>
                    <span>${plan.price}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      /month
                    </span>
                  </>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.id === 'starter' ? 'default' : 'outline'}
                disabled={!user || !organization || loading !== null || !plan.priceId}
                onClick={() => plan.priceId && handleCheckout(plan.priceId, plan.id)}
              >
                {loading === plan.id ? (
                  'Loading...'
                ) : plan.price === 0 ? (
                  'Current Plan'
                ) : plan.price === null ? (
                  'Contact Sales'
                ) : (
                  'Subscribe'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center mt-16 text-sm text-muted-foreground">
        <p>All plans include a 14-day free trial. Cancel anytime.</p>
        <p className="mt-2">
          Questions? <a href="mailto:support@example.com" className="text-primary hover:underline">Contact support</a>
        </p>
      </div>
    </div>
  )
}