import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { testDataIsolation } from '@/lib/test-isolation'
import { getTenantContext } from '@/lib/multi-tenant'

export async function POST(req: NextRequest) {
  try {
    // Only allow authenticated users
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context to verify admin access
    const context = await getTenantContext()
    if (!context || !context.permissions.includes('admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log('Starting multi-tenant isolation test...')
    
    // Run the isolation test
    const result = await testDataIsolation()
    
    if (result.success) {
      console.log('✅ All isolation tests passed')
      return NextResponse.json({
        success: true,
        message: result.message,
        tests: result.tests,
        timestamp: new Date().toISOString(),
      })
    } else {
      console.error('❌ Isolation test failed:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Test isolation error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return test status and information
    return NextResponse.json({
      available: true,
      description: 'Multi-tenant data isolation test endpoint',
      tests: [
        'Organization member isolation',
        'Query isolation with invalid org ID',
        'Org-specific data access verification'
      ],
      usage: {
        method: 'POST',
        authentication: 'Required (admin role)',
        description: 'Run comprehensive data isolation tests'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get test information' },
      { status: 500 }
    )
  }
}