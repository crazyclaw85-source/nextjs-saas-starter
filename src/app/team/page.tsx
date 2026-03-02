'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { InviteDialog } from '@/components/team/invite-dialog'
import { MoreHorizontal, Mail, Loader2, Trash2 } from 'lucide-react'
import { useOrganization, useUser } from '@clerk/nextjs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TeamMember {
  id: string
  userId: string
  clerkId: string
  name: string | null
  email: string
  imageUrl: string | null
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

interface PendingInvite {
  id: string
  email: string
  role: string
  createdAt: string
  invitedBy: {
    name: string | null
    email: string
  }
}

export default function TeamPage() {
  const { organization } = useOrganization()
  const { user } = useUser()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member'>('member')

  useEffect(() => {
    if (organization) {
      fetchTeamData()
    }
  }, [organization])

  const fetchTeamData = async () => {
    try {
      setLoading(true)
      
      // Fetch team members
      const membersResponse = await fetch(`/api/teams/${organization!.id}/members`)
      if (membersResponse.ok) {
        const membersData = await membersResponse.json()
        setMembers(membersData.members)
        setUserRole(membersData.userRole)
      }

      // Fetch pending invites
      const invitesResponse = await fetch(`/api/teams/invites?organizationId=${organization!.id}`)
      if (invitesResponse.ok) {
        const invitesData = await invitesResponse.json()
        setInvites(invitesData.invites)
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberClerkId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      const response = await fetch(`/api/teams/${organization!.id}/members?userId=${memberClerkId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchTeamData() // Refresh data
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to remove member')
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
      alert('Failed to remove member')
    }
  }

  const canManageMembers = ['owner', 'admin'].includes(userRole)

  if (!organization || !user) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-lg font-semibold">No Organization Selected</h2>
            <p className="text-muted-foreground">Please select an organization to manage your team.</p>
          </div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground">Manage your team members and their access.</p>
          </div>
          {canManageMembers && <InviteDialog />}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>People with access to this organization.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={member.imageUrl || ''} />
                        <AvatarFallback>
                          {member.name 
                            ? member.name.split(' ').map(n => n[0]).join('').toUpperCase()
                            : member.email[0].toUpperCase()
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name || 'Unnamed User'}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                      {canManageMembers && member.role !== 'owner' && member.clerkId !== user.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleRemoveMember(member.clerkId)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>People who haven't accepted their invitation yet.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : invites.length > 0 ? (
              <div className="space-y-4">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Invited by {invite.invitedBy.name || invite.invitedBy.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sent {new Date(invite.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{invite.role}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 text-center">
                <div className="space-y-2">
                  <Mail className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">No pending invites</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}