import { useState, useEffect, type FormEvent } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Button } from '@/app/components/ui/button'
import { useAuthStore, NETWORK_ERROR_MESSAGE } from '@/stores/useAuthStore'

const RESEND_COOLDOWN_SECONDS = 60

interface MagicLinkFormProps {
  /** Incremented when dialog reopens — resets form state */
  resetKey?: number
}

export function MagicLinkForm({ resetKey }: MagicLinkFormProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithMagicLink = useAuthStore(s => s.signInWithMagicLink)

  // Reset form state when dialog reopens
  useEffect(() => {
    setEmail('')
    setSent(false)
    setCooldown(0)
    setValidationError(null)
    setLoading(false)
    setError(null)
  }, [resetKey])

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return // double-submit guard
    setValidationError(null)
    setError(null)

    if (!email.includes('@') || !email.includes('.')) {
      setValidationError('Enter a valid email address')
      return
    }

    setLoading(true)
    const result = await signInWithMagicLink(email)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSent(true)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    }
  }

  async function handleResend() {
    if (loading) return
    setError(null)
    setLoading(true)
    const result = await signInWithMagicLink(email)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setCooldown(RESEND_COOLDOWN_SECONDS)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-6" role="status" aria-live="polite">
        <CheckCircle className="size-12 text-success" />
        <p className="text-center text-sm font-medium">Check your email for a sign-in link</p>
        <p className="text-center text-sm text-muted-foreground">
          We sent a link to <strong>{email}</strong>
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResend}
          disabled={loading || cooldown > 0}
          className="min-h-[44px]"
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Link'}
        </Button>
        {error && (
          <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    )
  }

  const displayError = validationError || error
  const errorId = displayError ? 'magic-link-error' : undefined

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
      {displayError && (
        <div
          id="magic-link-error"
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
        <Label htmlFor="magic-link-email">Email</Label>
        <Input
          id="magic-link-email"
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

      <Button
        type="submit"
        variant="brand"
        className="w-full min-h-[44px]"
        disabled={loading}
        aria-disabled={loading}
      >
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading ? 'Sending...' : 'Send Magic Link'}
      </Button>
    </form>
  )
}
