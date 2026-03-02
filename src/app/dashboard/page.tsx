import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Users, Zap, CreditCard, Activity } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session.userId) {
    redirect('/sign-in')
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your account.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">+2 from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Requests</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2.4K</div>
              <p className="text-xs text-muted-foreground">of 10,000 limit</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscription</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Starter</div>
              <p className="text-xs text-muted-foreground">Renews on Dec 31</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Now</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+573</div>
              <p className="text-xs text-muted-foreground">+201 since last hour</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Usage Overview</CardTitle>
              <CardDescription>Your API usage this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span>API Requests</span>
                  <span className="font-medium">2,400 / 10,000</span>
                </div>
                <Progress value={24} className="mt-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span>Team Members</span>
                  <span className="font-medium">3 / 10</span>
                </div>
                <Progress value={30} className="mt-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span>Storage</span>
                  <span className="font-medium">1.2 GB / 10 GB</span>
                </div>
                <Progress value={12} className="mt-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you can perform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/team">Invite Team Member</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/settings/api-keys">Create API Key</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/settings/billing">Upgrade Plan</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/settings">View Settings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
