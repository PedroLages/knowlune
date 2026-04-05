import { LogOut, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
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
    <div className="space-y-6">
      {/* Account */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              {user ? (
                <LogOut className="size-5 text-brand" aria-hidden="true" />
              ) : (
                <Shield className="size-5 text-brand" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-display leading-none">Account</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {user ? `Signed in as ${user.email}` : 'Sign in to access premium features'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6" data-testid="account-section">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Signed in via {user.app_metadata?.provider ?? 'email'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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

              {user.app_metadata?.provider === 'email' && (
                <>
                  <Separator />
                  <ChangePassword />
                  <Separator />
                  <ChangeEmail />
                </>
              )}

              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-destructive">Delete Account</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <AccountDeletion />
              </div>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultMode={authDialogMode}
      />

      {user && <SubscriptionCard checkoutStatus={checkoutStatus} />}
      {user && <MyDataSummary />}
    </div>
  )
}
