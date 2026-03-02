'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DashboardSidebar } from './dashboard-sidebar'
import { DashboardHeader } from './dashboard-header'

interface DashboardShellProps {
  children: ReactNode
  className?: string
}

export function DashboardShell({ children, className }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className={cn('p-6', className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
