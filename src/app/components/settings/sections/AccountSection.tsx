import { LogOut, Shield, Trash2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { SubscriptionCard } from '@/app/components/settings/SubscriptionCard'
import { AccountDeletion } from '@/app/components/settings/AccountDeletion'
import { ChangePassword } from '@/app/components/settings/ChangePassword'
import { ChangeEmail } from '@/app/components/settings/ChangeEmail'
import { MyDataSummary } from '@/app/components/settings/MyDataSummary'
import { AuthDialog } from '@/app/components/auth/AuthDialog'
import { useSettingsPage } from '@/app/components/settings/SettingsPageContext'
import { toastSuccess, toastError } from '@/lib/toastHelpers'

export function AccountSection() {
  const {
    user,
    authSignOut,
    authDialogOpen,
    setAuthDialogOpen,
    authDialogMode,
    setAuthDialogMode,
    checkoutStatus,
  } = useSettingsPage()

  return (
    <div className="space-y-8">
      {/* Sign In / Sign Up (when not logged in) */}
      {!user && (
        <section>
          <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Get Started
          </h4>
          <div className="bg-card rounded-xl shadow-sm overflow-hidden p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center size-10 rounded-lg bg-brand-soft">
                <Shield className="size-5 text-brand" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">Sign in to access premium features</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sync your progress, unlock achievements, and more
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="brand"
                className="min-h-[44px]"
                onClick={() => {
                  setAuthDialogMode('sign-up')
                  setAuthDialogOpen(true)
                }}
              >
                Sign Up
              </Button>
              <Button
                variant="brand-outline"
                className="min-h-[44px]"
                onClick={() => {
                  setAuthDialogMode('sign-in')
                  setAuthDialogOpen(true)
                }}
              >
                Sign In
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Account Info (when logged in) */}
      {user && (
        <section>
          <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Account
          </h4>
          <div
            className="bg-card rounded-xl shadow-sm overflow-hidden"
            data-testid="account-section"
          >
            {/* User row */}
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center size-10 rounded-lg bg-brand-soft">
                  <Shield className="size-5 text-brand" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Signed in via {user.app_metadata?.provider ?? 'email'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 min-h-[44px]"
                onClick={async () => {
                  const result = await authSignOut()
                  if (result.error) {
                    toastError.saveFailed(result.error)
                  } else {
                    toastSuccess.saved('Signed out successfully')
                  }
                }}
              >
                <LogOut className="size-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Subscription */}
      {user && (
        <section>
          <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Subscription
          </h4>
          <SubscriptionCard checkoutStatus={checkoutStatus} />
        </section>
      )}

      {/* Sign-in & Security */}
      {user && user.app_metadata?.provider === 'email' && (
        <section>
          <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Security
          </h4>
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            {/* Change Password */}
            <div className="p-4">
              <ChangePassword />
            </div>
            <div className="h-px mx-4 bg-border/50" />
            {/* Change Email */}
            <div className="p-4">
              <ChangeEmail />
            </div>
          </div>
        </section>
      )}

      {/* My Data */}
      {user && (
        <section>
          <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Your Data
          </h4>
          <MyDataSummary />
        </section>
      )}

      {/* Danger Zone */}
      {user && (
        <section>
          <h4 className="px-1 text-xs font-bold text-destructive/60 uppercase tracking-widest mb-3">
            Danger Zone
          </h4>
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 flex justify-between items-center hover:bg-destructive/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center size-10 rounded-lg bg-destructive/10">
                  <Trash2 className="size-5 text-destructive" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-destructive">Delete Account</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
              </div>
              <AccountDeletion />
            </div>
          </div>
        </section>
      )}

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultMode={authDialogMode}
      />
    </div>
  )
}
