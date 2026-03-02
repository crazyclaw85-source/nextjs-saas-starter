'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Building2, Check, Loader2 } from 'lucide-react'
import { useOrganization, useOrganizationList } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

interface Organization {
  id: string
  name: string
  slug: string | null
  role: string
  imageUrl?: string | null
}

export function OrganizationSwitcher() {
  const { organization: currentOrg } = useOrganization()
  const { organizationList, setActive, isLoaded } = useOrganizationList()
  const [switching, setSwitching] = useState(false)
  const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([])
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && organizationList) {
      const orgs = organizationList.map(orgMembership => ({
        id: orgMembership.organization.id,
        name: orgMembership.organization.name,
        slug: orgMembership.organization.slug,
        role: orgMembership.role,
        imageUrl: orgMembership.organization.imageUrl,
      }))
      setAvailableOrgs(orgs)
    }
  }, [isLoaded, organizationList])

  const handleOrganizationSwitch = async (organizationId: string) => {
    if (!setActive) return

    setSwitching(true)
    try {
      // First validate the switch with our backend
      const response = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to switch organization')
      }

      // Switch in Clerk
      await setActive({ organization: organizationId })

      // Refresh the page to update all org-scoped data
      router.refresh()
    } catch (error) {
      console.error('Organization switch failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to switch organization')
    } finally {
      setSwitching(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading organizations...</span>
      </div>
    )
  }

  if (availableOrgs.length <= 1) {
    // Only one or no organizations, show current org name
    return (
      <div className="flex items-center gap-2">
        <Avatar className="w-6 h-6">
          <AvatarImage src={currentOrg?.imageUrl || ''} />
          <AvatarFallback>
            <Building2 className="w-3 h-3" />
          </AvatarFallback>
        </Avatar>
        <span className="font-medium">{currentOrg?.name || 'No Organization'}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentOrg?.id || ''}
        onValueChange={handleOrganizationSwitch}
        disabled={switching}
      >
        <SelectTrigger className="w-[200px]">
          <div className="flex items-center gap-2">
            <Avatar className="w-5 h-5">
              <AvatarImage src={currentOrg?.imageUrl || ''} />
              <AvatarFallback>
                <Building2 className="w-3 h-3" />
              </AvatarFallback>
            </Avatar>
            <SelectValue placeholder="Select organization" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {availableOrgs.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              <div className="flex items-center gap-2 w-full">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={org.imageUrl || ''} />
                  <AvatarFallback>
                    {org.name[0]?.toUpperCase() || 'O'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{org.name}</span>
                    {currentOrg?.id === org.id && (
                      <Check className="w-3 h-3 text-green-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {org.role}
                    </Badge>
                    {org.slug && (
                      <span className="text-xs text-muted-foreground">
                        {org.slug}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {switching && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Switching...
        </div>
      )}
    </div>
  )
}

/**
 * Compact organization switcher for mobile or constrained spaces
 */
export function CompactOrgSwitcher() {
  const { organization: currentOrg } = useOrganization()
  const { organizationList } = useOrganizationList()

  if (!organizationList || organizationList.length <= 1) {
    return null
  }

  return (
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
      <Avatar className="w-6 h-6">
        <AvatarImage src={currentOrg?.imageUrl || ''} />
        <AvatarFallback>
          <Building2 className="w-3 h-3" />
        </AvatarFallback>
      </Avatar>
    </Button>
  )
}