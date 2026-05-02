---
module: auth
tags: [auth, supabase, zombie-session, localstorage, 403, user_not_found]
problem_type: bug
date: 2026-04-23
---

# Clearing a zombie Supabase session

## Problem

A user's browser can hold a valid-looking Supabase JWT whose `sub` (user UUID)
no longer exists in `auth.users` — e.g. after a Supabase instance was rebuilt,
restored from a non-matching backup, or had user rows deleted behind the app's
back. Symptoms:

- `supabase.auth.getUser()` returns **403 `user_not_found`**.
- `useAuthStore.user` is populated (from stale session) so the UI renders as
  "signed in", but every authenticated API call fails.
- Vault writes (ABS API key, AI provider keys) silently fail.
- Sync requests 403.
- The navbar may still show an avatar while the email/full_name don't load.

## Root Cause

Supabase persists the session (access + refresh tokens) in localStorage under
an `sb-<project-ref>-auth-token` key. The refresh token is valid enough to
mint a fresh access token, but when the server tries to hydrate the user via
`SELECT * FROM auth.users WHERE id = <sub>` the row is missing. The result is
a silent split-brain between the client ("I'm signed in") and the server
("who?").

## Solution

### One-shot: clear the session in the affected browser

Open DevTools → Console on the site (e.g. `http://localhost:5173` or
`https://knowlune.pedrolages.net`) and paste:

```javascript
(async () => {
  // 1. Supabase session + any Supabase-owned localStorage.
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-') || k.toLowerCase().includes('supabase'))
    .forEach(k => {
      console.log('[zombie-session] removing', k)
      localStorage.removeItem(k)
    })
  // 2. Force a clean sign-out so the in-memory auth store resets.
  try {
    const mod = await import('/src/lib/supabase.ts')
    await mod.supabase?.auth?.signOut({ scope: 'local' })
  } catch (_) {
    // best-effort; the localStorage purge above is the authoritative reset
  }
  // 3. Reload so Zustand auth store re-initialises from a blank slate.
  location.reload()
})()
```

After reload, sign in again (Google / email / magic link). `getUser()` should
return 200 with a populated `user_metadata.avatar_url` (or `picture`).

### Verify the fix

```javascript
// DevTools console on the signed-in page:
const { data } = await (await import('/src/lib/supabase.ts')).supabase.auth.getUser()
console.log(data.user?.id, data.user?.user_metadata?.avatar_url)
// Expected: a real UUID + an https://lh3.googleusercontent.com/... URL for Google sign-in.
```

## Why not auto-heal?

Detecting 403 `user_not_found` and triggering an automatic sign-out is
tempting, but false positives (transient 403s from CDN / Traefik rate limits,
edge RLS quirks) could log users out of an otherwise valid session. A durable
auto-heal should require: (a) 403 specifically from the `/auth/v1/user`
endpoint, (b) `error.code === 'user_not_found'` or identical message, and (c)
be bracketed by a user-visible toast explaining the sign-out. That
engineering belongs in a dedicated task, not this fix.

## Related

- [2026-04-23-titan-supabase-migration-apply.md](2026-04-23-titan-supabase-migration-apply.md) —
  the companion infra fix applied the same day.
- [src/stores/useAuthStore.ts](../../src/stores/useAuthStore.ts) — the Zustand
  store driving UI auth state.
- [src/lib/settings.ts](../../src/lib/settings.ts) — `hydrateSettingsFromSupabase`
  reads user_metadata → profilePhotoUrl; blocked when the session can't load a user.
