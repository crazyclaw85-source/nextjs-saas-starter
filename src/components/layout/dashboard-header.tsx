'use client'

import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Bell, Plus } from 'lucide-react'
import Link from 'next/link'

export function DashboardHeader() {
  return (
    <header className="border-b bg-card px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              rootBox: 'w-auto',
              organizationSwitcherTrigger: 'py-2 px-3 border rounded-md hover:bg-accent',
            },
          }}
        />
        <Button size="sm" asChild>
          <Link href="/onboarding/create-org">
            <Plus className="w-4 h-4 mr-1" />
            New Org
          </Link>
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Bell className="w-5 h-5" />
        </Button>
        <UserButton
          appearance={{
            elements: {
              userButtonTrigger: 'w-9 h-9',
            },
          }}
        />
      </div>
    </header>
  )
}
