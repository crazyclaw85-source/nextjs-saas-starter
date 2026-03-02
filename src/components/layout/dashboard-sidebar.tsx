'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Users,
  Settings,
  CreditCard,
  Key,
  FileText,
  Shield,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'API Keys', href: '/settings/api-keys', icon: Key },
  { name: 'Billing', href: '/settings/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const adminNavigation = [
  { name: 'Audit Logs', href: '/admin/audit', icon: FileText },
  { name: 'Admin', href: '/admin', icon: Shield },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 border-r bg-card min-h-screen flex flex-col">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg" />
          <span className="font-bold text-lg">SaaS Starter</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Main
        </div>
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          return (
            <Button
              key={item.name}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn('w-full justify-start gap-2', isActive && 'bg-secondary')}
              asChild
            >
              <Link href={item.href}>
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            </Button>
          )
        })}

        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6 px-2">
          Admin
        </div>
        {adminNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          return (
            <Button
              key={item.name}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn('w-full justify-start gap-2', isActive && 'bg-secondary')}
              asChild
            >
              <Link href={item.href}>
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            </Button>
          )
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="text-sm text-muted-foreground">
          <p>Free Plan</p>
          <p className="text-xs">3/3 members</p>
        </div>
      </div>
    </div>
  )
}
