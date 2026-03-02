'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useOrganization, useUser } from '@clerk/nextjs'
import { OrganizationSwitcher } from '@/components/org-switcher'

interface TestResult {
  name: string
  passed: boolean
  duration?: number
  details?: string
}

interface IsolationTestResponse {
  success: boolean
  message?: string
  error?: string
  tests?: TestResult[]
  timestamp?: string
}

export default function IsolationTestPage() {
  const { organization } = useOrganization()
  const { user } = useUser()
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<IsolationTestResponse | null>(null)

  const runIsolationTest = async () => {
    if (!organization) {
      alert('Please select an organization first')
      return
    }

    setTesting(true)
    setResults(null)

    try {
      const response = await fetch('/api/admin/test-isolation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      setResults(data)
    } catch (error) {
      setResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setTesting(false)
    }
  }

  const testApiEndpoint = async (endpoint: string) => {
    try {
      const response = await fetch(endpoint)
      const data = await response.json()
      
      if (response.ok) {
        alert(`✅ API Test Success: ${JSON.stringify(data, null, 2)}`)
      } else {
        alert(`❌ API Test Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`❌ API Test Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-600" />
              Multi-Tenant Isolation Test
            </h1>
            <p className="text-muted-foreground mt-2">
              Verify data isolation and security across organizations
            </p>
          </div>
          <OrganizationSwitcher />
        </div>

        {/* Current Context */}
        <Card>
          <CardHeader>
            <CardTitle>Current Context</CardTitle>
            <CardDescription>Your current authentication and organization context</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">User</label>
                <div className="text-sm">
                  {user?.emailAddresses[0]?.emailAddress || 'Not logged in'}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {user?.id || 'N/A'}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Organization</label>
                <div className="text-sm">
                  {organization?.name || 'No organization selected'}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {organization?.id || 'N/A'}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Role</label>
                <div className="text-sm">
                  <Badge variant="secondary">
                    {organization ? 'Member' : 'None'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Data Isolation Tests</CardTitle>
            <CardDescription>
              Run comprehensive tests to verify multi-tenant data isolation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={runIsolationTest}
                disabled={testing || !organization}
                size="lg"
              >
                {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Run Full Isolation Test
              </Button>

              <Button 
                variant="outline"
                onClick={() => testApiEndpoint('/api/teams/members')}
                disabled={!organization}
              >
                Test Team API
              </Button>

              <Button 
                variant="outline"
                onClick={() => testApiEndpoint('/api/admin/test-isolation')}
                disabled={!organization}
              >
                Test Admin API
              </Button>
            </div>

            {!organization && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Please select an organization using the switcher above to run tests.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Test Results */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {results.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                Test Results
              </CardTitle>
              <CardDescription>
                {results.timestamp && `Completed at ${new Date(results.timestamp).toLocaleString()}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results.success ? (
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      {results.message || 'All tests passed successfully!'}
                    </AlertDescription>
                  </Alert>

                  {results.tests && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Test Details:</h4>
                      {results.tests.map((test, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>{test.name}</span>
                          {test.duration && (
                            <span className="text-muted-foreground">
                              ({test.duration}ms)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <div className="font-medium">Test Failed</div>
                    <div className="mt-1">{results.error}</div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Security Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Security Checklist</CardTitle>
            <CardDescription>Key multi-tenancy security features implemented</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium">Data Isolation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Automatic org_id filtering</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Database-level scoping</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>No cross-tenant data leakage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Query isolation verification</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Access Control</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Role-based permissions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Safe organization switching</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Middleware enforcement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>API endpoint protection</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
            <CardDescription>Multi-tenant aware API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="font-mono bg-muted p-2 rounded">
                  <span className="text-green-600">GET</span> /api/teams/members - Org-scoped member list
                </div>
                <div className="font-mono bg-muted p-2 rounded">
                  <span className="text-blue-600">POST</span> /api/organizations/switch - Safe org switching
                </div>
                <div className="font-mono bg-muted p-2 rounded">
                  <span className="text-blue-600">POST</span> /api/admin/test-isolation - Run isolation tests
                </div>
                <div className="font-mono bg-muted p-2 rounded">
                  <span className="text-blue-600">POST</span> /api/teams/invites - Org-scoped invitations
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}