import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Button } from '@/app/components/ui/button'
import { useAuthStore, NETWORK_ERROR_MESSAGE } from '@/stores/useAuthStore'
import { toastSuccess } from '@/lib/toastHelpers'

interface EmailPasswordFormProps {
  mode: 'sign-in' | 'sign-up'
  onSuccess: () => void
}

export function EmailPasswordForm({ mode, onSuccess }: EmailPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const { loading, error, signUp, signIn, clearError } = useAuthStore()

  const isSignUp = mode === 'sign-up'

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
    setValidationError(null)
    clearError()

    const validationErr = validate()
    if (validationErr) {
      setValidationError(validationErr)
      return
    }

    const result = isSignUp ? await signUp(email, password) : await signIn(email, password)

    if (!result.error) {
      toastSuccess.saved(isSignUp ? 'Account created successfully' : 'Signed in successfully')
      onSuccess()
    }
  }

  const displayError = validationError || error
  const errorId = displayError ? 'auth-form-error' : undefined

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
      {displayError && (
        <div
          id="auth-form-error"
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p>{displayError}</p>
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
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={loading}
          required
          autoComplete={isSignUp ? 'email' : 'username'}
          aria-invalid={displayError?.toLowerCase().includes('email') || undefined}
          aria-describedby={displayError?.toLowerCase().includes('email') ? errorId : undefined}
          className="min-h-[44px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
          required
          minLength={8}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          aria-invalid={displayError?.toLowerCase().includes('password') || undefined}
          aria-describedby={displayError?.toLowerCase().includes('password') ? errorId : undefined}
          className="min-h-[44px]"
        />
      </div>

      {isSignUp && (
        <div className="space-y-2">
          <Label htmlFor="auth-confirm-password">Confirm Password</Label>
          <Input
            id="auth-confirm-password"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
            autoComplete="new-password"
            aria-invalid={displayError?.toLowerCase().includes('match') || undefined}
            aria-describedby={displayError?.toLowerCase().includes('match') ? errorId : undefined}
            className="min-h-[44px]"
          />
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        className="w-full min-h-[44px]"
        disabled={loading}
        aria-disabled={loading}
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
