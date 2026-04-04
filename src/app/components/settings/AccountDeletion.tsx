// E19-S09: GDPR Account Deletion UI
// Settings > Account > "Delete My Account" with confirmation dialog,
// re-authentication, progress indicator, and soft-delete grace period.

import { useState, useCallback } from 'react'
import { Trash2, AlertTriangle, Loader2, Lock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Progress } from '@/app/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog'
import {
  deleteAccount,
  reauthenticate,
  sessionRequiresReauth,
  DELETION_STEP_LABELS,
  DELETION_STEP_PROGRESS,
  SOFT_DELETE_GRACE_DAYS,
  type DeletionStep,
} from '@/lib/account/deleteAccount'
import { toastError } from '@/lib/toastHelpers'

type Phase = 'confirm' | 'reauth' | 'deleting' | 'complete' | 'error'

export function AccountDeletion() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('confirm')
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [currentStep, setCurrentStep] = useState<DeletionStep>('verifying')
  const [errorMessage, setErrorMessage] = useState('')
  const [reauthError, setReauthError] = useState('')

  const resetState = useCallback(() => {
    setPhase('confirm')
    setConfirmText('')
    setPassword('')
    setCurrentStep('verifying')
    setErrorMessage('')
    setReauthError('')
  }, [])

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen && phase === 'deleting') return // Prevent closing during deletion
    setOpen(newOpen)
    if (!newOpen) resetState()
  }

  async function handleConfirm() {
    if (confirmText !== 'DELETE') return

    // Check if re-authentication is needed
    if (sessionRequiresReauth()) {
      setPhase('reauth')
      return
    }

    await performDeletion()
  }

  async function handleReauth() {
    if (!password.trim()) return
    setReauthError('')

    const result = await reauthenticate(password)
    if (result.error) {
      setReauthError(result.error)
      return
    }

    await performDeletion()
  }

  async function performDeletion() {
    setPhase('deleting')

    const result = await deleteAccount((step: DeletionStep) => {
      setCurrentStep(step)
    })

    if (result.success) {
      setPhase('complete')
    } else {
      setPhase('error')
      setErrorMessage(result.error ?? 'An unexpected error occurred.')
      if (result.invoiceError) {
        toastError.saveFailed('Open invoices must be resolved before deleting your account.')
      }
    }
  }

  const isDeleteEnabled = confirmText === 'DELETE'
  const progressValue = DELETION_STEP_PROGRESS[currentStep] ?? 0
  const stepLabel = DELETION_STEP_LABELS[currentStep] ?? ''

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="gap-2 min-h-[44px]"
          aria-label="Delete my account"
          data-testid="delete-account-trigger"
        >
          <Trash2 className="size-4" />
          Delete My Account
        </Button>
      </DialogTrigger>

      <DialogContent
        className="rounded-2xl sm:max-w-md"
        onInteractOutside={e => {
          if (phase === 'deleting') e.preventDefault()
        }}
        aria-describedby="delete-account-description"
      >
        {/* Phase: Confirmation */}
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
                <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
              </div>
              <DialogTitle className="text-center">Delete Your Account</DialogTitle>
              <DialogDescription id="delete-account-description" className="text-center">
                This action will permanently delete your account and all associated data after a{' '}
                {SOFT_DELETE_GRACE_DAYS}-day grace period. This includes:
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-2 text-sm text-muted-foreground" role="list">
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5" aria-hidden="true">
                  &bull;
                </span>
                Your subscription and payment data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5" aria-hidden="true">
                  &bull;
                </span>
                Your authentication credentials
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-0.5" aria-hidden="true">
                  &bull;
                </span>
                All locally cached entitlement data
              </li>
            </ul>

            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
              <p>
                <strong className="text-warning">Grace period:</strong> You have{' '}
                {SOFT_DELETE_GRACE_DAYS} days to cancel by signing back in. After that, deletion is
                permanent and irreversible.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-delete" className="text-sm font-medium">
                Type <strong className="text-destructive">DELETE</strong> to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="font-mono text-center tracking-widest"
                aria-describedby="confirm-delete-hint"
                autoComplete="off"
                data-testid="confirm-delete-input"
              />
              <p id="confirm-delete-hint" className="text-xs text-muted-foreground text-center">
                This confirmation is required to proceed
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={!isDeleteEnabled}
                className="gap-2 min-h-[44px]"
                data-testid="confirm-delete-button"
              >
                <Trash2 className="size-4" />
                Delete My Account
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Phase: Re-authentication */}
        {phase === 'reauth' && (
          <>
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft mb-2">
                <Lock className="size-6 text-brand" aria-hidden="true" />
              </div>
              <DialogTitle className="text-center">Verify Your Identity</DialogTitle>
              <DialogDescription className="text-center">
                For security, please re-enter your password to continue with account deletion.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="reauth-password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="reauth-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="min-h-[44px]"
                autoComplete="current-password"
                data-testid="reauth-password-input"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleReauth()
                }}
              />
              {reauthError && (
                <p className="text-xs text-destructive" role="alert">
                  {reauthError}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setPhase('confirm')}
                className="min-h-[44px]"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleReauth}
                disabled={!password.trim()}
                className="gap-2 min-h-[44px]"
                data-testid="reauth-submit-button"
              >
                <Lock className="size-4" />
                Verify & Delete
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Phase: Deleting (progress) */}
        {phase === 'deleting' && (
          <>
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
                <Loader2 className="size-6 text-destructive animate-spin" aria-hidden="true" />
              </div>
              <DialogTitle className="text-center">Deleting Account</DialogTitle>
              <DialogDescription className="text-center">
                Please do not close this window. This process cannot be interrupted.
              </DialogDescription>
            </DialogHeader>

            <div
              className="space-y-3"
              role="status"
              aria-live="polite"
              data-testid="deletion-progress"
            >
              <Progress
                value={progressValue}
                className="h-2 bg-destructive/10"
                aria-label="Deletion progress"
              />
              <p className="text-sm text-center text-muted-foreground">{stepLabel}</p>
            </div>
          </>
        )}

        {/* Phase: Complete */}
        {phase === 'complete' && (
          <>
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft mb-2">
                <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
              </div>
              <DialogTitle className="text-center">Account Deletion Scheduled</DialogTitle>
              <DialogDescription className="text-center">
                Your account has been marked for deletion. You have {SOFT_DELETE_GRACE_DAYS} days to
                cancel by signing back in. After that, all data will be permanently removed.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="w-full min-h-[44px]"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Phase: Error */}
        {phase === 'error' && (
          <>
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
                <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
              </div>
              <DialogTitle className="text-center">Deletion Failed</DialogTitle>
              <DialogDescription className="text-center">{errorMessage}</DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="min-h-[44px]"
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  resetState()
                  setPhase('confirm')
                }}
                className="gap-2 min-h-[44px]"
              >
                Try Again
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
