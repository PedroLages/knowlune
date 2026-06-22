/**
 * DataAndBackupPanel — E77a-S01
 *
 * Settings > Data & Backup panel with two primary actions:
 *   1. "Download backup" — exports all syncable IndexedDB tables + settings as
 *      a .knowlune.json file which is automatically saved via the browser's
 *      download mechanism.
 *   2. "Restore from backup" — opens a file picker for a .knowlune.json file,
 *      parses and validates it, shows a confirmation dialog with record preview,
 *      optionally creates a safety backup, then performs the atomic restore.
 *
 * Both flows surface loading states, success/error toasts, and status info
 * (last backup date, current schema version).
 */

import { useCallback, useRef, useState } from 'react'
import { Download, HardDrive, Upload } from 'lucide-react'

import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import { Spinner } from '@/app/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { toastSuccess, toastError } from '@/lib/toastHelpers'
import { CHECKPOINT_VERSION } from '@/db/checkpoint'

import { type BackupPayload, exportAllAsBlob } from '@/lib/exportService'
import { restoreFromBackup } from '@/lib/importService'
import {
  RestoreConfirmationDialog,
  type BackupPreview,
} from '@/app/components/settings/RestoreConfirmationDialog'

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

/** Trigger a file download in the browser using an object URL + anchor click. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** Format a Date for display in the "last backup" status row. */
function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataAndBackupPanel() {
  const [isExporting, setIsExporting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  // Restore flow state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null)
  const [restorePayload, setRestorePayload] = useState<BackupPayload | null>(null)

  // Track last successful backup timestamp in local state during this session
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem('knowlune-last-backup-at')
    return stored ? new Date(stored) : null
  })

  // ── Download backup ──────────────────────────────────────────────────────

  const handleDownloadBackup = useCallback(async () => {
    setIsExporting(true)
    try {
      const { blob, filename } = await exportAllAsBlob()
      downloadBlob(blob, filename)

      // Persist the backup timestamp so it survives page refresh
      const now = new Date()
      localStorage.setItem('knowlune-last-backup-at', now.toISOString())
      setLastBackupAt(now)

      toastSuccess.exported('Backup downloaded')
    } catch (error) {
      toastError.saveFailed(error instanceof Error ? error.message : 'Failed to create backup')
    } finally {
      setIsExporting(false)
    }
  }, [])

  // ── Restore flow ─────────────────────────────────────────────────────────

  /** Handle file selection from the file picker. */
  const handleFilePicked = useCallback(async () => {
    const fileInput = fileInputRef.current
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return

    const file = fileInput.files[0]
    fileInput.value = '' // Reset so the same file can be picked again

    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)

      // Validate basic structure
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as Record<string, unknown>).schemaVersion !== 'number' ||
        typeof (parsed as Record<string, unknown>).data !== 'object'
      ) {
        toastError.invalidFile('a valid .knowlune.json backup')
        return
      }

      const payload = parsed as BackupPayload

      // Check if the backup is from a newer app version
      if (payload.schemaVersion > CHECKPOINT_VERSION) {
        toastError.invalidFile(
          `Backup was created with a newer app version (schema v${payload.schemaVersion}). ` +
            `Please update the app before restoring.`
        )
        return
      }

      // Build preview
      const tableCounts: Array<{ table: string; count: number }> = []
      let totalRecords = 0

      for (const [table, records] of Object.entries(payload.data)) {
        if (Array.isArray(records)) {
          tableCounts.push({ table, count: records.length })
          totalRecords += records.length
        }
      }

      // Sort: non-empty first, then alphabetical
      tableCounts.sort((a, b) => {
        if (a.count > 0 && b.count === 0) return -1
        if (a.count === 0 && b.count > 0) return 1
        return a.table.localeCompare(b.table)
      })

      setBackupPreview({
        totalRecords,
        tableCounts,
        schemaVersion: payload.schemaVersion,
        requiresMigration: payload.schemaVersion !== CHECKPOINT_VERSION,
      })
      setRestorePayload(payload)
      setRestoreDialogOpen(true)
    } catch {
      toastError.invalidFile('a valid .knowlune.json backup')
    }
  }, [])

  /** Trigger the hidden file input. */
  const handleRestoreClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /** Execute the restore after confirmation. */
  const handleRestoreConfirm = useCallback(
    async ({ createSafetyBackup }: { createSafetyBackup: boolean }) => {
      if (!backupPreview || !restorePayload) return

      setRestoreDialogOpen(false)
      setIsRestoring(true)

      try {
        // Step 1: Create safety backup (if opted-in)
        if (createSafetyBackup) {
          try {
            const { blob, filename } = await exportAllAsBlob()
            const dotIndex = filename.lastIndexOf('.')
            const baseName = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
            const extension = dotIndex > 0 ? filename.slice(dotIndex) : ''
            downloadBlob(blob, `${baseName}-pre-restore-safety${extension}`)
          } catch (safetyError) {
            // Safety backup is best-effort — continue with restore
            // silent-catch-ok
            console.warn('[DataAndBackupPanel] Safety backup failed:', safetyError)
          }
        }

        // Step 2: Execute the restore
        const summary = await restoreFromBackup(restorePayload)

        // Step 3: Refresh Zustand stores by reloading the page
        // This is the safest approach — all stores re-read from Dexie on mount.
        toastSuccess.exported(
          `Restored ${summary.totalRecords.toLocaleString()} records across ` +
            `${Object.keys(summary.counts).length} tables`
        )

        if (summary.warnings.length > 0) {
          console.warn('[DataAndBackupPanel] Restore warnings:', summary.warnings)
        }

        // Refresh the page to ensure all stores re-hydrate from the new data
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } catch (error) {
        toastError.importFailed(error instanceof Error ? error.message : 'Restore failed')
      } finally {
        setIsRestoring(false)
        setBackupPreview(null)
        setRestorePayload(null)
      }
    },
    [backupPreview, restorePayload]
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden file input for restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.knowlune.json"
        className="hidden"
        aria-hidden="true"
        onChange={handleFilePicked}
        data-testid="backup-file-input"
      />

      {/* Backup section card */}
      <section>
        <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Backup & Restore
        </h4>
        <p className="px-1 text-sm text-muted-foreground mb-4">
          Download a complete backup of all your data or restore from a previous backup file.
          Backups include all courses, progress, notes, books, and settings.
        </p>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">Data Backup</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status rows */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Schema version</span>
                <span className="font-mono text-xs">v{CHECKPOINT_VERSION}</span>
              </div>
              {lastBackupAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last backup</span>
                  <span>{formatDateTime(lastBackupAt)}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        variant="brand"
                        onClick={handleDownloadBackup}
                        disabled={isExporting || isRestoring}
                        className="gap-2 flex-1"
                        data-testid="download-backup-btn"
                      >
                        {isExporting ? (
                          <Spinner className="size-4" aria-label="Creating backup..." />
                        ) : (
                          <Download className="size-4" aria-hidden="true" />
                        )}
                        {isExporting ? 'Creating backup...' : 'Download Backup'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Save a complete .knowlune.json backup file</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        variant="brand-outline"
                        onClick={handleRestoreClick}
                        disabled={isExporting || isRestoring}
                        className="gap-2 flex-1"
                        data-testid="restore-backup-btn"
                      >
                        {isRestoring ? (
                          <Spinner className="size-4" aria-label="Restoring..." />
                        ) : (
                          <Upload className="size-4" aria-hidden="true" />
                        )}
                        {isRestoring ? 'Restoring...' : 'Restore from File'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Load data from a previously saved backup file</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Restore confirmation dialog */}
      {backupPreview && restorePayload && (
        <RestoreConfirmationDialog
          open={restoreDialogOpen}
          onOpenChange={setRestoreDialogOpen}
          preview={backupPreview}
          onConfirm={handleRestoreConfirm}
          isRestoring={isRestoring}
        />
      )}
    </>
  )
}
