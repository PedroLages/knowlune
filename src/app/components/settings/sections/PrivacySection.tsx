/**
 * PrivacySection — E119-S08
 *
 * Settings → Privacy & Consent section.
 *
 * Loads the user's current consent rows from Dexie, then delegates rendering
 * to ConsentToggles. Auth-gated: returns a sign-in prompt when no user.
 *
 * Grant and withdrawal effects are applied via consentEffects.ts.
 * Consent rows are synced to Supabase by the existing LWW pipeline (E119-S07).
 */

import { useCallback, useEffect, useState } from 'react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { ConsentToggles } from '@/app/components/settings/ConsentToggles'
import { listForUser } from '@/lib/compliance/consentService'
import { grantConsent, withdrawConsent } from '@/lib/compliance/consentEffects'
import type { ConsentPurpose } from '@/lib/compliance/consentService'
import type { UserConsent } from '@/data/types'
import { useAuthStore } from '@/stores/useAuthStore'
import { toastSuccess, toastError } from '@/lib/toastHelpers'

export function PrivacySection() {
  const user = useAuthStore(s => s.user)

  // In the closed app, this section is only reachable by signed-in users.
  if (!user) return null

  return <PrivacySectionContent userId={user.id} />
}

// ─────────────────────────────────────────────────────────────────────────────

interface PrivacySectionContentProps {
  userId: string
}

function PrivacySectionContent({ userId }: PrivacySectionContentProps) {
  const [consents, setConsents] = useState<UserConsent[]>([])
  const [loading, setLoading] = useState(true)

  // Load consent rows on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const rows = await listForUser(userId)
        if (!cancelled) setConsents(rows)
      } catch {
        // silent-catch-ok — empty state shown as fallback; all toggles default off
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const handleGrant = useCallback(
    async (purpose: ConsentPurpose) => {
      const result = await grantConsent(userId, purpose)
      if (result.success) {
        // Update local state optimistically by re-loading
        const rows = await listForUser(userId)
        setConsents(rows)
        toastSuccess.saved('Consent granted.')
      } else {
        toastError.saveFailed('Failed to save consent. Please try again.')
      }
    },
    [userId],
  )

  const handleWithdraw = useCallback(
    async (purpose: ConsentPurpose) => {
      const result = await withdrawConsent(userId, purpose)
      if (result.success) {
        // Reload consent rows to reflect the withdrawal
        const rows = await listForUser(userId)
        setConsents(rows)
        toastSuccess.saved('Consent withdrawn.')
      } else {
        // Re-fetch to ensure UI is consistent with actual DB state
        const rows = await listForUser(userId)
        setConsents(rows)
        toastError.saveFailed('Failed to withdraw consent. Please try again.')
      }
    },
    [userId],
  )

  return (
    <div className="space-y-6" data-testid="privacy-section">
      {/* Header */}
      <section>
        <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Data Processing Consents
        </h4>
        <p className="px-1 text-sm text-muted-foreground mb-4">
          These optional features require your explicit consent to process personal data under GDPR
          Article 6(1)(a). Each purpose is independent — you can enable or disable them at any
          time. Withdrawing consent may delete associated data on this device.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <ConsentToggles
            consents={consents}
            onGrant={handleGrant}
            onWithdraw={handleWithdraw}
          />
        )}
      </section>

      {/* Legal footer */}
      <p className="px-1 text-xs text-muted-foreground">
        Your consent choices are synced across devices. For more information, see our{' '}
        <a
          href="/legal/privacy"
          className="underline underline-offset-2 hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Notice
        </a>
        .
      </p>
    </div>
  )
}

