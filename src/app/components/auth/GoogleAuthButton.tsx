import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useAuthStore, NETWORK_ERROR_MESSAGE } from '@/stores/useAuthStore'
import { GoogleIcon } from './GoogleIcon'

export function GoogleAuthButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle)

  async function handleClick() {
    if (loading) return // double-submit guard
    setError(null)
    setLoading(true)
    const result = await signInWithGoogle()
    // Only reset loading if we didn't redirect (i.e., there was an error)
    if (result.error) {
      setLoading(false)
      setError(result.error)
    }
    // On success, OAuth redirects — loading stays true until page unloads
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <p>{error}</p>
          {error === NETWORK_ERROR_MESSAGE && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 min-h-[44px]"
              onClick={handleClick}
              disabled={loading}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      <Button
        variant="outline"
        className="w-full min-h-[48px] gap-3 text-base"
        onClick={handleClick}
        disabled={loading}
        aria-disabled={loading}
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Button>
    </div>
  )
}
