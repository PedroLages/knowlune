import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Cloud, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { ReconnectGoogleDialog } from '@/app/components/settings/ReconnectGoogleDialog'
import { getDriveToken } from '@/lib/googleDriveToken'
import {
  uploadBackupToDrive,
  DriveQuotaError,
  DrivePermissionError,
  DriveNetworkError,
} from '@/lib/googleDriveUpload'
import { exportAllAsJson, updateBackupMeta } from '@/lib/exportService'
import { getSettings } from '@/lib/settings'
import { TOAST_DURATION } from '@/lib/toastConfig'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp

  if (diffMs < 60_000) return 'just now'
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch {
    return 'unknown'
  }
}

/**
 * Derive the display label and staleness info from the current backup metadata.
 *
 * Returns `null` when no backup has ever been recorded (show "never backed up" state).
 * When a backup exists, returns a human-readable relative-time label with the
 * destination name (e.g. "5 minutes ago (Drive)") and a boolean `isStale` that
 * is `true` when the most recent backup is older than `THIRTY_DAYS_MS`.
 *
 * Destination fallback: prefers the explicit `lastDestination` field; when unset,
 * picks the source with the latest timestamp.
 */
function getLastBackupDisplay(settings: ReturnType<typeof getSettings>): {
  label: string
  isStale: boolean
} | null {
  const meta = settings.backupMeta
  if (!meta) return null

  const { lastLocalAt, lastDriveAt, lastDestination } = meta
  if (!lastLocalAt && !lastDriveAt) return null

  // Collect defined timestamps to avoid sentinel-0 confusion in Math.max
  const timestamps: number[] = []
  if (lastLocalAt !== undefined) timestamps.push(lastLocalAt)
  if (lastDriveAt !== undefined) timestamps.push(lastDriveAt)
  const latestTimestamp = Math.max(...timestamps)
  const isStale = Date.now() - latestTimestamp > THIRTY_DAYS_MS

  // Prefer the named destination; fall back to the source with the latest timestamp
  let destLabel: string
  if (lastDestination === 'drive') {
    destLabel = 'Drive'
  } else if (lastDestination === 'local') {
    destLabel = 'Local'
  } else if (lastDriveAt && (!lastLocalAt || lastDriveAt > lastLocalAt)) {
    destLabel = 'Drive'
  } else {
    destLabel = 'Local'
  }

  return { label: `${formatRelativeTime(latestTimestamp)} (${destLabel})`, isStale }
}

/**
 * "Send to Google Drive" panel for the Data & Backup settings section.
 *
 * Checks for an existing Drive token. If the user hasn't granted the
 * `drive.file` scope, shows a "Reconnect Google" button that opens
 * the ReconnectGoogleDialog. Otherwise shows "Send to Drive" that
 * exports the backup and uploads it.
 */
