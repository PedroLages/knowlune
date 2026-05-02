/**
 * ProviderReconsentModal — E119-S09
 *
 * Surfaces when the configured AI provider identity has changed since the user
 * last gave consent. Informs the user of the new provider, the data categories
 * that will be transferred, and (when `noticeUpdatePending` is true) that the
 * privacy notice has also been updated.
 *
 * The calling component (or `useProviderReconsent` hook) is responsible for:
 *   - Supplying `onAccept` (which must write the consent row with evidence.provider_id)
 *   - Supplying `onDecline` (which should show the AIConsentDeclinedBanner)
 *
 * WCAG 2.1 AA: DialogTitle always present; focus trapped inside Dialog; all
 * interactive elements keyboard-reachable.
 */

import { useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { getProviderMeta } from '@/lib/compliance/providerMeta'
import type { ConsentPurpose } from '@/lib/compliance/consentService'

/** Inline message copy for the decline path (shared with AIConsentDeclinedBanner). */
export const AI_CONSENT_DECLINED_MESSAGE =
  'AI features require consent for this provider. You can enable this in Settings → Privacy & Consent.'

export interface ProviderReconsentModalProps {
  open: boolean
  providerId: string
  purpose: ConsentPurpose
  /**
   * When true, the modal also informs the user that the privacy notice has
   * been updated, and the Accept action will additionally acknowledge the notice.
   */
  noticeUpdatePending?: boolean
  /** The version string of the updated notice (shown when noticeUpdatePending=true). */
  noticeVersion?: string
  /** Called when the user clicks Accept. Must persist consent (caller's responsibility). */
  onAccept: () => Promise<void>
  /** Called when the user clicks Decline. */
  onDecline: () => void
}

export function ProviderReconsentModal({
  open,
  providerId,
  // purpose is accepted in props for future per-purpose copy variation and
  // for the `useProviderReconsent` hook to track which purpose to re-grant.
  // The component currently shows provider-level information that is identical
  // across all AI purposes, so it is intentionally unused in the JSX.
  purpose: _purpose,
  noticeUpdatePending = false,
  noticeVersion,
  onAccept,
  onDecline,
}: ProviderReconsentModalProps) {
  const [accepting, setAccepting] = useState(false)
  const providerMeta = getProviderMeta(providerId)

  async function handleAccept() {
    setAccepting(true)
    try {
      await onAccept()
    } finally {
      setAccepting(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        // Prevent closing by clicking the overlay — the user must make a choice.
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        className="max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
            <DialogTitle>AI Provider Update — New Consent Required</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="text-muted-foreground space-y-3 pt-1 text-sm">
              <p>
                Knowlune now uses{' '}
                <span className="text-foreground font-medium">{providerMeta.displayName}</span> (
                {providerMeta.legalEntity}) for AI features. Your data was previously sent to a
                different provider.
              </p>

              <div>
                <p className="text-foreground mb-1 font-medium">Data transferred to this provider:</p>
                <p>{providerMeta.dataCategories}</p>
              </div>

              {noticeUpdatePending && (
                <div className="bg-muted rounded-md p-3">
                  <p className="text-foreground font-medium">Privacy notice updated</p>
                  <p className="mt-1">
                    Our privacy notice has also been updated
                    {noticeVersion ? ` (version ${noticeVersion})` : ''}.
                    Your acceptance below covers both the new provider and the updated notice.
                  </p>
                </div>
              )}

              <p>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-soft-foreground underline underline-offset-2"
                >
                  Review the full privacy notice
                </a>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onDecline}
            disabled={accepting}
            aria-label="Decline — AI features will be disabled"
          >
            Decline
          </Button>
          <Button
            variant="brand"
            onClick={handleAccept}
            disabled={accepting}
            aria-label={`Accept — allow data to be sent to ${providerMeta.displayName}`}
          >
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Accept & Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
