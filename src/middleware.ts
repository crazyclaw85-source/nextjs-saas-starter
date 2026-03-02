import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/app(.*)', '/onboarding(.*)'])
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/invite(.*)', '/api/webhooks(.*)'])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, orgId, redirectToSignIn } = await auth()
  
  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }
  
  // Require authentication for protected routes
  if (isProtectedRoute(req)) {
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url })
    }
  }
  
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}