import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { supabase } from '@/lib/auth/supabase'
import { mapSupabaseError, NETWORK_ERROR_MESSAGE } from '@/stores/useAuthStore'
import { toast } from 'sonner'
import { TOAST_DURATION } from '@/lib/toastConfig'

/**
 * Change Email form for authenticated users.
 * Calls supabase.auth.updateUser({ email }) which triggers a verification email.
 */
export function ChangeEmail() {
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)
  const isValid = isValidEmail && password.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !supabase) return

    setError('')
    setIsSubmitting(true)

    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email ?? '',
        password,
      })

      if (signInError) {
        setError(mapSupabaseError(signInError.message))
        setIsSubmitting(false)
        return
      }

      // Request email change — Supabase sends verification to new address
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      })

      if (updateError) {
        setError(mapSupabaseError(updateError.message))
      } else {
        toast.info('Verification email sent to your new address. Please check your inbox.', {
          duration: TOAST_DURATION.LONG,
        })
        setNewEmail('')
        setPassword('')
      }
    } catch {
      // Error is displayed inline via the error state below the form
      setError(NETWORK_ERROR_MESSAGE)
      toast.error(NETWORK_ERROR_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
        <h4 className="text-sm font-medium">Change Email</h4>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-email" className="text-sm">
            New Email Address
          </Label>
          <Input
            id="new-email"
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="Enter new email address"
            autoComplete="email"
            className="min-h-[44px]"
            data-testid="new-email-input"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-change-password" className="text-sm">
            Current Password
          </Label>
          <Input
            id="email-change-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Verify your identity"
            autoComplete="current-password"
            className="min-h-[44px]"
            data-testid="email-change-password-input"
          />
        </div>
      </div>

      {newEmail.length > 0 && !isValidEmail && (
        <p className="text-xs text-warning" role="status">
          Please enter a valid email address
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
        data-testid="change-email-submit"
      >
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Sending verification...' : 'Change Email'}
      </Button>
    </form>
  )
}
