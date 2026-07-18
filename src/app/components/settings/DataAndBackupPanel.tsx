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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Cloud,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import { Spinner } from '@/app/components/ui/spinner'
import { Progress } from '@/app/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { toastError } from '@/lib/toastHelpers'
import { CHECKPOINT_VERSION } from '@/db/checkpoint'

import {
  type BackupPayload,
  exportAllAsBlob,
  exportAllAsJson,
  updateBackupMeta,
} from '@/lib/exportService'
import { restoreFromBackup } from '@/lib/importService'
import { getDriveToken } from '@/lib/googleDriveToken'
import {
  DriveNetworkError,
  DrivePermissionError,
  DriveQuotaError,
  uploadBackupToDrive,
} from '@/lib/googleDriveUpload'
import { getSettings } from '@/lib/settings'
import { TOAST_DURATION } from '@/lib/toastConfig'
import {
  RestoreConfirmationDialog,
  type BackupPreview,
} from '@/app/components/settings/RestoreConfirmationDialog'
import { ReconnectGoogleDialog } from '@/app/components/settings/ReconnectGoogleDialog'

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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function formatRelativeTime(timestamp: number): string {
  const elapsed = Date.now() - timestamp
  if (elapsed < 60_000) return 'just now'

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch {
    return 'unknown'
  }
}

