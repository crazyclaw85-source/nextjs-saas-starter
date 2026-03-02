import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { organizationInvites, organizations, organizationMembers, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { AcceptInviteForm } from '@/components/team/accept-invite-form'

interface InvitePageProps {
  params: {
    token: string
  }
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = params
  const session = await auth()

  // Fetch invite details
  const invite = await db.query.organizationInvites.findFirst({
    where: eq(organizationInvites.token, token),
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
          clerkOrgId: true,
        },
      },
      invitedBy: {
        columns: {
          name: true,
          email: true,
        },
      },
    },
  })

  if (!invite) {
    notFound()
  }

  // Check if invite is expired
  if (new Date() > invite.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h2 className="text-2xl font-bold">Invitation Expired</h2>
            <p className="text-muted-foreground mt-2">
              This invitation has expired. Please request a new one from your team administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Check if invite is already accepted
  if (invite.status !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h2 className="text-2xl font-bold">Invitation Already Used</h2>
            <p className="text-muted-foreground mt-2">
              This invitation has already been accepted.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // If user is logged in, check if they can accept this invite
  if (session?.userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, session.userId),
    })

    if (user && user.email !== invite.email) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-md w-full space-y-8 text-center">
            <div>
              <h2 className="text-2xl font-bold">Email Mismatch</h2>
              <p className="text-muted-foreground mt-2">
                This invitation was sent to {invite.email}, but you're logged in as {user.email}.
                Please log out and sign in with the correct email address.
              </p>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Team Invitation</h2>
          <p className="text-muted-foreground mt-2">
            You've been invited to join <strong>{invite.organization.name}</strong>
          </p>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Organization:</span>
              <span className="text-sm font-medium">{invite.organization.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Role:</span>
              <span className="text-sm font-medium capitalize">{invite.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Invited by:</span>
              <span className="text-sm font-medium">{invite.invitedBy.name || invite.invitedBy.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Expires:</span>
              <span className="text-sm font-medium">{invite.expiresAt.toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <AcceptInviteForm 
          token={token}
          organizationName={invite.organization.name}
          email={invite.email}
          isLoggedIn={!!session?.userId}
        />
      </div>
    </div>
  )
}