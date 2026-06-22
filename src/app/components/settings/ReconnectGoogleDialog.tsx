import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { useAuthStore } from '@/stores/useAuthStore'
import { toastError } from '@/lib/toastHelpers'

export interface ReconnectGoogleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReconnected?: () => void
}

/**
 * Dialog that explains the user needs to grant Drive scope
 * and offers a button to re-authenticate via Google OAuth.
 */
export function ReconnectGoogleDialog({
  open,
  onOpenChange,
  onReconnected,
}: ReconnectGoogleDialogProps) {
  const [isReconnecting, setIsReconnecting] = useState(false)
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle)

  async function handleReconnect() {
    setIsReconnecting(true)
    try {
      const result = await signInWithGoogle()
      if (result.error) {
        toastError.saveFailed(result.error)
        setIsReconnecting(false)
        return
      }
      // OAuth redirects the page — this line is reached only if an error occurs
      onReconnected?.()
    } catch {
      toastError.saveFailed('Failed to reconnect Google. Please try again.')
    } finally {
      setIsReconnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-brand-soft">
            <ExternalLink className="size-6 text-brand" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center">Connect Google Drive</DialogTitle>
          <DialogDescription className="text-center">
            To upload backups to Google Drive, Knowlune needs permission to create files in your
            Drive. This uses the{' '}
            <strong className="text-foreground">drive.file</strong> scope — only files created by
            Knowlune are accessible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-xl border border-border bg-surface-elevated p-4 text-sm text-muted-foreground">
          <p>
            You will be redirected to Google to grant this permission. Your existing session will
            remain intact.
          </p>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isReconnecting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="min-h-[44px] gap-2"
          >
            {isReconnecting ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Continue with Google'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
