/**
 * useProviderReconsent — E119-S09
 *
 * React hook that wraps the `ProviderReconsentError` catch pattern.
 * Manages modal open state, accept/decline handlers, and the inline declined
 * state for the calling component.
 *
 * Usage:
 *   const { handleAIError, declinedProvider, modalProps } = useProviderReconsent(userId)
 *
 *   // In your AI call try/catch:
 *   } catch (err) {
 *     if (!handleAIError(err)) throw err  // re-throw non-reconsent errors
 *   }
 *
 *   // In your render:
 *   {declinedProvider && <AIConsentDeclinedBanner providerId={declinedProvider} />}
 *   <ProviderReconsentModal {...modalProps} />
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { ProviderReconsentError } from '@/ai/lib/ProviderReconsentError'
import { grantConsent } from '@/lib/compliance/consentEffects'
import { writeNoticeAck } from '@/lib/compliance/noticeAck'
import { CURRENT_NOTICE_VERSION } from '@/lib/compliance/noticeVersion'
import { listForUser } from '@/lib/compliance/consentService'
import type { ConsentPurpose } from '@/lib/compliance/consentService'
import type { ProviderReconsentModalProps } from '@/app/components/compliance/ProviderReconsentModal'

export type ProviderReconsentModalControlProps = Omit<
  ProviderReconsentModalProps,
  'onAccept' | 'onDecline'
> & {
  onAccept: () => Promise<void>
  onDecline: () => void
}

export interface UseProviderReconsentResult {
  /**
   * Call in the AI error catch block. Returns true if the error was handled
   * (it was a ProviderReconsentError and the modal is now open), false otherwise.
   * When false, the caller should re-throw.
   */
  handleAIError: (err: unknown) => boolean
  /**
   * The provider_id the user most recently declined re-consent for.
   * Null if the user has not declined (or has not yet been prompted).
   * Use to show AIConsentDeclinedBanner.
   */
  declinedProvider: string | null
  /**
   * Props to spread onto <ProviderReconsentModal />.
   */
  modalProps: ProviderReconsentModalControlProps
  /**
   * Callback to invoke after a successful accept to re-attempt the AI call.
   * Set by the calling component via the `onRetry` option.
   */
  triggerRetry: (() => void) | null
}

interface UseProviderReconsentOptions {
  /** Called after the user accepts and consent is written, so the AI call can be retried. */
  onRetry?: () => void
}

export function useProviderReconsent(
  userId: string | undefined,
  options: UseProviderReconsentOptions = {},
): UseProviderReconsentResult {
  const onRetryRef = useRef(options.onRetry)
  useEffect(() => {
    onRetryRef.current = options.onRetry
  }, [options.onRetry])

  const [open, setOpen] = useState(false)
  const [pendingProvider, setPendingProvider] = useState<string>('')
  const [pendingPurpose, setPendingPurpose] = useState<ConsentPurpose>('ai_tutor')
  const [noticeUpdatePending, setNoticeUpdatePending] = useState(false)
  const [declinedProvider, setDeclinedProvider] = useState<string | null>(null)

  const handleAIError = useCallback(
    (err: unknown): boolean => {
      if (!(err instanceof ProviderReconsentError)) return false

      setPendingProvider(err.providerId)
      setPendingPurpose(err.purpose)
      setDeclinedProvider(null)

      // Detect whether the notice has also been updated since last ack.
      // We do this asynchronously and don't block opening the modal.
      if (userId) {
        listForUser(userId)
          .then(rows => {
            const anyRow = rows.find(r => r.noticeVersion !== CURRENT_NOTICE_VERSION)
            setNoticeUpdatePending(!!anyRow || rows.length === 0)
          })
          .catch(() => {
            // Non-fatal: default to not showing the notice update section.
            setNoticeUpdatePending(false)
          })
      }

      setOpen(true)
      return true
    },
    [userId],
  )

  const handleAccept = useCallback(async () => {
    if (!userId) return

    // Write the consent row with the new provider_id in evidence.
    const result = await grantConsent(userId, pendingPurpose, { provider_id: pendingProvider })
    if (!result.success) {
      console.error('[useProviderReconsent] grantConsent failed:', result.error)
      // Consent write failed — do NOT retry the AI call; isGrantedForProvider
      // will still return false and immediately re-trigger the modal, creating
      // a confusing loop. Leave the modal closed but don't fire onRetry.
      setOpen(false)
      return
    }

    // If the notice was also updated, write an acknowledgement.
    if (noticeUpdatePending) {
      try {
        await writeNoticeAck(CURRENT_NOTICE_VERSION)
      } catch (err) {
        console.warn('[useProviderReconsent] writeNoticeAck failed (non-fatal):', err)
      }
    }

    setOpen(false)
    setDeclinedProvider(null)

    // Retry the original AI call now that consent is recorded.
    onRetryRef.current?.()
  }, [userId, pendingPurpose, pendingProvider, noticeUpdatePending])

  const handleDecline = useCallback(() => {
    setOpen(false)
    setDeclinedProvider(pendingProvider)
  }, [pendingProvider])

  return {
    handleAIError,
    declinedProvider,
    triggerRetry: options.onRetry ?? null,
    modalProps: {
      open,
      providerId: pendingProvider,
      purpose: pendingPurpose,
      noticeUpdatePending,
      noticeVersion: noticeUpdatePending ? CURRENT_NOTICE_VERSION : undefined,
      onAccept: handleAccept,
      onDecline: handleDecline,
    },
  }
}
