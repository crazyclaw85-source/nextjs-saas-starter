import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { InviteDialog } from '@/components/team/invite-dialog'
import { MoreHorizontal, Mail } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const session = await auth()
  
  if (!session.userId) {
    redirect('/sign-in')
  }

  // Mock team members - in production, fetch from tRPC
  const members = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'owner', status: 'active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'admin', status: 'active' },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'member', status: 'active' },
  ]

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground">Manage your team members and their access.</p>
          </div>
          <InviteDialog />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>People with access to this organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="" />
                      <AvatarFallback>{member.name[0]}{member.name.split(' ')[1]?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>People who haven't accepted their invitation yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8 text-center">
              <div className="space-y-2">
                <Mail className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">No pending invites</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
