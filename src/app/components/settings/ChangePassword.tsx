import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { supabase } from '@/lib/auth/supabase'
import { mapSupabaseError, NETWORK_ERROR_MESSAGE } from '@/stores/useAuthStore'
import { toast } from 'sonner'
import { toastSuccess } from '@/lib/toastHelpers'

/**
 * Change Password form for email/password authenticated users.
 * Validates min 8 chars, password match, then calls supabase.auth.updateUser.
 */
export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValid =
    currentPassword.trim().length > 0 && newPassword.length >= 8 && newPassword === confirmPassword

  function getValidationMessage(): string {
    if (newPassword.length > 0 && newPassword.length < 8) {
      return 'Password must be at least 8 characters'
    }
    if (confirmPassword.length > 0 && newPassword !== confirmPassword) {
      return 'Passwords do not match'
    }
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !supabase) return

    setError('')
    setIsSubmitting(true)

    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email ?? '',
        password: currentPassword,
      })

      if (signInError) {
        setError(mapSupabaseError(signInError.message))
        setIsSubmitting(false)
        return
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError(mapSupabaseError(updateError.message))
      } else {
        toastSuccess.saved('Password updated successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      // Error is displayed inline via the error state below the form
      setError(NETWORK_ERROR_MESSAGE)
      toast.error(NETWORK_ERROR_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  const validationMessage = getValidationMessage()

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
        <h4 className="text-sm font-medium">Change Password</h4>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="current-password" className="text-sm">
            Current Password
          </Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            autoComplete="current-password"
            className="min-h-[44px]"
            data-testid="current-password-input"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-sm">
            New Password
          </Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="min-h-[44px]"
            data-testid="new-password-input"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-sm">
            Confirm New Password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            className="min-h-[44px]"
            data-testid="confirm-password-input"
          />
        </div>
      </div>

      {validationMessage && (
        <p className="text-xs text-warning" role="status">
          {validationMessage}
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="brand"
        size="sm"
        disabled={!isValid || isSubmitting}
        className="gap-2 min-h-[44px]"
        data-testid="change-password-submit"
      >
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Updating...' : 'Update Password'}
      </Button>
    </form>
  )
}
