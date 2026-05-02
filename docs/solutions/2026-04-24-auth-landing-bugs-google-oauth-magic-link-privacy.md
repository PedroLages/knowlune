---
module: auth
tags: [auth, supabase, google-oauth, magic-link, cors, pkce, routing, privacy-policy]
problem_type: bug
date: 2026-04-24
---

# Fixing three Landing page auth bugs: Google 404, magic-link "network" error, privacy loop

## Problem

Three auth entry points on the Landing page (`/`) broke simultaneously:

1. **"Continue with Google"** redirected to Google, then returned to the app and
   rendered **"404 page not found"** instead of completing sign-in.
2. **Email sign-in / sign-up and magic link** always showed
   **"Unable to connect. Please check your internet connection and try again."**
   even when the backend was reachable.
3. **"Privacy Policy" / "Terms of Service"** links on Landing opened a new tab
   that looped back to the Landing page instead of rendering the legal content.

## Root causes

### Bug #1 — Google OAuth 404

`signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`
points Google/Supabase at `/`, which is wrapped by `RouteGuard`. Supabase v2
uses the **PKCE flow** by default and returns a `?code=<one-time-code>` query
parameter. The app had no dedicated route to call
`supabase.auth.exchangeCodeForSession(window.location.href)`. When Supabase or
Google appended `?error=access_denied` on failure, it hit no matching route and
rendered the NotFound page.

### Bug #2 — Generic "network" error masking CORS

`mapSupabaseError` collapsed any message containing `Failed to fetch` or
`NetworkError` into `NETWORK_ERROR_MESSAGE`. The self-hosted Supabase at
`https://supabase.pedrolages.net` has `ALLOWED_ORIGINS=http://localhost:5173`
only. Browser fetch from the production origin failed the CORS preflight,
which browsers surface as `TypeError: Failed to fetch` — the exact string the
mapper was looking for. Real Supabase errors (rate limits, validation) that
were thrown as exceptions also hit the bare `} catch {` and got collapsed.

### Bug #3 — Privacy link route race

Legal routes were defined as:

```tsx
{
  element: <LegalLayout />,   // no path on parent
  children: [
    { path: 'privacy', element: <PrivacyPolicy /> },
    { path: 'terms',   element: <TermsOfService /> },
  ],
}
```

The pathless parent made path resolution depend on tree-walk order. Combined
with `target="_blank"` triggering a cold SPA load where `RouteGuard` on `/`
sometimes wins the match, the new tab rendered `<Landing />`. Other call-sites
linked to `/legal/privacy` — which was **not routed at all** and fell through
to `RouteGuard`, which renders `<Landing />` for anonymous users.

## Fix

### Code changes

1. **Hoist legal routes** to explicit top-level paths (
   [src/app/routes.tsx](../../src/app/routes.tsx)):
   ```tsx
   { path: '/privacy', element: <LegalLayout />, children: [{ index: true, element: <PrivacyPolicy /> }] }
   { path: '/terms',   element: <LegalLayout />, children: [{ index: true, element: <TermsOfService /> }] }
   { path: '/legal/privacy', element: <Navigate to="/privacy" replace /> }
   { path: '/legal/terms',   element: <Navigate to="/terms"   replace /> }
   ```
2. **Add `/auth/callback` route** outside `RouteGuard`, pointing to a new
   [AuthCallback](../../src/app/pages/AuthCallback.tsx) component that calls
   `supabase.auth.exchangeCodeForSession(...)` on PKCE returns, cleans the
   hash for implicit returns, and navigates to `/courses` on success or
   `/?authError=<msg>` on failure.
3. **Update `signInWithGoogle`** in
   [src/stores/useAuthStore.ts](../../src/stores/useAuthStore.ts) to pass
   `redirectTo: ${window.location.origin}/auth/callback`. Same for
   `signInWithOtp` (magic link).
4. **Sharpen `mapSupabaseError`** — add rate-limit + "Signups not allowed"
   mappings; route exception paths through `handleAuthException(err)` which
   only returns the generic network message for actual network failures
   (fetch rejection, TypeError) and surfaces everything else verbatim.
   Dev-only `console.error` before mapping so real messages are visible
   during local dev.
5. **Add `authError` banner** on
   [src/app/pages/Landing.tsx](../../src/app/pages/Landing.tsx) — reads
   `?authError=` from the URL on mount, displays inline, then strips the
   param so a reload doesn't re-show it.
6. **Normalize link paths** — six call-sites that pointed at `/legal/privacy`
   changed to `/privacy`.

### Manual config (required, not in code)

The code fixes are necessary but **not sufficient**. You must also:

- [ ] **Self-hosted Supabase `.env`** — set `ALLOWED_ORIGINS` to a
  comma-separated allowlist including every frontend origin:
  ```
  ALLOWED_ORIGINS=http://localhost:5173,https://knowlune.pedrolages.net
  ```
  Restart the Supabase stack after changing. Without this, CORS preflight
  fails and the UI falls back to the (now-accurate) network error message.
- [ ] **Supabase → Authentication → URL Configuration → Redirect URLs** —
  add every variation of the callback URL:
  ```
  http://localhost:5173/auth/callback
  https://knowlune.pedrolages.net/auth/callback
  ```
  The `Site URL` should be the canonical production origin
  (`https://knowlune.pedrolages.net`).
- [ ] **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client**
  — the Supabase-issued redirect URI
  (`https://supabase.pedrolages.net/auth/v1/callback`) must be on the
  allowlist. The `/auth/callback` on your frontend is where Supabase
  redirects **after** it finishes its own callback — it is not the URI
  Google needs.

## Verification

1. `npm run dev`; kill any stale server first: `lsof -ti:5173 | xargs kill`.
2. Landing `/`: click **Privacy Policy** (new tab) → renders legal page. Same
   for **Terms of Service**. Direct nav to `/legal/privacy` redirects to
   `/privacy`.
3. Submit magic-link with a bogus origin (CORS denied) → inline form error
   still shows the generic network message (accurate now). Fix
   `ALLOWED_ORIGINS`, retry → success toast. Mock the API to return 429 →
   "Too many attempts" surfaces, not the network message.
4. Click **Continue with Google** → Google consent → return through
   `/auth/callback` (brief skeleton) → land on `/courses`. Deny consent →
   return to `/` with inline **AlertCircle** banner showing the reason.
5. `npm run test:unit -- useAuthStore` (once tests land); full E2E in
   `tests/e2e/auth-landing.spec.ts`.

## Prior art

- [2026-04-23-zombie-supabase-session.md](2026-04-23-zombie-supabase-session.md)
  — context for why Supabase session state is tricky.
- Supabase PKCE docs:
  https://supabase.com/docs/guides/auth/server-side/oauth-with-pkce-flow-for-ssr

## Lessons

- When adopting Supabase-JS v2, **always add a dedicated `/auth/callback`
  route** — the default PKCE flow needs somewhere to exchange `?code=` for a
  session. Relying on `onAuthStateChange` + hash cleanup is only sufficient
  for the legacy implicit flow.
- The generic "network error" message is a trap. If `err instanceof TypeError`
  with message `Failed to fetch`, the most likely cause is CORS, not
  connectivity. Preserve that distinction in the console even when the UI
  stays generic.
- Pathless parent routes are fine when the parent **is** a layout that will
  always wrap its children, but only use them when the route tree is
  otherwise unambiguous. With `RouteGuard` on `/`, explicit top-level paths
  for public pages prevent race conditions on cold load.
