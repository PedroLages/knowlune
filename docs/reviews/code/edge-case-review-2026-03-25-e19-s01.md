## Edge Case Review — E19-S01 (2026-03-25)

### Unhandled Edge Cases

**src/lib/auth/supabase.ts:12** — `createClient called with empty strings when env vars are missing`
> Consequence: Supabase SDK makes requests to empty URL, throws cryptic runtime errors
> Guard: `export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null`

**src/stores/useAuthStore.ts:57-62** — `signUp/signIn called while loading is already true (double-submit race)`
> Consequence: Concurrent auth requests corrupt loading/error state
> Guard: `if (get().loading) return { error: 'Request already in progress' }`

**src/stores/useAuthStore.ts:57-62** — `supabase.auth.signUp throws an exception instead of returning error`
> Consequence: Unhandled rejection; loading state stuck at true permanently
> Guard: `try { const { error } = await supabase.auth.signUp(...) } catch (e) { set({ loading: false, error: mapSupabaseError(e.message ?? 'Unknown error') }) }`

**src/stores/useAuthStore.ts:67-77** — `signInWithPassword throws (network disconnect mid-request)`
> Consequence: Loading spinner stuck forever, form inputs permanently disabled
> Guard: `Wrap await in try/catch, set loading: false in catch block`

**src/stores/useAuthStore.ts:79-89** — `signInWithOtp throws exception instead of returning error object`
> Consequence: Magic link form freezes with spinner, no error shown
> Guard: `Wrap await in try/catch with identical error mapping`

**src/stores/useAuthStore.ts:91-104** — `signInWithOAuth throws (e.g., popup blocked or CSP violation)`
> Consequence: Google button stuck in loading state with no recovery path
> Guard: `try { ... } catch (e) { set({ loading: false, error: NETWORK_ERROR_MESSAGE }); return { error: mapped } }`

**src/stores/useAuthStore.ts:106-116** — `signOut throws exception (e.g., network error during token revocation)`
> Consequence: Sign out button stuck loading; user cannot retry or use app
> Guard: `Wrap in try/catch; clear user/session even on error to avoid stuck-authenticated state`

**src/stores/useAuthStore.ts:91-104** — `Google OAuth redirect succeeds but user navigates back without completing`
> Consequence: Loading state stuck true after incomplete OAuth flow, button permanently disabled
> Guard: `Reset loading: false in onAuthStateChange handler or on component mount after redirect`

**src/app/components/auth/EmailPasswordForm.tsx:26-33** — `Email like 'user@' or '.user@x' passes validation (has @ and . but is invalid)`
> Consequence: Invalid emails sent to Supabase, wasting API calls and confusing error messages
> Guard: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)`

**src/app/components/auth/EmailPasswordForm.tsx:14-20** — `User switches mode from sign-up to sign-in while confirmPassword has stale value`
> Consequence: Stale confirmPassword state leaks across mode switches, confusing UX
> Guard: `useEffect(() => { setConfirmPassword(''); setValidationError(null) }, [mode])`

**src/app/components/auth/MagicLinkForm.tsx:43-50** — `handleResend called while loading is true from prior request`
> Consequence: Duplicate magic link requests fired simultaneously
> Guard: `if (loading) return; before calling signInWithMagicLink in handleResend`

**src/app/components/auth/MagicLinkForm.tsx:22-25** — `Component unmounts while sent=true, then remounts (dialog reopen)`
> Consequence: Re-opening dialog shows stale 'sent' confirmation for a different session
> Guard: `Reset sent/cooldown state when dialog opens via useEffect on parent open prop`

**src/app/components/auth/GoogleAuthButton.tsx:7** — `All three auth components share single global loading/error from useAuthStore`
> Consequence: Triggering Google OAuth shows loading spinner on Email tab too; errors leak across tabs
> Guard: `Use component-local loading state or scope store error to action type`

**src/app/components/auth/AuthDialog.tsx:33-35** — `Tabs use defaultValue='email' (uncontrolled) -- tab does not reset when dialog reopens`
> Consequence: Reopening dialog shows previously selected tab instead of Email
> Guard: `Use controlled Tabs with value state, reset to 'email' when open changes to true`

**src/app/pages/Settings.tsx:sign-out-handler** — `Sign out button clicked multiple times rapidly before first request completes`
> Consequence: Multiple signOut calls race, potentially showing duplicate toasts
> Guard: `disabled={loading} using useAuthStore loading state on the Sign Out button`

**src/app/App.tsx:auth-listener** — `onAuthStateChange fires with TOKEN_REFRESHED but session is null (expired refresh token)`
> Consequence: User silently logged out without notification; UI shows stale authenticated state briefly
> Guard: `Check event type in listener: if (event === 'TOKEN_REFRESHED' && !session) notify user`

**src/stores/useAuthStore.ts:35-51** — `Supabase returns error with empty message string`
> Consequence: Empty string displayed in error alert, confusing blank error box
> Guard: `if (!message) return 'An unexpected error occurred. Please try again.'`

---
**Total:** 17 unhandled edge cases found.
