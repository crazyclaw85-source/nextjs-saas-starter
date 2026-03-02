'use client'

import { useOrganization } from '@clerk/nextjs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { CreditCardIcon, CalendarIcon } from 'lucide-react'

interface SubscriptionData {
  plan: string
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

async function getSubscriptionStatus(orgId: string): Promise<SubscriptionData> {
  const response = await fetch(`/api/organizations/${orgId}/subscription`)
  if (!response.ok) {
    throw new Error('Failed to fetch subscription')
  }
  return response.json()
}

export function SubscriptionStatus() {
  const { organization } = useOrganization()
  
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', organization?.id],
    queryFn: () => getSubscriptionStatus(organization!.id),
    enabled: !!organization?.id,
  })

  if (isLoading || !subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon className="w-5 h-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500'
      case 'trialing':
        return 'bg-blue-500'
      case 'past_due':
        return 'bg-yellow-500'
      case 'canceled':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCardIcon className="w-5 h-5" />
          Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold capitalize">{subscription.plan} Plan</div>
            <Badge className={getStatusColor(subscription.status)}>
              {subscription.status}
            </Badge>
          </div>
        </div>

        {subscription.currentPeriodEnd && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="w-4 h-4" />
            <span>
              {subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Manage Billing
          </Button>
          {subscription.plan === 'free' && (
            <Button size="sm">
              Upgrade Plan
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}