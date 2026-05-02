import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { X, Bell } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { toast } from 'sonner'
import { writeNoticeAck } from '@/lib/compliance/noticeAck'
import { CURRENT_NOTICE_VERSION } from '@/lib/compliance/noticeVersion'

const STORAGE_KEY_PREFIX = 'knowlune-legal-effective-date-'

interface LegalUpdateBannerInfoProps {
  /** Identifier for the legal document (e.g., 'privacy' or 'terms') */
  documentId: string
  /** The effective date of the current document version */
  effectiveDate: string
  /** Human-readable document name for the banner message */
  documentName: string
  /** Display mode: 'info' = dismissible update notice; 'reack' = re-acknowledgement CTA (AC-5) */
  mode?: 'info' | 'reack'
  /**
   * Called after a successful re-acknowledgement write in 'reack' mode.
   * Typically triggers refetch() from useNoticeAcknowledgement to clear the banner.
   */
  onAcknowledged?: () => void
}

/**
 * LegalUpdateBanner — E119-S01/S02
 *
 * Two modes:
 *
 * mode="info" (default, backward-compatible):
 *   Displays a dismissible banner when the legal document's effective date
 *   has changed since the user last dismissed it.
 *   Compares effectiveDate against localStorage to detect updates.
 *   Dismiss writes the current effectiveDate to localStorage.
 *
 * mode="reack":
 *   Displays a re-acknowledgement CTA backed by Supabase (AC-5).
 *   The user must click "Acknowledge" to write a notice_acknowledgements row.
 *   Non-blocking: write failure shows a toast, banner does not disappear.
 *   onAcknowledged() is called after a successful write to trigger refetch().
 */
export function LegalUpdateBanner({
  documentId,
  effectiveDate,
  documentName,
  mode = 'info',
  onAcknowledged,
}: LegalUpdateBannerInfoProps) {
  const [visible, setVisible] = useState(false)
  const [ackLoading, setAckLoading] = useState(false)
  const storageKey = `${STORAGE_KEY_PREFIX}${documentId}`

  useEffect(() => {
    if (mode === 'info') {
      const lastSeen = localStorage.getItem(storageKey)
      if (lastSeen !== effectiveDate) {
        setVisible(true)
      }
    } else {
      // reack mode: always shown (controlled by parent via stale state)
      setVisible(true)
    }
  }, [storageKey, effectiveDate, mode])

  function handleDismiss() {
    localStorage.setItem(storageKey, effectiveDate)
    setVisible(false)
  }

  async function handleAcknowledge() {
    if (ackLoading) return
    setAckLoading(true)
    try {
      await writeNoticeAck(CURRENT_NOTICE_VERSION)
      setVisible(false)
      onAcknowledged?.()
    } catch {
      toast.error('Could not record your acknowledgement. Please try again.')
    } finally {
      setAckLoading(false)
    }
  }

  if (!visible) return null

  if (mode === 'reack') {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="mb-6 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3"
      >
        <Bell className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="flex-1 space-y-2">
          <p className="text-sm text-foreground">
            Our <strong>{documentName}</strong> has been updated (effective{' '}
            <strong>{effectiveDate}</strong>). Please review and acknowledge to continue using
            all features.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="brand"
              size="sm"
              className="min-h-[44px]"
              onClick={handleAcknowledge}
              disabled={ackLoading}
              aria-disabled={ackLoading}
            >
              {ackLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
              {ackLoading ? 'Acknowledging…' : 'Acknowledge'}
            </Button>
            <Link
              to="/privacy"
              className="text-sm font-medium text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 rounded-sm min-h-[44px] inline-flex items-center"
            >
              View Privacy Notice
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // mode === 'info' (default)
  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-6 flex items-center gap-3 rounded-xl border border-info/20 bg-brand-soft/30 px-4 py-3"
    >
      <Bell className="size-5 shrink-0 text-brand" aria-hidden="true" />
      <p className="flex-1 text-sm text-foreground">
        Our <strong>{documentName}</strong> has been updated. The new version is effective as of{' '}
        <strong>{effectiveDate}</strong>. Please review the changes below.
      </p>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        aria-label={`Dismiss ${documentName} update notification`}
        className="shrink-0 min-h-[44px] min-w-[44px]"
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