export function DataAndBackupPanel() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadPhase, setUploadPhase] = useState('')
  const [reconnectOpen, setReconnectOpen] = useState(false)
  const [knownTokenState, setKnownTokenState] = useState<'untested' | 'present' | 'absent'>(
    'untested'
  )
  // Use local state so the banner reactively updates when updateBackupMeta fires
  // a settingsUpdated event (e.g. after Drive upload completes).
  const [settings, setSettings] = useState(getSettings())
  const display = getLastBackupDisplay(settings)

  // Subscribe to settingsUpdated events — keeps the backup status banner in sync
  // when updateBackupMeta (which bypasses the SettingsPageContext state) is called.
  useEffect(() => {
    function handleSettingsUpdated() {
      setSettings(getSettings())
    }
    window.addEventListener('settingsUpdated', handleSettingsUpdated)
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdated)
  }, [])

  async function handleSendToDrive() {
    if (isUploading) return

    // 1. Check token every time (it may have been refreshed in another tab)
    let tokenAvailable: boolean
    if (knownTokenState === 'untested') {
      const token = await getDriveToken()
      tokenAvailable = token !== null
      setKnownTokenState(tokenAvailable ? 'present' : 'absent')
    } else {
      tokenAvailable = knownTokenState === 'present'
    }

    if (!tokenAvailable) {
      setReconnectOpen(true)
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setUploadPhase('Exporting data...')

    let currentPhase: 'export' | 'upload' = 'export'
    let succeeded = false

    try {
      // 1. Export all data as JSON
      const exportData = await exportAllAsJson((percent, phase) => {
        // Export takes ~70% of the total progress
        const scaledPercent = Math.round(percent * 0.7)
        setUploadProgress(scaledPercent)
        setUploadPhase(phase || 'Exporting data...')
      })

      currentPhase = 'upload'
      setUploadPhase('Uploading to Google Drive...')
      setUploadProgress(70)

      // 2. Create the backup blob
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const dateStr = new Date().toLocaleDateString('sv-SE')
      const filename = `knowlune-backup-${dateStr}.json`

      // 3. Upload to Drive
      const result = await uploadBackupToDrive(blob, filename)

      setUploadProgress(100)
      succeeded = true
      setUploadPhase('Complete!')

      // Record backup metadata (E77A-S04)
      updateBackupMeta('drive')

      // 4. Show success toast with view link
      toast.success(
        <>
          Saved to Drive.{' '}
          <a
            href={result.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
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
        // Token is missing/expired/revoked — open reconnect dialog
        setReconnectOpen(true)
        toast.error('Google Drive access needed. Please reconnect.')
      } else if (error instanceof DriveNetworkError) {
        toast.error(error.message)
      } else if (currentPhase === 'export') {
        console.error('Drive export error:', error)
        toast.error('Export failed. Try again?')
      } else {
        console.error('Drive upload error:', error)
        toast.error('Upload failed. Try again?')
      }
    } finally {
      setIsUploading(false)
      if (!succeeded) {
        setUploadProgress(0)
        setUploadPhase('')
      }
    }
  }

  return (
    <>
      {/* Backup status banner — informational (E77A-S04) */}
      <div
        className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors data-[stale=true]:border-destructive/40 data-[never=true]:border-warning/30"
        data-testid="backup-status-banner"
        data-stale={display?.isStale ?? false}
        data-never={display === null}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div
            className={`rounded-lg p-2 mt-0.5 ${
              display?.isStale
                ? 'bg-destructive/10'
                : display === null
                  ? 'bg-warning/10'
                  : 'bg-brand-soft'
            }`}
          >
            <ShieldCheck
              className={`size-4 ${
                display?.isStale
                  ? 'text-destructive'
                  : display === null
                    ? 'text-warning'
                    : 'text-brand'
              }`}
              aria-hidden="true"
            />
          </div>
          <div className="flex-1 min-w-0">
            {display === null ? (
              <>
                <p className="text-sm font-medium text-warning" data-testid="never-backed-up-text">
                  No backup yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You have never backed up your data. Export your data or connect Google Drive to
                  keep a safe copy.
                </p>
              </>
            ) : display.isStale ? (
              <>
                <p className="text-sm font-medium text-destructive" data-testid="stale-backup-text">
                  Last backup was {display.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your backup is more than 30 days old. Create a fresh backup to protect your data.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium" data-testid="recent-backup-text">
                  Last backup: {display.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Your data is up to date.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand-soft p-2 mt-0.5">
              <Cloud className="size-4 text-brand" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Send to Google Drive</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your backup JSON to Google Drive for safekeeping
              </p>
            </div>
          </div>
          <Button
            variant="brand"
            size="sm"
            onClick={handleSendToDrive}
            disabled={isUploading}
            className="gap-2 min-h-[44px]"
            aria-label={
              knownTokenState === 'present'
                ? 'Upload backup to Google Drive'
                : 'Connect Google Drive'
            }
            data-testid="send-to-drive-button"
          >
            {isUploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Cloud className="size-4" />
                {knownTokenState === 'present' || knownTokenState === 'untested'
                  ? 'Send to Drive'
                  : 'Reconnect Google'}
              </>
            )}
          </Button>
        </div>

        {/* Progress indicator */}
        {isUploading && (
          <div
            className="mt-3 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300"
            data-testid="drive-upload-progress"
            role="status"
            aria-live="polite"
          >
            <Progress
              value={uploadProgress}
              className="h-1.5 bg-brand-soft"
              aria-label="Drive upload progress"
            />
            <p className="text-xs text-muted-foreground text-center">{uploadPhase}</p>
          </div>
        )}
      </div>

      {/* Reconnect dialog */}
      <ReconnectGoogleDialog open={reconnectOpen} onOpenChange={setReconnectOpen} />
    </>
  )
}
