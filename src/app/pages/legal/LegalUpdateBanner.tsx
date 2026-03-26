import { useState, useEffect } from 'react'
import { X, Bell } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

const STORAGE_KEY_PREFIX = 'knowlune-legal-effective-date-'

interface LegalUpdateBannerProps {
  /** Identifier for the legal document (e.g., 'privacy' or 'terms') */
  documentId: string
  /** The effective date of the current document version */
  effectiveDate: string
  /** Human-readable document name for the banner message */
  documentName: string
}

/**
 * Displays a dismissible banner when the legal document's effective date
 * has changed since the user last dismissed it.
 *
 * Compares effectiveDate against localStorage to detect updates.
 * Dismiss writes the current effectiveDate to localStorage.
 */
export function LegalUpdateBanner({
  documentId,
  effectiveDate,
  documentName,
}: LegalUpdateBannerProps) {
  const [visible, setVisible] = useState(false)
  const storageKey = `${STORAGE_KEY_PREFIX}${documentId}`

  useEffect(() => {
    const lastSeen = localStorage.getItem(storageKey)
    if (lastSeen !== effectiveDate) {
      setVisible(true)
    }
  }, [storageKey, effectiveDate])

  function handleDismiss() {
    localStorage.setItem(storageKey, effectiveDate)
    setVisible(false)
  }

  if (!visible) return null

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
