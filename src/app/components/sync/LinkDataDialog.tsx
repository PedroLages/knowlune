import { useState, useEffect } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { BookOpen, FileText, Brain, Package, Link2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { DialogOverlay, DialogPortal } from '@/app/components/ui/dialog'
import { backfillUserId, SYNCABLE_TABLES } from '@/lib/sync/backfill'
import { syncEngine } from '@/lib/sync/syncEngine'
import { clearSyncState } from '@/lib/sync/clearSyncState'
import { countUnlinkedRecords, type UnlinkedCounts } from '@/lib/sync/countUnlinkedRecords'
import { db } from '@/db'
import { cn } from '@/app/components/ui/utils'

/**
 * Non-dismissible modal shown on first sign-in when the device has local data
 * that is not linked to any account (userId = null) or belongs to a different
 * account.
 *
 * The user must choose between:
 *   - "Link to my account" — backfills all local records with the new userId,
 *     then triggers a full sync upload.
 *   - "Start fresh" — clears all local data, then downloads from the server.
 *
 * Non-dismissibility is achieved by:
 *   1. Composing from radix-ui primitives directly (no `DialogContent` wrapper
 *      which auto-renders a close X button).
 *   2. `onPointerDownOutside` and `onEscapeKeyDown` both call `preventDefault`.
 *
 * @see docs/plans/2026-04-18-007-feat-e92-s08-auth-lifecycle-userid-backfill-plan.md
 * @since E92-S08
 */

interface LinkDataDialogProps {
  open: boolean
  userId: string
  onResolved: () => void
}

interface CategoryRow {
  key: keyof UnlinkedCounts
  label: string
  icon: React.ReactNode
}

const CATEGORY_ROWS: CategoryRow[] = [
  { key: 'courses', label: 'Courses & videos', icon: <BookOpen className="size-4" /> },
  { key: 'notes', label: 'Notes', icon: <FileText className="size-4" /> },
  { key: 'books', label: 'Books', icon: <BookOpen className="size-4" /> },
  { key: 'flashcards', label: 'Flashcards', icon: <Brain className="size-4" /> },
  { key: 'other', label: 'Other items', icon: <Package className="size-4" /> },
]

const LINKED_FLAG_PREFIX = 'sync:linked:'

export function LinkDataDialog({ open, userId, onResolved }: LinkDataDialogProps) {
  const [loading, setLoading] = useState(false)
  const [counts, setCounts] = useState<UnlinkedCounts | null>(null)

  // Fetch counts when dialog opens
  useEffect(() => {
    if (!open || !userId) return
    let ignore = false
    setCounts(null)
    countUnlinkedRecords(userId)
      .then(result => {
        if (!ignore) setCounts(result)
      })
      .catch(err => {
        // silent-catch-ok: counts are best-effort display data; dialog still
        // shows resolution choices even with empty counts.
        console.error('[LinkDataDialog] countUnlinkedRecords failed:', err)
      })
    return () => {
      ignore = true
    }
  }, [open, userId])

  async function handleLink() {
    setLoading(true)
    try {
      await backfillUserId(userId)
      // start() triggers fullSync internally — uploads the newly-stamped records.
      syncEngine.start(userId).catch(err => {
        console.error('[LinkDataDialog] syncEngine.start failed:', err)
      })
      localStorage.setItem(`${LINKED_FLAG_PREFIX}${userId}`, 'true')
      onResolved()
    } catch (err) {
      console.error('[LinkDataDialog] handleLink failed:', err)
      // Intentional: still resolve the dialog — the user's intent was to link.
      // Sync will retry on next sign-in.
      onResolved()
    } finally {
      setLoading(false)
    }
  }

  async function handleStartFresh() {
    const confirmed = window.confirm(
      'This will delete all local data on this device and download your account data from the server. Are you sure?'
    )
    if (!confirmed) return

    setLoading(true)
    try {
      // Clear all syncable tables
      for (const tableName of SYNCABLE_TABLES) {
        try {
          await db.table(tableName).clear()
        } catch (err) {
          // Per-table failure must not abort the whole clear. Log and continue.
          // silent-catch-ok: clearSyncState below also wipes queue/cursors.
          console.error(`[LinkDataDialog] Failed to clear table "${tableName}":`, err)
        }
      }
      // Wipe upload queue and download cursors
      await clearSyncState()
      // start() triggers fullSync internally — downloads fresh server state.
      syncEngine.start(userId).catch(err => {
        console.error('[LinkDataDialog] syncEngine.start (fresh) failed:', err)
      })
      localStorage.setItem(`${LINKED_FLAG_PREFIX}${userId}`, 'true')
      onResolved()
    } catch (err) {
      console.error('[LinkDataDialog] handleStartFresh failed:', err)
      // Intentional: still resolve — user chose to start fresh; partial clear
      // is better than leaving the dialog blocking the UI.
      onResolved()
    } finally {
      setLoading(false)
    }
  }

  const totalCount = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : null

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={() => {
        /* intentional no-op: dialog is non-dismissible */
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          role="alertdialog"
          aria-labelledby="link-dialog-title"
          aria-describedby="link-dialog-description"
          onPointerDownOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
          className={cn(
            'bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200'
          )}
        >
          {/* Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Link2 className="text-brand size-5" />
              <h2 id="link-dialog-title" className="text-foreground text-lg font-semibold">
                You have local data
              </h2>
            </div>
            <p id="link-dialog-description" className="text-muted-foreground text-sm">
              We found data saved on this device. What would you like to do with it?
            </p>
          </div>

          {/* Category counts */}
          {counts !== null && totalCount !== null && totalCount > 0 && (
            <div className="space-y-1.5 rounded-md border p-3">
              {CATEGORY_ROWS.map(({ key, label, icon }) =>
                counts[key] > 0 ? (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      {icon}
                      {label}
                    </span>
                    <span className="text-foreground font-medium tabular-nums">{counts[key]}</span>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Loading skeleton for counts */}
          {counts === null && <div className="bg-muted h-16 animate-pulse rounded-md" />}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="brand"
              className="flex-1"
              disabled={loading}
              onClick={handleLink}
              autoFocus
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="border-brand-foreground size-4 animate-spin rounded-full border-2 border-t-transparent" />
                  Linking…
                </span>
              ) : (
                'Link to my account'
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive hover:text-destructive"
              disabled={loading}
              onClick={handleStartFresh}
            >
              Start fresh
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  )
}
