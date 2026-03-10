/**
 * AI Unavailable Badge Component
 *
 * Displays a warning badge when AI provider is not configured or unreachable.
 * Links to Settings page for configuration. Used on pages with AI-dependent features.
 *
 * Features:
 * - Auto-hides when AI is available
 * - Cross-tab synchronization
 * - Accessible link to AI Configuration settings
 * - Transitions smoothly within 2 seconds of connection status change
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/app/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { getAIConfiguration } from '@/lib/aiConfiguration'

export function AIUnavailableBadge() {
  const [isAvailable, setIsAvailable] = useState(() => {
    const config = getAIConfiguration()
    return config.connectionStatus === 'connected'
  })

  useEffect(() => {
    function checkAvailability() {
      const config = getAIConfiguration()
      setIsAvailable(config.connectionStatus === 'connected')
    }

    function handleStorageUpdate(e: StorageEvent) {
      // Only respond to ai-configuration changes from other tabs
      if (e.key === 'ai-configuration') {
        checkAvailability()
      }
    }

    // Check initial status
    checkAvailability()

    // Listen for configuration changes (cross-tab sync)
    window.addEventListener('ai-configuration-updated', checkAvailability)
    window.addEventListener('storage', handleStorageUpdate)

    return () => {
      window.removeEventListener('ai-configuration-updated', checkAvailability)
      window.removeEventListener('storage', handleStorageUpdate)
    }
  }, [])

  // Hide badge when AI is available
  if (isAvailable) return null

  return (
    <Link to="/settings" data-testid="ai-unavailable-badge" aria-label="Configure AI provider">
      <Badge variant="destructive" className="gap-1.5 cursor-pointer hover:bg-destructive/90">
        <AlertTriangle className="size-3" aria-hidden="true" />
        AI unavailable
      </Badge>
    </Link>
  )
}
