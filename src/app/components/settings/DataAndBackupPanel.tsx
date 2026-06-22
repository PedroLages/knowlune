import { useState } from 'react'
import { toast } from 'sonner'
import { Cloud, ExternalLink, Loader2 } from 'lucide-react'
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
import { exportAllAsJson } from '@/lib/exportService'
import { TOAST_DURATION } from '@/lib/toastConfig'

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
