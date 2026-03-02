'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AcceptInviteFormProps {
  token: string
  organizationName: string
  email: string
  isLoggedIn: boolean
}

export function AcceptInviteForm({ 
  token, 
  organizationName, 
  email, 
  isLoggedIn 
}: AcceptInviteFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleAccept = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/teams/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation')
      }

      // Redirect to dashboard
      router.push('/dashboard?invite=accepted')
    } catch (error) {
      console.error('Accept invite error:', error)
      setError(error instanceof Error ? error.message : 'Failed to accept invitation')
    } finally {
      setLoading(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          You need to sign in with {email} to accept this invitation.
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link href={`/sign-in?redirect=${encodeURIComponent(window.location.href)}`}>
              Sign In
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/sign-up?redirect=${encodeURIComponent(window.location.href)}`}>
              Create Account
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button 
          onClick={handleAccept}
          disabled={loading}
          className="w-full"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Accept Invitation
        </Button>
        
        <Button variant="outline" asChild>
          <Link href="/">
            Decline
          </Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        By accepting this invitation, you'll become a member of {organizationName} 
        and gain access to their workspace.
      </p>
    </div>
  )
}