function getLastBackupDisplay(settings: ReturnType<typeof getSettings>): {
  label: string
  isStale: boolean
} | null {
  const meta = settings.backupMeta
  if (!meta) return null

  const timestamps = [meta.lastLocalAt, meta.lastDriveAt].filter(
    (timestamp): timestamp is number => timestamp !== undefined
  )
  if (timestamps.length === 0) return null

  const latestTimestamp = Math.max(...timestamps)
  const destination =
    meta.lastDestination === 'drive' && meta.lastDriveAt !== undefined
      ? 'Drive'
      : meta.lastDestination === 'local' && meta.lastLocalAt !== undefined
        ? 'Local'
        : meta.lastDriveAt !== undefined &&
            (meta.lastLocalAt === undefined || meta.lastDriveAt > meta.lastLocalAt)
          ? 'Drive'
          : 'Local'

  return {
    label: `${formatRelativeTime(latestTimestamp)} (${destination})`,
    isStale: Date.now() - latestTimestamp > THIRTY_DAYS_MS,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataAndBackupPanel() {
  const [isExporting, setIsExporting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPhase, setUploadPhase] = useState('')
  const [reconnectOpen, setReconnectOpen] = useState(false)
  const [knownTokenState, setKnownTokenState] = useState<'untested' | 'present' | 'absent'>(
    'untested'
  )
  const [settings, setSettings] = useState(getSettings)
  const backupDisplay = getLastBackupDisplay(settings)

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

  useEffect(() => {
    function refreshBackupStatus() {
      setSettings(getSettings())
    }

    window.addEventListener('settingsUpdated', refreshBackupStatus)
    return () => window.removeEventListener('settingsUpdated', refreshBackupStatus)
  }, [])

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
      updateBackupMeta('local')
      setSettings(getSettings())

      toast.success('Backup downloaded')
    } catch (error) {
      toast.error('Failed to create backup. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [])

  // ── Google Drive backup ─────────────────────────────────────────────────

  const handleSendToDrive = useCallback(async () => {
    if (isUploading) return

    let tokenAvailable = knownTokenState === 'present'
    if (knownTokenState === 'untested') {
      const token = await getDriveToken()
      tokenAvailable = token !== null
      setKnownTokenState(tokenAvailable ? 'present' : 'absent')
    }

    if (!tokenAvailable) {
      setReconnectOpen(true)
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setUploadPhase('Exporting data...')
    let phase: 'export' | 'upload' = 'export'

    try {
      const exportData = await exportAllAsJson((percent, message) => {
        setUploadProgress(Math.round(percent * 0.7))
        setUploadPhase(message || 'Exporting data...')
      })

      phase = 'upload'
      setUploadProgress(70)
      setUploadPhase('Uploading to Google Drive...')

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const date = new Date().toLocaleDateString('sv-SE')
      const result = await uploadBackupToDrive(blob, `knowlune-backup-${date}.json`)

      setUploadProgress(100)
      setUploadPhase('Complete!')
      updateBackupMeta('drive')
      setSettings(getSettings())

      toast.success(
        <>
          Saved to Drive.{' '}
          <a
            href={result.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            View
            <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
          </a>
        </>,
        { duration: TOAST_DURATION.SHORT }
      )
    } catch (error) {
      if (error instanceof DriveQuotaError) {
        toast.error(error.message)
      } else if (error instanceof DrivePermissionError) {
        setKnownTokenState('absent')
        setReconnectOpen(true)
        toast.error('Google Drive access needed. Please reconnect.')
      } else if (error instanceof DriveNetworkError) {
        toast.error(error.message)
      } else if (phase === 'export') {
        console.error('Drive export error:', error)
        toast.error('Export failed. Try again?')
      } else {
        console.error('Drive upload error:', error)
        toast.error('Upload failed. Try again?')
      }
    } finally {
      setIsUploading(false)
    }
  }, [isUploading, knownTokenState])

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
        toast.success(
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
        toast.error('Restore failed. Please try again.')
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

        <div
          className="mb-4 rounded-xl border border-border bg-surface-elevated p-4 transition-colors data-[never=true]:border-warning/30 data-[stale=true]:border-destructive/40"
          data-testid="backup-status-banner"
          data-stale={backupDisplay?.isStale ?? false}
          data-never={backupDisplay === null}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div
              className={
                backupDisplay?.isStale
                  ? 'mt-0.5 rounded-lg bg-destructive/10 p-2'
                  : backupDisplay === null
                    ? 'mt-0.5 rounded-lg bg-warning/10 p-2'
                    : 'mt-0.5 rounded-lg bg-brand-soft p-2'
              }
            >
              <ShieldCheck
                className={
                  backupDisplay?.isStale
                    ? 'size-4 text-destructive'
                    : backupDisplay === null
                      ? 'size-4 text-warning'
                      : 'size-4 text-brand'
                }
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              {backupDisplay === null ? (
                <>
                  <p
                    className="text-sm font-medium text-warning"
                    data-testid="never-backed-up-text"
                  >
                    No backup yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Download a backup or connect Google Drive to keep a safe copy of your data.
                  </p>
                </>
              ) : backupDisplay.isStale ? (
                <>
                  <p
                    className="text-sm font-medium text-destructive"
                    data-testid="stale-backup-text"
                  >
                    Last backup was {backupDisplay.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your backup is more than 30 days old. Create a fresh backup to protect your
                    data.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium" data-testid="recent-backup-text">
                    Last backup: {backupDisplay.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Your data is up to date.</p>
                </>
              )}
            </div>
          </div>
        </div>

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

        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-brand-soft p-2">
                  <Cloud className="size-4 text-brand" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">Send to Google Drive</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload your backup JSON to Google Drive for safekeeping
                  </p>
                </div>
              </div>
              <Button
                variant="brand"
                size="sm"
                onClick={handleSendToDrive}
                disabled={isUploading || isExporting || isRestoring}
                className="min-h-[44px] gap-2"
                aria-label={
                  knownTokenState === 'absent'
                    ? 'Reconnect Google Drive'
                    : 'Upload backup to Google Drive'
                }
                data-testid="send-to-drive-button"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Cloud className="size-4" aria-hidden="true" />
                    {knownTokenState === 'absent' ? 'Reconnect Google' : 'Send to Drive'}
                  </>
                )}
              </Button>
            </div>

            {isUploading && (
              <div
                className="mt-3 space-y-1.5"
                data-testid="drive-upload-progress"
                role="status"
                aria-live="polite"
              >
                <Progress
                  value={uploadProgress}
                  className="h-1.5 bg-brand-soft"
                  aria-label="Drive upload progress"
                />
                <p className="text-center text-xs text-muted-foreground">{uploadPhase}</p>
              </div>
            )}
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
      <ReconnectGoogleDialog open={reconnectOpen} onOpenChange={setReconnectOpen} />
    </>
  )
}
