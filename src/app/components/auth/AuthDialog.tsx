import { useState, useEffect } from 'react'
import { Mail, Link2, Chrome } from 'lucide-react'
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
              <Chrome className="size-4" aria-hidden="true" />
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
