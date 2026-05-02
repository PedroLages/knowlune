/**
 * ConsentToggles — E119-S08
 *
 * Renders a card per consent purpose with a Switch, descriptive copy, and
 * a withdrawal confirmation dialog (AlertDialog). Pure-ish component:
 * receives consents and handlers from PrivacySection.
 *
 * WCAG 2.1 AA: each Switch has aria-label describing purpose and current state,
 * plus aria-describedby pointing to the data-categories + withdrawal-effect copy.
 */

import { useState } from 'react'
import { Switch } from '@/app/components/ui/switch'
import { Card, CardContent } from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { CONSENT_PURPOSES, type ConsentPurpose } from '@/lib/compliance/consentService'
import { CONSENT_PURPOSE_META } from '@/lib/compliance/consentEffects'
import type { UserConsent } from '@/data/types'

export interface ConsentTogglesProps {
  /** Current consent rows for the user (empty = all off) */
  consents: UserConsent[]
  /** Called when the user confirms granting consent for a purpose */
  onGrant: (purpose: ConsentPurpose) => Promise<void>
  /** Called when the user confirms withdrawing consent for a purpose */
  onWithdraw: (purpose: ConsentPurpose) => Promise<void>
}

/** Ordered list of purposes for display */
const PURPOSE_ORDER: ConsentPurpose[] = [
  CONSENT_PURPOSES.AI_TUTOR,
  CONSENT_PURPOSES.AI_EMBEDDINGS,
  CONSENT_PURPOSES.VOICE_TRANSCRIPTION,
  CONSENT_PURPOSES.ANALYTICS_TELEMETRY,
  CONSENT_PURPOSES.MARKETING_EMAIL,
]

function isConsentGranted(consents: UserConsent[], purpose: string): boolean {
  const row = consents.find(c => c.purpose === purpose)
  return !!row && row.grantedAt !== null && row.withdrawnAt === null
}

export function ConsentToggles({ consents, onGrant, onWithdraw }: ConsentTogglesProps) {
  // Track which purpose's confirmation dialog is open
  const [confirmWithdrawPurpose, setConfirmWithdrawPurpose] = useState<ConsentPurpose | null>(null)
  // Track which purposes are pending (loading state)
  const [pendingPurposes, setPendingPurposes] = useState<Set<ConsentPurpose>>(new Set())

  async function handleToggle(purpose: ConsentPurpose, currentlyGranted: boolean) {
    if (pendingPurposes.has(purpose)) return

    if (currentlyGranted) {
      // Open withdrawal confirmation dialog
      setConfirmWithdrawPurpose(purpose)
    } else {
      // Grant immediately (no confirmation needed)
      setPendingPurposes(prev => new Set(prev).add(purpose))
      try {
        await onGrant(purpose)
      } finally {
        setPendingPurposes(prev => {
          const next = new Set(prev)
          next.delete(purpose)
          return next
        })
      }
    }
  }

  async function handleConfirmWithdraw() {
    if (!confirmWithdrawPurpose) return
    const purpose = confirmWithdrawPurpose
    setConfirmWithdrawPurpose(null)

    setPendingPurposes(prev => new Set(prev).add(purpose))
    try {
      await onWithdraw(purpose)
    } finally {
      setPendingPurposes(prev => {
        const next = new Set(prev)
        next.delete(purpose)
        return next
      })
    }
  }

  const currentConfirmMeta = confirmWithdrawPurpose
    ? CONSENT_PURPOSE_META[confirmWithdrawPurpose]
    : null

  return (
    <>
      <Card data-testid="consent-toggles">
        <CardContent className="p-0">
          {PURPOSE_ORDER.map((purpose, index) => {
            const meta = CONSENT_PURPOSE_META[purpose]
            const granted = isConsentGranted(consents, purpose)
            const pending = pendingPurposes.has(purpose)
            const descId = `consent-desc-${purpose}`
            const switchId = `consent-switch-${purpose}`

            return (
              <div key={purpose}>
                <div
                  className="flex items-start gap-4 px-6 py-5"
                  data-testid={`consent-row-${purpose}`}
                >
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={switchId}
                      className="text-sm font-semibold cursor-pointer select-none"
                    >
                      {meta.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    <p
                      id={descId}
                      className="text-xs text-muted-foreground mt-2"
                    >
                      <span className="font-medium">Data used:</span> {meta.dataCategories}
                      {' · '}
                      <span className="font-medium">If withdrawn:</span> {meta.withdrawalCopy}
                    </p>
                  </div>

                  {/* Toggle */}
                  <div className="flex-shrink-0 pt-0.5">
                    {pending ? (
                      <Loader2
                        className="size-5 animate-spin text-muted-foreground"
                        aria-label={`Updating ${meta.label} consent…`}
                      />
                    ) : (
                      <Switch
                        id={switchId}
                        checked={granted}
                        onCheckedChange={() => handleToggle(purpose, granted)}
                        aria-label={`${meta.label}: ${granted ? 'enabled' : 'disabled'}`}
                        aria-describedby={descId}
                        data-testid={`consent-switch-${purpose}`}
                      />
                    )}
                  </div>
                </div>

                {index < PURPOSE_ORDER.length - 1 && (
                  <Separator className="mx-6" />
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Withdrawal confirmation dialog */}
      <AlertDialog
        open={confirmWithdrawPurpose !== null}
        onOpenChange={open => {
          if (!open) setConfirmWithdrawPurpose(null)
        }}
      >
        <AlertDialogContent data-testid="withdraw-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Withdraw consent for {currentConfirmMeta?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{currentConfirmMeta?.description}</p>
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm font-medium text-destructive mb-1">
                    What will happen:
                  </p>
                  <p className="text-sm">{currentConfirmMeta?.withdrawalCopy}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can re-enable this at any time from Settings → Privacy &amp; Consent.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="withdraw-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmWithdraw}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="withdraw-confirm"
            >
              Withdraw consent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
