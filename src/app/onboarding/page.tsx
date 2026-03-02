import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth()
  
  if (!session.userId) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <OnboardingFlow />
    </div>
  )
}
