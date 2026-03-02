'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUser, useOrganization } from '@clerk/nextjs'

export default function TestCheckoutPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const { user } = useUser()
  const { organization } = useOrganization()

  const testCheckout = async () => {
    if (!user || !organization) {
      setResult('❌ User or organization not found')
      return
    }

    try {
      setLoading(true)
      setResult('🔄 Creating checkout session...')

      // Test checkout creation
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID || 'test-price-id',
          organizationId: organization.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        setResult(`❌ Checkout creation failed: ${error.error}`)
        return
      }

      const data = await response.json()
      setResult(`✅ Checkout created successfully!\n🔗 URL: ${data.checkoutUrl}\n🆔 ID: ${data.checkoutId}`)

      // In a real test, you could open the checkout URL
      // window.open(data.checkoutUrl, '_blank')
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const testWebhook = async () => {
    setLoading(true)
    setResult('🔄 Testing webhook endpoint...')

    try {
      const testEvent = {
        event_id: 'test-' + Date.now(),
        event_type: 'subscription.created',
        occurred_at: new Date().toISOString(),
        data: {
          subscription: {
            id: 'sub_test_123',
            status: 'active',
            current_billing_period: {
              starts_at: new Date().toISOString(),
              ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          },
          custom_data: {
            organizationId: organization?.id,
          },
        },
      }

      // Note: This won't work without proper signature, but tests the endpoint
      const response = await fetch('/api/webhooks/paddle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paddle-signature': 'test-signature',
        },
        body: JSON.stringify(testEvent),
      })

      const responseText = await response.text()
      setResult(`📡 Webhook test response (${response.status}): ${responseText}`)
    } catch (error) {
      setResult(`❌ Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>🧪 Paddle Checkout Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Current Context:</h3>
            <div className="text-sm space-y-1">
              <div>👤 User: {user?.emailAddresses[0]?.emailAddress || 'Not logged in'}</div>
              <div>🏢 Organization: {organization?.name || 'No organization'}</div>
              <div>🆔 Org ID: {organization?.id || 'N/A'}</div>
            </div>
          </div>

          {/* Environment Check */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Environment Check:</h3>
            <div className="text-sm space-y-1">
              <div>
                🎯 Paddle Environment: {process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || 'Not set'}
              </div>
              <div>
                🔑 Client Token: {process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ? '✅ Set' : '❌ Missing'}
              </div>
              <div>
                💰 Starter Price ID: {process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID || '❌ Missing'}
              </div>
            </div>
          </div>

          {/* Test Actions */}
          <div className="space-y-4">
            <Button 
              onClick={testCheckout}
              disabled={loading || !user || !organization}
              className="w-full"
            >
              {loading ? '⏳ Testing...' : '🚀 Test Checkout Creation'}
            </Button>

            <Button 
              onClick={testWebhook}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? '⏳ Testing...' : '📡 Test Webhook Endpoint'}
            </Button>
          </div>

          {/* Results */}
          {result && (
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Test Result:</h3>
              <pre className="text-sm whitespace-pre-wrap">{result}</pre>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">📝 Manual Test Steps:</h3>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Set up Paddle sandbox account</li>
              <li>Configure environment variables in .env.local</li>
              <li>Create test price IDs in Paddle dashboard</li>
              <li>Run checkout test above</li>
              <li>Complete payment with test card: 4000 0000 0000 0002</li>
              <li>Verify subscription status updates in database</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}