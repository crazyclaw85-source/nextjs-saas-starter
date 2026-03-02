import { authMiddleware } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

export default authMiddleware({
  publicRoutes: [
    '/',
    '/pricing',
    '/api/health',
    '/api/webhooks/paddle',
    '/invite/(.*)',
    '/sign-in(.*)',
    '/sign-up(.*)',
  ],
  
  // Organization-based routing and access control
  afterAuth(auth, req) {
    const { pathname } = req.nextUrl
    
    // Skip org validation for public routes and API routes that don't need it
    const skipOrgValidation = [
      '/api/health',
      '/api/webhooks',
      '/api/teams', // Team creation doesn't require existing org
      '/invite',
      '/sign-in',
      '/sign-up',
      '/pricing',
    ].some(route => pathname.startsWith(route))

    if (skipOrgValidation) {
      return NextResponse.next()
    }

    // If user is authenticated but accessing protected routes
    if (auth.userId && !auth.isPublicRoute) {
      // For dashboard and app routes, ensure user has organization context
      const isDashboardRoute = pathname.startsWith('/dashboard') || 
                              pathname.startsWith('/team') || 
                              pathname.startsWith('/settings') ||
                              pathname.startsWith('/onboarding')

      if (isDashboardRoute && !auth.orgId) {
        // Redirect to organization selection if no org context
        return NextResponse.redirect(new URL('/onboarding', req.url))
      }

      // Add security headers for tenant isolation
      const response = NextResponse.next()
      response.headers.set('X-Tenant-Context', auth.orgId || 'none')
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      
      return response
    }

    return NextResponse.next()
  },

  // Custom organization validation
  beforeAuth(req) {
    // Add any custom logic before authentication
    const response = NextResponse.next()
    response.headers.set('X-Multi-Tenant', 'enabled')
    return response
  },
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}