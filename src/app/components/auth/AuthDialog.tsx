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
import { EmailPasswordForm } from './EmailPasswordForm'
import { MagicLinkForm } from './MagicLinkForm'
import { GoogleAuthButton } from './GoogleAuthButton'
import { GoogleIcon } from './GoogleIcon'

export type AuthMode = 'sign-in' | 'sign-up'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMode?: AuthMode
}

export function AuthDialog({ open, onOpenChange, defaultMode = 'sign-in' }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [activeTab, setActiveTab] = useState('email')
  // Incremented each time dialog opens — child forms reset their state via this key
  const [resetKey, setResetKey] = useState(0)

  // Sync mode when defaultMode changes (e.g., clicking Sign Up vs Sign In)
  useEffect(() => {
    setMode(defaultMode)
  }, [defaultMode])

  // Reset tabs and form state when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab('email')
      setResetKey(k => k + 1)
    }
  }, [open])

  function handleSuccess() {
    onOpenChange(false)
  }

  function toggleMode() {
    setMode(m => (m === 'sign-in' ? 'sign-up' : 'sign-in'))
  }

  const title = mode === 'sign-in' ? 'Sign in to Knowlune' : 'Create your Knowlune account'
  const toggleText = mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'
  const toggleAction = mode === 'sign-in' ? 'Sign Up' : 'Sign In'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md p-6">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList variant="default" className="w-full min-h-[44px]">
            <TabsTrigger variant="default" value="email" className="gap-1.5">
              <Mail className="size-4" aria-hidden="true" />
              Email
            </TabsTrigger>
            <TabsTrigger variant="default" value="magic-link" className="gap-1.5">
              <Link2 className="size-4" aria-hidden="true" />
              Magic Link
            </TabsTrigger>
            <TabsTrigger variant="default" value="google" className="gap-1.5">
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
        <div className="mt-4 text-center text-sm text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  )
}
