import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Mail, Link2, BookOpen, Brain, Zap, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { EmailPasswordForm } from '@/app/components/auth/EmailPasswordForm'
import { MagicLinkForm } from '@/app/components/auth/MagicLinkForm'
import { GoogleAuthButton } from '@/app/components/auth/GoogleAuthButton'
import { KnowluneLogo } from '@/app/components/figma/KnowluneLogo'
import { RETURN_TO_KEY } from '@/app/components/figma/SessionExpiredBanner'

type AuthMode = 'sign-in' | 'sign-up'

const VALUE_BULLETS = [
  {
    icon: BookOpen,
    title: 'All your learning in one place',
    body: 'Import YouTube courses, audiobooks, PDFs, and EPUBs. Everything organised, searchable, and in sync.',
  },
  {
    icon: Brain,
    title: 'Remember what you learn',
    body: 'Spaced-repetition flashcards, quizzes, and AI-generated summaries turn passive watching into lasting knowledge.',
  },
  {
    icon: Zap,
    title: 'Build a real streak',
    body: 'Daily goals, progress tracking, and achievement milestones keep you consistent week after week.',
  },
]

function AuthCard({ idPrefix = 'auth' }: { idPrefix?: string }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [activeTab, setActiveTab] = useState('email')
  const [resetKey, setResetKey] = useState(0)
  const [authError, setAuthError] = useState<string | null>(null)

  // Surface OAuth / magic-link errors redirected from /auth/callback.
  useEffect(() => {
    const url = new URL(window.location.href)
    const err = url.searchParams.get('authError')
    if (err) {
      setAuthError(err)
      url.searchParams.delete('authError')
      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash)
    }
  }, [])

  function handleSuccess() {
    const returnTo = sessionStorage.getItem(RETURN_TO_KEY)
    sessionStorage.removeItem(RETURN_TO_KEY)
    const dest = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/courses'
    navigate(dest, { replace: true })
  }

  function toggleMode() {
    setMode(m => (m === 'sign-in' ? 'sign-up' : 'sign-in'))
    setResetKey(k => k + 1)
  }

  const title = mode === 'sign-in' ? 'Sign in to Knowlune' : 'Create your account'
  const toggleText = mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'
  const toggleAction = mode === 'sign-in' ? 'Sign Up' : 'Sign In'

  return (
    <Card className="w-full rounded-2xl shadow-lg">
      <CardHeader className="items-center text-center pb-2">
        <CardTitle className="font-display text-xl">{title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Skip-to-auth link for screen readers */}
        <a
          href="#auth-email-input"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-1 focus:text-sm focus:text-brand-foreground"
        >
          Skip to sign-in form
        </a>

        {authError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex-1">{authError}</div>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="text-xs underline underline-offset-2 hover:no-underline"
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        )}

        <GoogleAuthButton />

        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground shrink-0">or continue with email</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="default" className="w-full min-h-[44px]">
            <TabsTrigger variant="default" value="email" className="gap-1.5">
              <Mail className="size-4" aria-hidden="true" />
              Email
            </TabsTrigger>
            <TabsTrigger variant="default" value="magic-link" className="gap-1.5">
              <Link2 className="size-4" aria-hidden="true" />
              Magic Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-4">
            <EmailPasswordForm key={resetKey} mode={mode} onSuccess={handleSuccess} idPrefix={idPrefix} />
          </TabsContent>
          <TabsContent value="magic-link" className="mt-4">
            <MagicLinkForm resetKey={resetKey} />
          </TabsContent>
        </Tabs>

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

        <div className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-soft-foreground underline underline-offset-2 hover:no-underline"
          >
            Privacy Policy
          </a>{' '}
          and{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-soft-foreground underline underline-offset-2 hover:no-underline"
          >
            Terms of Service
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

function ValueProp({ showGuestCta }: { showGuestCta?: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
          Learn smarter,<br />remember more.
        </h1>
        <p className="text-base text-muted-foreground">
          Import, organise, and review everything you learn — courses, books, and videos.
        </p>
      </div>

      <ul className="space-y-5" role="list" aria-label="Key features">
        {VALUE_BULLETS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
              <Icon className="size-4 text-brand-soft-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      {showGuestCta && (
        <div className="pt-2">
          <Button
            variant="outline"
            asChild
            className="w-full sm:w-auto"
            aria-label="Try without signing up — explore as a guest"
          >
            <Link to="/try">Try without signing up →</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function MobileValueAccordion() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="mobile-value-panel"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground bg-muted/50 hover:bg-muted transition-colors min-h-[44px]"
      >
        Why Knowlune?
        {open ? <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />}
      </button>
      {open && (
        <div id="mobile-value-panel" className="px-4 pb-4 pt-2">
          <ul className="space-y-4" role="list">
            {VALUE_BULLETS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft">
                  <Icon className="size-3.5 text-brand-soft-foreground" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Skip nav */}
      <a
        href="#landing-auth"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-1 focus:text-sm focus:text-brand-foreground"
      >
        Skip to sign-in
      </a>

      {/* ── Desktop / Tablet (≥640px): side-by-side or stacked two-column ── */}
      <div className="hidden sm:flex min-h-screen">
        {/* Left — value prop */}
        <div className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-16 xl:px-24 bg-muted/30">
          <div className="max-w-md">
            <div className="mb-8">
              <Link to="/" aria-label="Knowlune home">
                <KnowluneLogo />
              </Link>
              <p className="mt-1 text-xs tracking-wide text-muted-foreground">Illuminate Your Path</p>
            </div>
            <ValueProp showGuestCta />
          </div>
        </div>

        {/* Right — auth form */}
        <div
          id="landing-auth"
          className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12"
        >
          <div className="w-full max-w-sm">
            <AuthCard idPrefix="auth-desktop" />
          </div>
        </div>
      </div>

      {/* ── Mobile (<640px): auth first, then accordion value prop, then guest CTA ── */}
      <div className="flex sm:hidden min-h-screen flex-col px-4 py-8 gap-6">
        <div className="flex flex-col items-center gap-1">
          <Link to="/" aria-label="Knowlune home">
            <KnowluneLogo />
          </Link>
          <p className="text-xs tracking-wide text-muted-foreground">Illuminate Your Path</p>
        </div>

        <div>
          <AuthCard idPrefix="auth-mobile" />
        </div>

        <MobileValueAccordion />

        <div className="text-center">
          <Button
            variant="ghost"
            asChild
            className="text-sm text-muted-foreground min-h-[44px]"
            aria-label="Try without signing up — explore as a guest"
          >
            <Link to="/try">Try without signing up →</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
