import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Loader2, Eye, EyeOff, X } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Button } from '@/app/components/ui/button'
import { useAuthStore, NETWORK_ERROR_MESSAGE } from '@/stores/useAuthStore'
import { toastSuccess } from '@/lib/toastHelpers'
import { supabase } from '@/lib/auth/supabase'
import { toast } from 'sonner'
import { writeNoticeAck } from '@/lib/compliance/noticeAck'
import { CURRENT_NOTICE_VERSION } from '@/lib/compliance/noticeVersion'

interface EmailPasswordFormProps {
  mode: 'sign-in' | 'sign-up'
  onSuccess: () => void
  idPrefix?: string
}

export function EmailPasswordForm({ mode, onSuccess, idPrefix = 'auth' }: EmailPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const signUp = useAuthStore(s => s.signUp)
  const signIn = useAuthStore(s => s.signIn)

  const isSignUp = mode === 'sign-up'

  async function handleForgotPassword() {
    if (!email.includes('@') || !email.includes('.')) {
      setValidationError('Enter your email address above, then click Forgot Password')
      return
    }
    if (!supabase) {
      toast.error('Authentication is not configured.')
      return
    }
    setForgotLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
      if (resetError) {
        toast.error(resetError.message)
      } else {
        toastSuccess.saved('Password reset email sent. Check your inbox.')
      }
    } catch {
      toast.error('Unable to send reset email. Please try again.')
    }
    setForgotLoading(false)
  }

  function validate(): string | null {
    if (!email.includes('@') || !email.includes('.')) {
      return 'Enter a valid email address'
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters'
    }
    if (isSignUp && password !== confirmPassword) {
      return 'Passwords do not match'
    }
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return // double-submit guard
    setValidationError(null)
    setError(null)

    const validationErr = validate()
    if (validationErr) {
      setValidationError(validationErr)
      return
    }

    setLoading(true)
    const result = isSignUp ? await signUp(email, password) : await signIn(email, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      toastSuccess.saved(isSignUp ? 'Account created successfully' : 'Signed in successfully')
      // Write notice acknowledgement after successful signup (AC-3).
      // Non-blocking: ack write failure shows a toast but does NOT prevent
      // the user from completing signup.
      if (isSignUp && privacyAcknowledged) {
        try {
          await writeNoticeAck(CURRENT_NOTICE_VERSION)
        } catch {
          toast.error('Could not record your consent. You can acknowledge from Settings.')
        }
      }
      onSuccess()
    }
  }

  const displayError = validationError || error
  const errorId = displayError ? `${idPrefix}-form-error` : undefined

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
      {displayError && (
        <div
          id={`${idPrefix}-form-error`}
          role="alert"
          className="relative rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <button
            type="button"
            onClick={() => { setValidationError(null); setError(null) }}
            className="absolute right-2 top-2 rounded p-0.5 hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Dismiss error"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
          <p className="pr-6">{displayError}</p>
          {error === NETWORK_ERROR_MESSAGE && (
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="mt-2 min-h-[44px]"
              disabled={loading}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={loading}
          required
          autoComplete="email"
          aria-invalid={displayError?.toLowerCase().includes('email') || undefined}
          aria-describedby={displayError?.toLowerCase().includes('email') ? errorId : undefined}
          className="min-h-[44px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-password`}>Password</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-password`}
            type={showPassword ? 'text' : 'password'}
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            required
            minLength={8}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            aria-invalid={displayError?.toLowerCase().includes('password') || undefined}
            aria-describedby={
              displayError?.toLowerCase().includes('password') ? errorId : `${idPrefix}-password-hint`
            }
            className="min-h-[44px] pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center size-[44px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <p id={`${idPrefix}-password-hint`} className="text-xs text-muted-foreground">
          Must be at least 8 characters
        </p>
        {!isSignUp && (
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={forgotLoading}
            className="min-h-[44px] text-sm font-medium text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm disabled:opacity-50"
          >
            {forgotLoading ? 'Sending...' : 'Forgot Password?'}
          </button>
        )}
      </div>

      {isSignUp && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-confirm-password`}>Confirm Password</Label>
          <div className="relative">
            <Input
              id={`${idPrefix}-confirm-password`}
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete="new-password"
              aria-invalid={displayError?.toLowerCase().includes('match') || undefined}
              aria-describedby={displayError?.toLowerCase().includes('match') ? errorId : undefined}
              className="min-h-[44px] pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(v => !v)}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center size-[44px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}

      {/* Privacy notice acknowledgement checkbox — sign-up mode only (AC-2) */}
      {isSignUp && (
        <div className="flex items-start gap-3 min-h-[44px] py-1">
          <input
            id={`${idPrefix}-privacy-ack`}
            type="checkbox"
            checked={privacyAcknowledged}
            onChange={e => setPrivacyAcknowledged(e.target.checked)}
            disabled={loading}
            className="mt-0.5 size-4 shrink-0 rounded border border-input accent-brand cursor-pointer"
            aria-describedby={`${idPrefix}-privacy-ack-label`}
          />
          <label
            id={`${idPrefix}-privacy-ack-label`}
            htmlFor={`${idPrefix}-privacy-ack`}
            className="text-sm text-muted-foreground leading-snug cursor-pointer select-none"
          >
            I have read the{' '}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
              onClick={e => e.stopPropagation()}
            >
              Privacy Notice
            </Link>{' '}
            <span className="text-muted-foreground/70">(v{CURRENT_NOTICE_VERSION})</span>
          </label>
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        className="w-full min-h-[44px]"
        disabled={loading || (isSignUp && !privacyAcknowledged)}
        aria-disabled={loading || (isSignUp && !privacyAcknowledged)}
      >
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading
          ? isSignUp
            ? 'Creating account...'
            : 'Signing in...'
          : isSignUp
            ? 'Create Account'
            : 'Sign In'}
      </Button>
    </form>
  )
}
