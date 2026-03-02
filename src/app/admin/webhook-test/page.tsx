'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Webhook, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'
import { useOrganization } from '@clerk/nextjs'

interface WebhookTestResult {
  success: boolean
  eventId?: string
  eventType?: string
  processingTime?: number
  result?: any
  error?: string
}

const SAMPLE_EVENTS = {
  'subscription.created': {
    event_id: 'evt_test_subscription_created',
    event_type: 'subscription.created',
    occurred_at: new Date().toISOString(),
    data: {
      subscription: {
        id: 'sub_test_123',
        status: 'active',
        items: [{
          price: {
            product: {
              name: 'Pro Plan'
            }
          }
        }],
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }
      },
      customer: {
        id: 'cus_test_123',
        email: 'test@example.com'
      },
      custom_data: {
        organizationId: 'test-org-id'
      }
    }
  },
  'subscription.updated': {
    event_id: 'evt_test_subscription_updated',
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      subscription: {
        id: 'sub_test_123',
        status: 'active',
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        scheduled_change: null
      },
      custom_data: {
        organizationId: 'test-org-id'
      }
    }
  },
  'subscription.canceled': {
    event_id: 'evt_test_subscription_canceled',
    event_type: 'subscription.canceled',
    occurred_at: new Date().toISOString(),
    data: {
      subscription: {
        id: 'sub_test_123',
        status: 'canceled'
      },
      custom_data: {
        organizationId: 'test-org-id'
      }
    }
  },
  'transaction.payment_failed': {
    event_id: 'evt_test_payment_failed',
    event_type: 'transaction.payment_failed',
    occurred_at: new Date().toISOString(),
    data: {
      transaction: {
        id: 'txn_test_123',
        status: 'failed',
        failure_reason: 'Card declined',
        details: {
          total_amount: 2900
        },
        currency_code: 'USD'
      },
      custom_data: {
        organizationId: 'test-org-id'
      }
    }
  },
  'transaction.completed': {
    event_id: 'evt_test_payment_completed',
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: {
      transaction: {
        id: 'txn_test_123',
        status: 'completed',
        details: {
          total_amount: 2900
        },
        currency_code: 'USD'
      },
      custom_data: {
        organizationId: 'test-org-id'
      }
    }
  }
}

export default function WebhookTestPage() {
  const { organization } = useOrganization()
  const [selectedEvent, setSelectedEvent] = useState<string>('subscription.created')
  const [customPayload, setCustomPayload] = useState<string>('')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<WebhookTestResult | null>(null)
  const [useCustomPayload, setUseCustomPayload] = useState(false)

  const testWebhook = async () => {
    setTesting(true)
    setResult(null)

    try {
      let payload
      
      if (useCustomPayload) {
        try {
          payload = JSON.parse(customPayload)
        } catch (error) {
          throw new Error('Invalid JSON in custom payload')
        }
      } else {
        payload = SAMPLE_EVENTS[selectedEvent as keyof typeof SAMPLE_EVENTS]
        
        // Replace test org ID with current organization if available
        if (organization?.id && payload.data.custom_data) {
          payload.data.custom_data.organizationId = organization.id
        }
      }

      console.log('Sending webhook test:', payload)

      const response = await fetch('/api/webhooks/paddle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // For testing, we'll skip signature validation by using a test mode
          'X-Test-Mode': 'true'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      setResult({
        success: response.ok,
        eventId: data.eventId,
        eventType: data.eventType,
        processingTime: data.processingTime,
        result: data.result || data,
        error: data.error,
      })
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setTesting(false)
    }
  }

  const getEventDescription = (eventType: string) => {
    switch (eventType) {
      case 'subscription.created':
        return 'Creates new subscription and updates organization status'
      case 'subscription.updated':
        return 'Updates subscription details and billing period'
      case 'subscription.canceled':
        return 'Cancels subscription and downgrades to free plan'
      case 'transaction.payment_failed':
        return 'Handles failed payment and marks subscription past due'
      case 'transaction.completed':
        return 'Logs successful payment completion'
      default:
        return 'Test webhook event processing'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <Webhook className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Paddle Webhook Tester</h1>
            <p className="text-muted-foreground">
              Test webhook event processing and validation
            </p>
          </div>
        </div>

        {/* Current Context */}
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>Configure webhook test parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Organization Context</label>
                <div className="text-sm bg-muted p-2 rounded">
                  {organization?.name || 'No organization selected'}
                  {organization?.id && (
                    <div className="text-xs text-muted-foreground mt-1">
                      ID: {organization.id}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Webhook Endpoint</label>
                <div className="text-sm bg-muted p-2 rounded font-mono">
                  /api/webhooks/paddle
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Event Type</CardTitle>
            <CardDescription>Choose a webhook event to test</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={useCustomPayload ? 'outline' : 'default'}
                onClick={() => setUseCustomPayload(false)}
              >
                Sample Events
              </Button>
              <Button
                variant={useCustomPayload ? 'default' : 'outline'}
                onClick={() => setUseCustomPayload(true)}
              >
                Custom Payload
              </Button>
            </div>

            {!useCustomPayload ? (
              <div className="space-y-4">
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(SAMPLE_EVENTS).map((eventType) => (
                      <SelectItem key={eventType} value={eventType}>
                        {eventType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="text-sm text-muted-foreground">
                  {getEventDescription(selectedEvent)}
                </div>

                <details className="border rounded p-4">
                  <summary className="cursor-pointer font-medium">
                    View Sample Payload
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(
                      SAMPLE_EVENTS[selectedEvent as keyof typeof SAMPLE_EVENTS], 
                      null, 
                      2
                    )}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom JSON Payload</label>
                <Textarea
                  placeholder="Enter webhook JSON payload..."
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Webhook</CardTitle>
            <CardDescription>Send test webhook to verify processing</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testWebhook}
              disabled={testing || (!selectedEvent && !customPayload.trim())}
              size="lg"
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Webhook...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Send Test Webhook
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.success ? (
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Webhook processed successfully!
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {result.eventId && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Event ID</label>
                        <div className="text-sm font-mono">{result.eventId}</div>
                      </div>
                    )}
                    {result.eventType && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Event Type</label>
                        <div className="text-sm">
                          <Badge variant="secondary">{result.eventType}</Badge>
                        </div>
                      </div>
                    )}
                    {result.processingTime && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Processing Time</label>
                        <div className="text-sm flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {result.processingTime}ms
                        </div>
                      </div>
                    )}
                  </div>

                  {result.result && (
                    <details className="border rounded p-4">
                      <summary className="cursor-pointer font-medium">
                        Processing Details
                      </summary>
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <div className="font-medium">Webhook Test Failed</div>
                    <div className="mt-1">{result.error}</div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Webhook Security Info */}
        <Card>
          <CardHeader>
            <CardTitle>Security Validation</CardTitle>
            <CardDescription>Webhook security features implemented</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium">Security Features</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>HMAC-SHA256 signature verification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Timing-safe signature comparison</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Idempotency with event deduplication</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Error handling and logging</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Event Processing</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Subscription lifecycle management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Payment failure handling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Automatic status updates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Audit logging</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}