import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { Mail, Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { EmailPasswordForm } from '@/app/components/auth/EmailPasswordForm'
import { MagicLinkForm } from '@/app/components/auth/MagicLinkForm'
import { GoogleAuthButton } from '@/app/components/auth/GoogleAuthButton'
import { GoogleIcon } from '@/app/components/auth/GoogleIcon'
import { KnowluneLogo } from '@/app/components/figma/KnowluneLogo'
import { useAuthStore } from '@/stores/useAuthStore'
import { RETURN_TO_KEY } from '@/app/components/figma/SessionExpiredBanner'

type AuthMode = 'sign-in' | 'sign-up'

export function Login() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)

  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [activeTab, setActiveTab] = useState('email')
  const [resetKey, setResetKey] = useState(0)

  /** Navigate to the stored return-to route (or fallback to '/'), clearing the sessionStorage key. */
  function navigateToReturnRoute() {
    const returnTo = sessionStorage.getItem(RETURN_TO_KEY)
    sessionStorage.removeItem(RETURN_TO_KEY)
    navigate(returnTo || '/', { replace: true })
  }

  // Redirect authenticated users away from /login (with return-to-route support)
  useEffect(() => {
    if (initialized && user) {
      navigateToReturnRoute()
    }
  }, [initialized, user, navigate])

  function handleSuccess() {
    navigateToReturnRoute()
  }

  function toggleMode() {
    setMode(m => (m === 'sign-in' ? 'sign-up' : 'sign-in'))
    setResetKey(k => k + 1)
  }

  const title = mode === 'sign-in' ? 'Sign in to Knowlune' : 'Create your Knowlune account'
  const description =
    mode === 'sign-in'
      ? 'Welcome back! Sign in to access premium features.'
      : 'Create an account to unlock premium features.'
  const toggleText = mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'
  const toggleAction = mode === 'sign-in' ? 'Sign Up' : 'Sign In'

  // Don't render login form if user is already authenticated (prevents flash)
  if (initialized && user) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <Link to="/" aria-label="Back to app">
            <KnowluneLogo />
          </Link>
          <p className="text-xs tracking-wide text-muted-foreground">Illuminate Your Path</p>
        </div>

        {/* Auth Card */}
        <Card className="rounded-[24px]">
          <CardHeader className="items-center text-center pb-2">
            <div className="mx-auto mb-2 rounded-full bg-brand-soft p-3">
              <Mail className="size-6 text-brand" aria-hidden="true" />
            </div>
            <CardTitle className="font-display text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full h-11">
                <TabsTrigger value="email" className="gap-1.5">
                  <Mail className="size-4" aria-hidden="true" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="magic-link" className="gap-1.5">
                  <Link2 className="size-4" aria-hidden="true" />
                  Magic Link
                </TabsTrigger>
                <TabsTrigger value="google" className="gap-1.5">
                  <GoogleIcon className="size-4" />
                  Google
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="mt-4">
                <EmailPasswordForm key={resetKey} mode={mode} onSuccess={handleSuccess} />
              </TabsContent>

              <TabsContent value="magic-link" className="mt-4">
                <MagicLinkForm resetKey={resetKey} />
              </TabsContent>

              <TabsContent value="google" className="mt-4">
                <GoogleAuthButton />
              </TabsContent>
            </Tabs>

            {/* Mode toggle */}
            <div className="text-center text-sm text-muted-foreground">
              {toggleText}{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="min-h-[44px] font-medium text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                {toggleAction}
              </button>
            </div>

            {/* Legal links */}
            <div className="text-center text-xs text-muted-foreground">
              By continuing you agree to our{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-soft-foreground hover:underline"
              >
                Privacy Policy
              </a>{' '}
              and{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-soft-foreground hover:underline"
              >
                Terms of Service
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
