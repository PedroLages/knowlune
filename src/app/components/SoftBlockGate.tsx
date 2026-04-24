/**
 * SoftBlockGate — E119-S02 (AC-6)
 *
 * Full-screen semi-transparent overlay shown when a user's notice
 * acknowledgement is more than 30 days stale. Read-only browsing
 * is NOT blocked — the overlay sits above the page but does not
 * prevent interaction with the underlying content. Only write actions
 * are visually gated (a separate useSoftBlock() flag lets individual
 * write-action components surface an "Acknowledge to continue" inline
 * message in future stories).
 *
 * This is a soft UX gate, not a security control. Server-side
 * enforcement is out of scope for this story.
 */

import { useState } from 'react'
import { Link } from 'react-router'
import { ShieldAlert, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { toast } from 'sonner'
import { writeNoticeAck } from '@/lib/compliance/noticeAck'
import { CURRENT_NOTICE_VERSION, formatNoticeEffectiveDate } from '@/lib/compliance/noticeVersion'

interface SoftBlockGateProps {
  /**
   * Called after a successful acknowledgement write.
   * Typically triggers refetch() from useNoticeAcknowledgement to clear the gate.
   */
  onAcknowledged: () => void
}

export function SoftBlockGate({ onAcknowledged }: SoftBlockGateProps) {
  const [loading, setLoading] = useState(false)

  const effectiveDate = formatNoticeEffectiveDate(CURRENT_NOTICE_VERSION)

  async function handleAcknowledge() {
    if (loading) return
    setLoading(true)
    try {
      await writeNoticeAck(CURRENT_NOTICE_VERSION)
      onAcknowledged()
    } catch {
      toast.error('Could not record your acknowledgement. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="soft-block-title"
      aria-describedby="soft-block-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      data-testid="soft-block-gate"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-warning/10 p-2.5">
            <ShieldAlert className="size-5 text-warning" aria-hidden="true" />
          </div>
          <h2 id="soft-block-title" className="text-base font-semibold text-foreground">
            Privacy Notice Update Required
          </h2>
        </div>

        <p id="soft-block-description" className="text-sm text-muted-foreground">
          Our Privacy Notice was updated ({effectiveDate}). Please acknowledge the updated
          notice to continue creating and saving content. You can still browse and read
          existing content.
        </p>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="brand"
            className="w-full min-h-[44px]"
            onClick={handleAcknowledge}
            disabled={loading}
            aria-disabled={loading}
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
            {loading ? 'Acknowledging…' : 'Acknowledge Privacy Notice'}
          </Button>
          <Link
            to="/privacy"
            className="inline-flex items-center justify-center min-h-[44px] rounded-xl text-sm font-medium text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            View Privacy Notice
          </Link>
        </div>
      </div>
    </div>
  )
}
