/**
 * RestoreConfirmationDialog — E77a-S01
 *
 * Confirmation dialog shown before restoring a backup file.
 * Displays:
 *   - Data summary preview (per-table record counts from the backup)
 *   - Current schema version vs backup schema version
 *   - Safety backup checkbox (default on) — auto-downloads a pre-restore backup
 *   - "This action cannot be undone" warning
 *
 * @see DataAndBackupPanel for the parent component
 */

import { useState } from 'react'
import { AlertTriangle, Download, HardDrive } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { Button } from '@/app/components/ui/button'
import { Checkbox } from '@/app/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import type { BackupPayload } from '@/lib/exportService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupPreview {
  /** Total records across all tables */
  totalRecords: number
  /** Per-table counts (sorted: non-empty first, then alphabetically) */
  tableCounts: Array<{ table: string; count: number }>
  /** Schema version from the backup file */
  schemaVersion: number
  /** Whether the backup version differs from the current one */
  requiresMigration: boolean
}

export interface RestoreConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preview data computed from the parsed backup file */
  preview: BackupPreview
  /** The parsed backup payload to restore (passed through to restore handler) */
  payload: BackupPayload
  /** Called when the user confirms with the chosen safety-backup setting */
  onConfirm: (options: { createSafetyBackup: boolean }) => void
  /** Whether a restore operation is currently in progress */
  isRestoring: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a record count in a human-readable way.
 */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RestoreConfirmationDialog({
  open,
  onOpenChange,
  preview,
  payload,
  onConfirm,
  isRestoring,
}: RestoreConfirmationDialogProps) {
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg" aria-describedby="restore-dialog-description">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <HardDrive className="size-5 text-warning" aria-hidden="true" />
            Restore Backup
          </AlertDialogTitle>
          <AlertDialogDescription id="restore-dialog-description" className="sr-only">
            Confirm restoring data from a backup file. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RestoreDialogBody
          preview={preview}
          createSafetyBackup={createSafetyBackup}
          onSafetyBackupChange={setCreateSafetyBackup}
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
          <ConfirmButton
            isRestoring={isRestoring}
            onClick={() => {
              onConfirm({ createSafetyBackup })
            }}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// Inner components
// ---------------------------------------------------------------------------

interface RestoreDialogBodyProps {
  preview: BackupPreview
  createSafetyBackup: boolean
  onSafetyBackupChange: (checked: boolean) => void
}

function RestoreDialogBody({
  preview,
  createSafetyBackup,
  onSafetyBackupChange,
}: RestoreDialogBodyProps) {
  const displayCounts = preview.tableCounts.slice(0, 20)
  const hasMore = preview.tableCounts.length > 20
  const extraCount = preview.tableCounts.length - 20

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <AlertTriangle className="mt-0.5 size-5 text-destructive shrink-0" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-destructive">This action cannot be undone.</p>
          <p className="text-muted-foreground mt-1">
            All current data on this device will be replaced by the backup data.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex-1 rounded-lg bg-muted p-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Total Records
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCount(preview.totalRecords)}
          </p>
        </div>
        <div className="flex-1 rounded-lg bg-muted p-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Tables
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{preview.tableCounts.length}</p>
        </div>
        <div className="flex-1 rounded-lg bg-muted p-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Schema
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            v{preview.schemaVersion}
            {preview.requiresMigration && (
              <span className="ml-1 text-xs text-warning">(migrate)</span>
            )}
          </p>
        </div>
      </div>

      {/* Per-table counts */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Data Preview
        </p>
        <ScrollArea className="max-h-48">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-3/5">Table</TableHead>
                <TableHead className="text-xs text-right w-2/5">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayCounts.map(({ table, count }) => (
                <TableRow key={table}>
                  <TableCell className="text-xs font-mono py-1">{table}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums py-1">{count}</TableCell>
                </TableRow>
              ))}
              {hasMore && (
                <TableRow>
                  <TableCell className="text-xs text-muted-foreground italic py-1" colSpan={2}>
                    ... and {extraCount} more table(s)
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Safety backup checkbox */}
      <div className="flex items-start gap-3 rounded-lg border border-border p-3">
        <Checkbox
          id="safety-backup"
          checked={createSafetyBackup}
          onCheckedChange={(checked) => onSafetyBackupChange(checked === true)}
        />
        <label htmlFor="safety-backup" className="text-sm leading-snug cursor-pointer">
          <span className="font-medium">Create safety backup</span>
          <span className="text-muted-foreground block">
            Automatically download a backup of your current data before restoring. Recommended to
            prevent accidental data loss.
          </span>
        </label>
      </div>
    </div>
  )
}

interface ConfirmButtonProps {
  isRestoring: boolean
  onClick: () => void
}

/**
 * The confirm button in the footer.
 * Shows a spinner during restore.
 */
function ConfirmButton({ isRestoring, onClick }: ConfirmButtonProps) {
  return (
    <Button variant="destructive" disabled={isRestoring} onClick={onClick} className="gap-2">
      {isRestoring ? (
        <>
          <div
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          Restoring...
        </>
      ) : (
        <>
          <Download className="size-4" aria-hidden="true" />
          Restore Backup
        </>
      )}
    </Button>
  )
}
