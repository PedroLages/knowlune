/**
 * DriveConfigurationSettings — Google Drive connection settings for Integrations & Data section.
 *
 * Displays:
 * - Connected account email when Google OAuth is active
 * - drive.readonly scope status (required for Drive folder browsing)
 * - Disconnect action to remove Drive access
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { HardDrive, CheckCircle2, AlertTriangle, LogOut, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { hasDriveReadScope, requestDriveReadScope } from '@/lib/googleDriveToken'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import { toast } from 'sonner'

export function DriveConfigurationSettings() {
  const user = useAuthStore(s => s.user)
  const session = useAuthStore(s => s.session)
  const signOut = useAuthStore(s => s.signOut)

  const [readScopeGranted, setReadScopeGranted] = useState<boolean | null>(null)
  const [scopeCheckLoading, setScopeCheckLoading] = useState(true)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Check whether a Drive token exists (user has at least drive.file scope)
  const hasDriveToken = !!session?.provider_token
  // Derive the connected Google email from user identities
  const googleIdentity = user?.identities?.find(id => id.provider === 'google')
  const googleEmail: string | null = googleIdentity?.identity_data?.email ?? user?.email ?? null

  // Check drive.readonly scope status
  useEffect(() => {
    let ignore = false
    async function check() {
      if (!hasDriveToken) {
        if (!ignore) {
          setReadScopeGranted(false)
          setScopeCheckLoading(false)
        }
        return
      }
      try {
        const granted = await hasDriveReadScope()
        if (!ignore) {
          setReadScopeGranted(granted)
          setScopeCheckLoading(false)
        }
      } catch {
        if (!ignore) {
          setReadScopeGranted(false)
          setScopeCheckLoading(false)
        }
      }
    }
    check()
    return () => {
      ignore = true
    }
  }, [hasDriveToken])

  /** Re-authenticate with Google to grant the drive.readonly scope. */
  async function handleGrantReadScope() {
    await requestDriveReadScope()
    // requestDriveReadScope triggers a redirect — no return
  }

  /** Disconnect Google Drive by signing the user out of the current session. */
  async function handleDisconnect() {
    setIsDisconnecting(true)
    try {
      const { error } = await signOut()
      if (error) {
        toast.error('Failed to disconnect Drive: ' + error)
      } else {
        toast.success('Google Drive disconnected')
        setReadScopeGranted(false)
      }
    } catch {
      toast.error('Failed to disconnect Drive')
    } finally {
      setIsDisconnecting(false)
      setDisconnectDialogOpen(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <HardDrive className="size-5 text-brand-soft-foreground" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg font-display">Google Drive</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your Google Drive connection for course imports and backup
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-6" data-testid="drive-configuration-section">
        {/* Connected Account Display */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Connected Account</h3>
          {hasDriveToken && googleEmail ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-success-soft p-2">
                  <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium">{googleEmail}</p>
                  <p className="text-xs text-muted-foreground">Google account connected</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-muted p-2">
                  <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium">Not connected</p>
                  <p className="text-xs text-muted-foreground">
                    Sign in with Google to use Drive features
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drive Read Scope Status */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Drive Permissions</h3>
          <div className="rounded-xl border border-border bg-surface-elevated p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-brand-soft p-2">
                  <ExternalLink className="size-4 text-brand" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium">Read Files &amp; Folders</p>
                  <p className="text-xs text-muted-foreground">
                    Required to browse and import from Google Drive
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {scopeCheckLoading ? (
                  <Badge variant="outline" className="text-xs">
                    Checking...
                  </Badge>
                ) : readScopeGranted ? (
                  <Badge
                    variant="secondary"
                    className="bg-success-soft text-success text-xs"
                    data-testid="drive-read-scope-status"
                  >
                    <CheckCircle2 className="size-3 mr-1" aria-hidden="true" />
                    Granted
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGrantReadScope}
                    className="gap-2 min-h-[44px]"
                    disabled={!hasDriveToken}
                    aria-label="Grant Drive read permission"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Grant Access
                  </Button>
                )}
              </div>
            </div>
            {!scopeCheckLoading && !readScopeGranted && hasDriveToken && (
              <p className="text-xs text-warning mt-2 flex items-center gap-1">
                <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                Read permission not yet granted. This is needed for the Drive folder browser.
              </p>
            )}
          </div>
        </div>

        {/* Disconnect Action */}
        <div className="pt-2 border-t border-border/50">
          <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive gap-2 min-h-[44px]"
                disabled={!hasDriveToken}
                aria-label="Disconnect Google Drive"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Disconnect Google Drive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will sign you out of your current session. Drive-imported courses will remain
                  in your library but new file access will not be available until you reconnect.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
