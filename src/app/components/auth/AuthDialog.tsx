import { useState, useEffect } from 'react'
import { Mail, Link2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { useAuthStore } from '@/stores/useAuthStore'
import { EmailPasswordForm } from './EmailPasswordForm'
import { MagicLinkForm } from './MagicLinkForm'
import { GoogleAuthButton } from './GoogleAuthButton'

function GoogleTabIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export type AuthMode = 'sign-in' | 'sign-up'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMode?: AuthMode
}

export function AuthDialog({ open, onOpenChange, defaultMode = 'sign-in' }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const clearError = useAuthStore((s) => s.clearError)

  // Sync mode when defaultMode changes (e.g., clicking Sign Up vs Sign In)
  useEffect(() => {
    setMode(defaultMode)
  }, [defaultMode])

  // Clear errors when switching modes or closing
  useEffect(() => {
    clearError()
  }, [mode, open, clearError])

  function handleSuccess() {
    onOpenChange(false)
  }

  function toggleMode() {
    setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'))
  }

  const title = mode === 'sign-in' ? 'Sign in to Knowlune' : 'Create your Knowlune account'
  const toggleText =
    mode === 'sign-in'
      ? "Don't have an account?"
      : 'Already have an account?'
  const toggleAction = mode === 'sign-in' ? 'Sign Up' : 'Sign In'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-[24px] sm:max-w-md p-6"
        aria-label={title}
      >
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 rounded-full bg-brand-soft p-3">
            <Mail className="size-6 text-brand" aria-hidden="true" />
          </div>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>
            {mode === 'sign-in'
              ? 'Welcome back! Sign in to access premium features.'
              : 'Create an account to unlock premium features.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="email" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="size-4" aria-hidden="true" />
              Email
            </TabsTrigger>
            <TabsTrigger value="magic-link" className="gap-1.5">
              <Link2 className="size-4" aria-hidden="true" />
              Magic Link
            </TabsTrigger>
            <TabsTrigger value="google" className="gap-1.5">
              <GoogleTabIcon />
              Google
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-4">
            <EmailPasswordForm mode={mode} onSuccess={handleSuccess} />
          </TabsContent>

          <TabsContent value="magic-link" className="mt-4">
            <MagicLinkForm />
          </TabsContent>

          <TabsContent value="google" className="mt-4">
            <GoogleAuthButton />
          </TabsContent>
        </Tabs>

        {/* Mode toggle */}
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {toggleText}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-medium text-brand hover:underline"
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
            className="text-brand hover:underline"
          >
            Privacy Policy
          </a>{' '}
          and{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            Terms of Service
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
