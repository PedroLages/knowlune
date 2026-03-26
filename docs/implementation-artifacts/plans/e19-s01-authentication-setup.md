# E19-S01: Authentication Setup — Implementation Plan

## Context

Knowlune needs user authentication to enable the premium/entitlement system (Epic 19). This is the foundation story — all 8 subsequent stories depend on it. Pedro runs a self-hosted Supabase instance on his Unraid server (already configured in `.env` at `http://127.0.0.1:54321`). The architecture ADR prescribes Supabase Auth with email/password, magic link, and Google OAuth. A detailed UX specification exists at `docs/planning-artifacts/epic-19-ux-specification.md`.

**Scope for E19-S01:** All 3 auth methods — Email/Password, Magic Link, and Google OAuth. This delivers the complete auth experience from the UX spec.

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/auth/supabase.ts` | Supabase client singleton |
| `src/stores/useAuthStore.ts` | Zustand auth state (user, session, loading, error, actions) |
| `src/app/components/auth/AuthDialog.tsx` | Dialog/Sheet wrapper with sign-up/sign-in mode toggle |
| `src/app/components/auth/EmailPasswordForm.tsx` | Email + password form with validation |
| `src/app/components/auth/MagicLinkForm.tsx` | Magic link (passwordless) email form |
| `src/app/components/auth/GoogleAuthButton.tsx` | Google OAuth sign-in button |

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `@supabase/supabase-js` dependency |
| `src/app/App.tsx` | Add auth session listener (`onAuthStateChange`) |
| `src/app/pages/Settings.tsx` | Add Account card section (sign-in/sign-out/email display) |

## Implementation Steps

### Step 1: Install Supabase SDK

```bash
npm install @supabase/supabase-js
```

Env vars already configured in `.env`:
- `VITE_SUPABASE_URL=http://127.0.0.1:54321`
- `VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`

**Commit: `chore(E19-S01): add @supabase/supabase-js dependency`**

### Step 2: Create Supabase Client (`src/lib/auth/supabase.ts`)

Singleton pattern matching the architecture ADR:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 3: Create Auth Store (`src/stores/useAuthStore.ts`)

Follow the `useOnboardingStore` pattern (manual localStorage persistence via `create()`):

```typescript
interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  initialized: boolean  // true after first session check completes
}

interface AuthActions {
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  setSession: (session: Session | null) => void
  clearError: () => void
}
```

Key behaviors:
- `signUp` calls `supabase.auth.signUp()`, returns `{ error }` on failure
- `signIn` calls `supabase.auth.signInWithPassword()`, returns `{ error }` on failure
- `signOut` calls `supabase.auth.signOut()`, clears user/session state
- `setSession` is called by the `onAuthStateChange` listener (Step 5)
- Session persistence handled by Supabase SDK (localStorage) — no manual persist needed
- `initialized` flag prevents flash-of-unauthenticated-state on app load

### Step 4: Create Auth Dialog Components

#### `AuthDialog.tsx` — Dialog wrapper

- Uses shadcn `Dialog` on desktop (≥640px), shadcn `Sheet` with `side="bottom"` on mobile (<640px)
- Props: `open`, `onOpenChange`, `defaultMode?: 'sign-in' | 'sign-up'`
- Internal state: `mode` toggles between sign-in and sign-up
- Layout per UX spec: Knowlune logo, heading, tabs (Email tab active, Magic Link + Google tabs show "Coming soon"), mode toggle link, legal links
- `rounded-[24px]`, `max-w-md`, `p-6`
- Per UX spec: use shadcn `Tabs` with 3 triggers — all 3 tabs are fully functional.

#### `EmailPasswordForm.tsx` — Form component

- Props: `mode: 'sign-in' | 'sign-up'`, `onSuccess: () => void`
- Fields: email (`Input type="email"`), password (`Input type="password"`), confirm password (sign-up only)
- Client-side validation: email format, password ≥8 chars (match Supabase default). UX spec says 1 uppercase + 1 number but Supabase default is just 8 chars — **use Supabase defaults** to avoid client/server mismatch.
- Loading state: button disabled + `Loader2 animate-spin` + text "Signing in..." / "Creating account..."
- Error state: inline `text-destructive` below form, `bg-destructive/10 rounded-xl p-3` alert for server errors
- On success: call `onSuccess()` → dialog closes, `toastSuccess.saved('Signed in successfully')` / `toastSuccess.saved('Account created successfully')`
- Duplicate email: Supabase returns specific error → display "This email is already registered. Try signing in instead."

#### `MagicLinkForm.tsx` — Passwordless email form

