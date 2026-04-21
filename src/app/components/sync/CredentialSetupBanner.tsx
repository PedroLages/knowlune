/**
 * CredentialSetupBanner — E97-S05 Unit 5
 *
 * Dismissible banner listing missing credentials with per-entry deep-link
 * buttons and a "Why?" popover explaining the Vault broker model (AC1, AC2, AC5, AC6).
 *
 * Layout:
 *   - AI: exactly one user-level row ("AI provider keys need setup") → navigates
 *     to /settings?section=integrations (section-level, no focus param).
 *   - OPDS per-id: dispatches open-opds-settings CustomEvent → Library.tsx handles.
 *   - ABS per-id: dispatches open-abs-settings CustomEvent → Library.tsx handles.
 *
 * AC6: Banner auto-dismisses when missing empties; explicit X-dismiss persists
 *      in sessionStorage keyed per user.
 *
 * @module CredentialSetupBanner
 * @since E97-S05
 */

import { useEffect, useRef, useState } from 'react'
import { useLiveRegion } from '@/app/hooks/useLiveRegion'
import {
  KeyRound,
  Globe,
  Headphones,
  X,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover'
import { useMissingCredentials } from '@/app/hooks/useMissingCredentials'
import { useAuthStore } from '@/stores/useAuthStore'
import type { MissingCredential } from '@/lib/credentials/credentialStatus'

// ─── Session storage helpers ──────────────────────────────────────────────

function getDismissKey(userId: string): string {
  return `knowlune:credential-banner-dismissed:${userId}`
}

function isDismissed(userId: string): boolean {
  try {
    return sessionStorage.getItem(getDismissKey(userId)) === 'true'
  } catch {
    return false
  }
}

function setDismissed(userId: string): void {
  try {
    sessionStorage.setItem(getDismissKey(userId), 'true')
  } catch {
    // silent-catch-ok: sessionStorage unavailable (e.g., private browsing extreme mode)
  }
}

function clearDismissed(userId: string): void {
  try {
    sessionStorage.removeItem(getDismissKey(userId))
  } catch {
    // silent-catch-ok
  }
}

// ─── Row renderer helpers ─────────────────────────────────────────────────

interface RowProps {
  entry: MissingCredential
  onNavigate: (path: string) => void
}

function MissingCredentialRow({ entry, onNavigate }: RowProps) {
  const Icon =
    entry.kind === 'ai-provider'
      ? KeyRound
      : entry.kind === 'opds-catalog'
        ? Globe
        : Headphones

  function handleAction() {
    if (entry.kind === 'ai-provider') {
      // Section-level navigation — no focus param for AI (R2 / plan Unit 5)
      onNavigate('/settings?section=integrations')
    } else if (entry.kind === 'opds-catalog') {
      window.dispatchEvent(
        new CustomEvent('open-opds-settings', { detail: { focusId: entry.id } })
      )
    } else {
      window.dispatchEvent(
        new CustomEvent('open-abs-settings', { detail: { focusId: entry.id } })
      )
    }
  }

  const label =
    entry.kind === 'ai-provider'
      ? 'AI provider keys need setup'
      : entry.displayName

  const buttonLabel =
    entry.kind === 'ai-provider' ? 'Set up' : 'Re-enter'

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm truncate">{label}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleAction}
        className="shrink-0 min-h-[36px] text-xs"
        data-testid={`credential-banner-action-${entry.kind}-${entry.id}`}
      >
        {buttonLabel}
      </Button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────

export function CredentialSetupBanner() {
  const user = useAuthStore(s => s.user)
  const { missing, loading } = useMissingCredentials()
  const { announce } = useLiveRegion()

  const [dismissed, setDismissedState] = useState(() => {
    if (!user) return false
    return isDismissed(user.id)
  })

  const prevMissingLengthRef = useRef(missing.length)
  // Tracks whether we've announced in the current visible session so we
  // only fire once per appearance (not on every render).
  const announcedRef = useRef(false)

  // AC6: When missing transitions from 0 → N, clear dismissal flag so banner reappears.
  useEffect(() => {
    if (!user) return
    const prevLen = prevMissingLengthRef.current
    const currentLen = missing.length

    if (prevLen === 0 && currentLen > 0 && dismissed) {
      clearDismissed(user.id)
      setDismissedState(false)
    }

    prevMissingLengthRef.current = currentLen
  }, [missing.length, user, dismissed])

  // Announce once when the banner becomes visible. Reset the flag when the
  // banner hides (dismissed or missing empties) so re-appearance re-announces.
  const isVisible = !loading && missing.length > 0 && !dismissed
  useEffect(() => {
    if (!isVisible) {
      announcedRef.current = false
      return
    }
    if (announcedRef.current) return
    announcedRef.current = true
    announce('Credential setup required: some connections need configuration.')
  }, [isVisible, announce])

  function handleDismiss() {
    if (!user) return
    setDismissed(user.id)
    setDismissedState(true)
  }

  // Use window.location.assign so the banner can be mounted outside the RouterProvider
  // (it lives in App.tsx above the RouterProvider to ensure it renders on every route).
  function handleNavigate(path: string) {
    window.location.assign(path)
  }

  // Render nothing when loading, empty, or dismissed
  if (loading || missing.length === 0 || dismissed) {
    return null
  }

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 pointer-events-none"
      data-testid="credential-setup-banner"
    >
      <Alert className="pointer-events-auto shadow-lg border-warning/40 bg-card">
        <AlertTriangle className="size-4 text-warning" />
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center justify-between gap-2">
            <AlertTitle className="text-sm font-semibold">
              Set up your connections on this device
            </AlertTitle>
            <div className="flex items-center gap-1 shrink-0">
              {/* "Why?" popover — AC5 */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label="Why don't credentials sync automatically?"
                    data-testid="credential-banner-why-btn"
                  >
                    <HelpCircle className="size-4" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Why don't credentials sync?</p>
                    <p className="text-sm text-muted-foreground">
                      Credentials (API keys, passwords) are stored per-device in Supabase Vault
                      for security. They are not transmitted through the regular sync pipeline —
                      you re-enter them once per device and they are then available on that device.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ollama uses a server URL rather than a Vault credential, so it syncs
                      normally through your settings.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Help article coming soon.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Dismiss button — AC6 */}
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
                aria-label="Dismiss credential setup banner"
                data-testid="credential-banner-dismiss-btn"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <AlertDescription>
            <div className="flex flex-col divide-y divide-border/30 -my-1">
              {missing.map(entry => (
                <MissingCredentialRow
                  key={`${entry.kind}:${entry.id}`}
                  entry={entry}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </AlertDescription>
        </div>
      </Alert>
    </div>
  )
}