- Props: `onSuccess: () => void`
- Single email field + "Send Magic Link" button (`variant="brand"`, full width)
- Calls `supabase.auth.signInWithOtp({ email })` — sends magic link email
- On success: replace form with `CheckCircle` icon + "Check your email for a sign-in link" (`text-success`)
- Resend link: 60-second countdown timer, button disabled until timer expires, `text-muted-foreground`
- Error state: inline destructive alert for invalid email or server errors

#### `GoogleAuthButton.tsx` — OAuth sign-in

- Single button: `variant="outline"`, full width, `h-12`
- Inline Google "G" SVG icon + "Continue with Google" text
- Calls `supabase.auth.signInWithOAuth({ provider: 'google' })` — redirects to Google, then back
- Loading state: button disabled during redirect
- Note: Google OAuth must be configured in the Supabase dashboard (provider enabled + redirect URL set). If not configured, the button should show a helpful error.

### Step 5: Update Auth Store for All Methods

Add to `useAuthStore`:
```typescript
signInWithMagicLink: (email: string) => Promise<{ error?: string }>
signInWithGoogle: () => Promise<{ error?: string }>
```

- `signInWithMagicLink` calls `supabase.auth.signInWithOtp({ email })`
- `signInWithGoogle` calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`

### Step 6: Add Auth Listener to App.tsx

Add a `useEffect` in `App.tsx` that subscribes to `supabase.auth.onAuthStateChange()`:

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      useAuthStore.getState().setSession(session)
    }
  )
  return () => subscription.unsubscribe()
}, [])
```

This handles:
- Session restoration on app launch (AC: loading states)
- Token refresh
- Sign-out from another tab

Non-blocking: core features render immediately via `<RouterProvider>`. Auth state resolves in background.

### Step 7: Add Account Section to Settings.tsx

Add a new `Card` section following the existing pattern (`CardHeader` with icon in `rounded-full bg-brand-soft p-2`):

**When not authenticated:**
- Icon: `Shield` from lucide
- Title: "Account"
- Description: "Sign in to access premium features"
- Two buttons: "Sign Up" (`variant="brand"`), "Sign In" (`variant="brand-outline"`)
- Clicking either opens `AuthDialog` with appropriate mode

**When authenticated:**
- Show user email
- "Sign Out" button (`variant="outline"`)
- Sign-out calls `useAuthStore.getState().signOut()`, shows toast

**Commit: `feat(E19-S01): add auth dialog, store, and settings account section`**

### Step 8: Verify Core Features Unaffected (AC1)

- No auth guards on any routes in `routes.tsx`
- No conditional rendering based on auth state in core pages
- All existing E2E tests should continue passing
- Run `npm run build` to verify no type errors

### Step 9: Update ATDD Tests

Update `tests/e2e/story-e19-s01.spec.ts` to be more specific now that components exist. The existing ATDD tests should start passing for AC1 (core features without auth) and AC5 (no sign-out when unauthenticated).

**Commit: `test(E19-S01): update ATDD tests for auth components`**

## Design Decisions

1. **Dialog vs Page**: Auth forms appear as Dialog overlays (per UX spec), not separate routes. Keeps user in context.
2. **No manual session persistence**: Supabase SDK handles localStorage session automatically. Our Zustand store is reactive state only.
3. **Password validation**: Use Supabase defaults (8 chars minimum) rather than the UX spec's stricter rules (uppercase + number) to avoid client/server mismatch. Can tighten later via Supabase dashboard.
4. **All 3 auth methods**: Email/Password, Magic Link, and Google OAuth all implemented per UX spec. Google OAuth requires Supabase dashboard configuration (provider enabled + redirect URL).
5. **`initialized` flag**: Prevents flash-of-unauthenticated state. Core features load immediately; auth state resolves in background.

## Prerequisites (Supabase Dashboard)

Before Google OAuth works, configure in Supabase dashboard:
1. **Authentication > Providers > Google**: Enable and add Google OAuth credentials (client ID + secret from Google Cloud Console)
2. **Authentication > URL Configuration**: Add `http://localhost:5173` as a redirect URL
3. Magic Link: Supabase sends emails via built-in email service by default (works out of the box for development)

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations
3. `npx tsc --noEmit` — type check passes
4. Manual testing:
   - Open app → core features work (no auth prompts)
   - Settings → Account section visible with Sign Up / Sign In buttons
   - Click Sign Up → AuthDialog opens with email/password form
   - Submit valid email/password → account created, dialog closes, toast shown
   - Settings → shows email + Sign Out button
   - Click Sign Out → token removed, core features continue
   - Click Sign In → AuthDialog opens in sign-in mode
   - Submit credentials → authenticated, redirected back
5. E2E tests: `npx playwright test tests/e2e/story-e19-s01.spec.ts`
