---
story_id: E43-S08
story_name: "Auth UX Polish"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 43.8: Auth UX Polish

## Story

As a learner,
I want the app to correctly reflect my authenticated state after Google sign-in,
so that I see my avatar, name, and account info without confusion or broken navigation.

## Acceptance Criteria

### AC1: Header updates after Google OAuth login

**Given** I sign in via Google OAuth on the `/login` page
**When** the OAuth redirect completes and the app loads
**Then** the header shows my avatar dropdown (not the "Sign In" button)
**And** the dropdown displays my name and email
**And** the Sign Out option works correctly

### AC2: Settings reflects logged-in state

**Given** I am signed in via Google OAuth
**When** I navigate to the Settings page
**Then** the Account section shows "Signed in as {email}"
**And** the Sign Out button is visible
**And** the "Sign In / Sign Up" prompt is NOT shown

### AC3: Google avatar displayed in header and Settings

**Given** I sign in via Google OAuth (which provides `avatar_url` in `user_metadata`)
**When** the app renders the header avatar
**Then** my Google profile photo is shown (not just initials)
**And** the Settings profile section also shows the Google avatar as a fallback when no custom photo is uploaded

### AC4: Login page has "Back to app" navigation

**Given** I am on the `/login` page (not yet authenticated)
**When** I want to return to the app without signing in
**Then** a "Back to app" link or clickable logo navigates me to `/`

### AC5: Login page redirects authenticated users

**Given** I am already signed in
**When** I navigate to `/login` (via URL bar or stale link)
**Then** I am redirected to `/` automatically
**And** the login form is never rendered (no flash of login UI)

## Tasks / Subtasks

- [ ] Task 0: Rename `profilePhotoDataUrl` → `profilePhotoUrl` (AC: 3)
  - [ ] 0.1 Rename field in `AppSettings` interface at `src/lib/settings.ts:28`. Update JSDoc to: "Profile photo URL — data URL (uploads), object URL (temp), or HTTPS URL (Google OAuth)"
  - [ ] 0.2 Rename in `defaults` object at `src/lib/settings.ts:59`
  - [ ] 0.3 Rename all 7 occurrences in `src/app/pages/Settings.tsx`
  - [ ] 0.4 Rename all 2 occurrences in `src/app/components/Layout.tsx`
  - [ ] 0.5 Rename all 3 occurrences in `src/lib/__tests__/settings.test.ts` (including test description)
  - [ ] 0.6 Run `npm run build` to verify no type errors from rename

- [ ] Task 1: Diagnose and fix auth state not updating after OAuth redirect (AC: 1, 2, 5)
  - [ ] 1.1 **Diagnose first**: Add temporary `console.log('[auth]', event, session?.user?.email)` in the `onAuthStateChange` callback in `useAuthLifecycle.ts`. Perform a Google OAuth login and check: does `INITIAL_SESSION` or `SIGNED_IN` fire? Does it contain the user session? This determines whether the fix is the `getSession()` fallback or something else (e.g., redirect URL mismatch).
  - [ ] 1.2 If `INITIAL_SESSION` fires with a valid session but the UI doesn't update: the bug is in store reactivity or component subscription — investigate Layout's `useAuthStore` selector.
  - [ ] 1.3 If no auth event fires after redirect: check that the OAuth callback URL lands on `localhost:5173` (not the Supabase SITE_URL). Verify `redirectTo: window.location.origin` in `signInWithGoogle()` (useAuthStore.ts:112) resolves correctly.
  - [ ] 1.4 Add `let ignore = false` at the start of the useEffect body. Guard the `onAuthStateChange` callback with `if (ignore) return` to prevent state updates after unmount.
  - [ ] 1.5 Add `supabase.auth.getSession()` call AFTER the `onAuthStateChange` subscription as a safety net (critical ordering: listener first, then getSession). Use `.then()` — do NOT make the useEffect callback async. Guard with `if (ignore) return` inside the `.then()` callback.
  - [ ] 1.6 In the getSession callback, call `setSession(session)` and `hydrateSettingsFromSupabase()` if session exists — same logic as the `SIGNED_IN`/`INITIAL_SESSION` handler. Note: `hydrateSettingsFromSupabase()` is idempotent (only overwrites defaults) so double-calls from both INITIAL_SESSION and getSession are safe.
  - [ ] 1.7 Add OAuth hash fragment cleanup: `if (window.location.hash.includes('access_token')) { window.history.replaceState(null, '', window.location.pathname + window.location.search) }` — Supabase's built-in cleanup is unreliable across frameworks.
  - [ ] 1.8 Update cleanup function: `return () => { ignore = true; subscription.unsubscribe() }`
  - [ ] 1.9 Remove the diagnostic `console.log` before committing.
  - [ ] 1.10 Test: after Google OAuth, `useAuthStore.getState().user` is non-null and Layout shows avatar dropdown

- [ ] Task 2: Add Google avatar domain to CSP (AC: 3) — BLOCKER, do this before Task 3
  - [ ] 2.1 In `index.html:24`, add `https://*.googleusercontent.com` to `img-src` directive
  - [ ] 2.2 In `vite.config.ts:437`, add `https://*.googleusercontent.com` to `img-src` directive
  - [ ] 2.3 **Dual CSP note**: Both `index.html` (meta tag) and `vite.config.ts` (dev server header) define CSP. The most restrictive union wins. Both must be updated — missing one silently blocks images.
  - [ ] 2.4 Verify no other CSP violations in browser console after Google sign-in

- [ ] Task 3: Map Google OAuth metadata to app settings (AC: 3)
  - [ ] 3.1 Extend `hydrateSettingsFromSupabase()` in `src/lib/settings.ts` to map Google's `full_name` → `displayName` (when localStorage at default "Student" AND no `displayName` key in metadata)
  - [ ] 3.2 Extend to map `avatar_url` → `profilePhotoUrl` (when no custom photo uploaded). Fall back to `picture` field if `avatar_url` is missing (both are Google-provided, `picture` is a duplicate).
  - [ ] 3.3 **Protocol guard**: Only accept `avatar_url` values starting with `https://`. Reject `http://`, `javascript:`, `data:`, or any other protocol to prevent URL injection.
  - [ ] 3.4 Guard all metadata reads with typeof checks — `avatar_url` and `full_name` are only present for OAuth, not email auth
  - [ ] 3.5 Handle precedence: custom uploaded photo (data: URL) > Google avatar (https: URL) > initials fallback

- [ ] Task 4: Fix Layout.tsx avatar rendering (AC: 3)
  - [ ] 4.1 **Fix ternary bug**: Replace the conditional ternary at Layout.tsx:526-537 (which renders AvatarImage OR AvatarFallback) with both as siblings — the correct Radix Avatar pattern. This matches the pattern already used in `avatar-upload-zone.tsx:111-116`. Without this fix, a failed external URL shows an empty broken avatar with no initials fallback.
  - [ ] 4.2 **Add `referrerPolicy="no-referrer"`** on `<AvatarImage>` — Google CDN returns 403 when `Referer` header is present. The app sets `Referrer-Policy: strict-origin-when-cross-origin` in `vite.config.ts:426`. The `...props` spread in `AvatarImage` (avatar.tsx:23) passes this through to the underlying `<img>`.
  - [ ] 4.3 Verify `AvatarUploadZone` in Settings already uses the correct Radix sibling pattern at `avatar-upload-zone.tsx:111-116` and accepts HTTPS URLs via its `currentAvatar: string | null` prop — no changes needed there.

- [ ] Task 5: Add "Back to app" navigation to Login page (AC: 4)
  - [ ] 5.1 Add `Link` to the `react-router` import at Login.tsx:2
  - [ ] 5.2 Wrap `<KnowluneLogo />` at Login.tsx:67 in `<Link to="/">` with `aria-label="Back to app"`
  - [ ] 5.3 Keep centered layout, ensure no visual regression

- [ ] Task 6: Verify login redirect guard works (AC: 5)
  - [ ] 6.1 Confirm `Login.tsx:33-38` redirect logic fires when auth state is fixed (Task 1)
  - [ ] 6.2 Ensure early return at `Login.tsx:58` prevents flash of login form
  - [ ] 6.3 Test: navigate to `/login` when signed in → immediate redirect to `/`

- [ ] Task 7: Unit tests for Google metadata hydration
  - [ ] 7.1 Maps `full_name` to displayName for fresh user
  - [ ] 7.2 Maps `avatar_url` to profilePhotoUrl for fresh user
  - [ ] 7.3 Falls back to `picture` field when `avatar_url` missing
  - [ ] 7.4 Rejects non-HTTPS avatar URLs (e.g., `javascript:alert(1)`)
  - [ ] 7.5 Custom displayName preserved over Google `full_name`
  - [ ] 7.6 Custom avatar (data: URL) preserved over Google avatar (https: URL)
  - [ ] 7.7 Custom `displayName` metadata key wins over `full_name`
  - [ ] 7.8 Handles `undefined` metadata gracefully (no crash, no-op)
  - [ ] 7.9 Handles empty metadata object (no crash, no-op)
  - [ ] 7.10 Dispatches `settingsUpdated` event when updates occur

## Design Guidance

### Header Avatar (Layout.tsx)
- Avatar priority: custom uploaded photo (`profilePhotoUrl`) > Google avatar URL (`user_metadata.avatar_url`) > initials fallback
- Always render both `<AvatarImage>` and `<AvatarFallback>` as Radix siblings — never use a ternary
- Add `referrerPolicy="no-referrer"` on `<AvatarImage>` to prevent 403 from Google CDN
- Keep existing styling: `size-10`, ring hover effects, session expiry warning dot (E43-S04)

### Login Page "Back to app"
- Wrap existing `<KnowluneLogo />` in a `<Link to="/">` — minimal change, natural UX
- Add `aria-label="Back to app"` for accessibility
- Keep centered layout, no layout shifts

### Settings Profile Section
- When Google avatar is available but no custom upload: show Google avatar in the upload zone as preview
- Display name from Google shown as current value (editable by user)
- `AvatarUploadZone` already uses correct Radix pattern and accepts string URLs — no changes needed

## Implementation Notes

### Prep: Rename `profilePhotoDataUrl` → `profilePhotoUrl`

The field stores data URLs (uploads), object URLs (temp), AND HTTPS URLs (Google OAuth). The current name is misleading. No users exist — no localStorage migration needed. Mechanical find-and-replace across 4 source files + 1 test file (~16 occurrences).

### Root Cause: Auth state not updating (AC #1)

The Supabase JS client fires `INITIAL_SESSION` when `onAuthStateChange` is first subscribed. However, after an OAuth redirect, the session may already be established (tokens extracted from URL hash) before React mounts and the `useEffect` in `useAuthLifecycle.ts` subscribes. There are documented intermittent issues where `INITIAL_SESSION` fails to fire ([supabase/supabase#41968](https://github.com/supabase/supabase/issues/41968)).

**Fix: Add `getSession()` fallback AFTER subscription** (critical ordering — listener first, then getSession):

```typescript
// In useAuthLifecycle.ts useEffect — AFTER subscription setup
let ignore = false

// ... subscription code with `if (ignore) return` guard ...

// IMPORTANT: subscription MUST be established BEFORE getSession() is called
// so that any session change during getSession() is not missed
supabase.auth.getSession().then(({ data: { session } }) => {
  if (ignore) return
  const state = useAuthStore.getState()
  state.setSession(session)
  if (session?.user) {
    hydrateSettingsFromSupabase(session.user.user_metadata)
  }
})

// Clean hash fragment after OAuth redirect (cosmetic — Supabase cleanup is unreliable)
if (window.location.hash.includes('access_token')) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

return () => { ignore = true; subscription.unsubscribe() }
```

**Critical warnings from Supabase docs and community:**
- The `onAuthStateChange` callback must NOT be async and must NOT `await` other Supabase methods inside it — this causes deadlocks ([supabase/auth-js#762](https://github.com/supabase/auth-js/issues/762)). Our current hook is synchronous (good — keep it that way).
- The app must use a **single Supabase client instance** — multiple instances cause events to broadcast to only one ([supabase discussion #4035](https://github.com/orgs/supabase/discussions/4035)). Verified: our singleton at `src/lib/auth/supabase.ts` is correct.
- `getSession()` reads from local storage (no network request) — safe and fast to call.
- The `ignore` flag prevents state updates after unmount during React strict mode double-mount. While `getSession()` resolves near-instantly (localStorage read), this follows React best practices and protects against future changes.

**Reference:** [Supabase Auth docs — onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)

### Root Cause: Google avatar not mapped (AC #3)

`hydrateSettingsFromSupabase()` at `src/lib/settings.ts:123` only maps `userMetadata.displayName` and `userMetadata.bio`. Google OAuth stores metadata under different keys ([supabase discussion #4047](https://github.com/orgs/supabase/discussions/4047)):

| Google metadata key | App settings key | Current mapping |
|---------------------|------------------|-----------------|
| `full_name` | `displayName` | Missing |
| `avatar_url` | `profilePhotoUrl` | Missing |
| `picture` | `profilePhotoUrl` (fallback) | Missing |
| `email` | (read from `user.email`) | Already works |

**Google `user_metadata` shape** (from OAuth):
```json
{
  "avatar_url": "https://lh3.googleusercontent.com/a/...",
  "full_name": "John Doe",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/a/...",
  "email": "user@gmail.com",
  "email_verified": true,
  "iss": "https://accounts.google.com",
  "sub": "1234567890"
}
```

**Important:** `avatar_url` and `full_name` are only present for OAuth sign-ins, NOT email/password auth. Some Google accounts may lack `avatar_url` (especially Workspace accounts with restricted profile sharing). Always guard with typeof checks.

**Precedence chain:**
- displayName: custom metadata `displayName` > Google `full_name` > default "Student"
- avatar: custom upload (data: URL) > Google avatar (https: URL) > initials fallback

**Protocol guard:** Only accept `avatar_url` values starting with `https://`. This prevents injection of `javascript:`, `data:`, or other malicious URLs into `<img src>`.

**Idempotency note:** `hydrateSettingsFromSupabase()` is safe to call multiple times — it only overwrites settings at default values. Both `INITIAL_SESSION` and `getSession()` may trigger hydration; this is intentional, not a bug.

**Circular hydration note:** When `full_name` is mapped to `displayName` via hydration, and the user later edits their display name in Settings, `saveSettings()` syncs the edited `displayName` back to Supabase. On next login, hydration will find BOTH `displayName` (user edit) and `full_name` (Google). The hydration logic checks `displayName` first (existing behavior at line 133), so user edits win. If the user resets to default "Student", Google's `full_name` will re-populate — this is acceptable behavior.

### Layout Avatar: Ternary Bug Fix

**Current code** (Layout.tsx:526-537) uses a ternary:
```tsx
{settings.profilePhotoUrl ? (
  <AvatarImage src={...} />
) : (
  <AvatarFallback>...</AvatarFallback>
)}
```

**Problem:** Radix `AvatarFallback` auto-shows when `AvatarImage` fails to load — but only when both are rendered as siblings. The ternary renders one OR the other, so if an external URL 403s/404s, the user sees an empty broken avatar with no initials fallback.

**Fix:** Always render both as siblings (matches `avatar-upload-zone.tsx:111-116`):
```tsx
<AvatarImage src={settings.profilePhotoUrl || undefined} referrerPolicy="no-referrer" />
<AvatarFallback>...</AvatarFallback>
```

### Google Avatar 403 Prevention

Google CDN (`lh3.googleusercontent.com`) returns **403 Forbidden** when requests include a `Referer` header. The app sets `Referrer-Policy: strict-origin-when-cross-origin` in `vite.config.ts:426`, which sends referrer on cross-origin requests.

**Fix:** Add `referrerPolicy="no-referrer"` on the `<AvatarImage>` element. The `...props` spread in the Avatar component (`avatar.tsx:23`) passes this through to the underlying `<img>`.

### CSP Blocker: Google Avatar Domain

**CONFIRMED BLOCKER**: The CSP `img-src` in `index.html:24` does NOT include `lh3.googleusercontent.com`:
```
img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com;
```

Google avatars will be **silently blocked** by CSP. Fix required in TWO places:
1. **`index.html:24`** (production CSP meta tag) — add `https://*.googleusercontent.com`
2. **`vite.config.ts:437`** (dev server CSP header) — add `https://*.googleusercontent.com`

**Dual CSP warning:** Both files define CSP, and the most restrictive union wins. If only one is updated, images are still blocked in the environment using the other CSP. The two CSPs are already diverged (different `img-src` domains) — this is a known tech debt item.

Use `https://*.googleusercontent.com` (wildcard) rather than `https://lh3.googleusercontent.com` (specific) — Google has historically used multiple subdomains for content delivery.

### Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/lib/settings.ts` | 22-28, 59, 123-153 | Rename field + extend `hydrateSettingsFromSupabase()` with Google metadata mapping |
| `src/lib/__tests__/settings.test.ts` | 254-259, new block | Rename + new Google hydration tests (10 cases) |
| `src/app/hooks/useAuthLifecycle.ts` | 19-55 | Add `ignore` flag, `getSession()` fallback, hash cleanup |
| `src/app/components/Layout.tsx` | 526-537 | Rename + fix ternary → siblings + `referrerPolicy="no-referrer"` |
| `src/app/pages/Login.tsx` | 2, 66-69 | Add `Link` import + wrap logo |
| `src/app/pages/Settings.tsx` | 440, 443, 473, 475, 605, 638, 737 | Rename only (7 occurrences) |
| `index.html` | 24 | Add `https://*.googleusercontent.com` to `img-src` CSP |
| `vite.config.ts` | 437 | Add `https://*.googleusercontent.com` to dev `img-src` CSP |

### Existing Code to Reuse (DO NOT rebuild)

- `hydrateSettingsFromSupabase()` at `src/lib/settings.ts:123` — extend, don't replace
- `<Avatar>`, `<AvatarImage>`, `<AvatarFallback>` from `@/app/components/ui/avatar`
- `<KnowluneLogo />` from `@/app/components/figma/KnowluneLogo`
- `RETURN_TO_KEY` from `@/app/components/figma/SessionExpiredBanner`
- `navigateToReturnRoute()` in `Login.tsx:26-30` — already handles redirect
- `useAuthLifecycle()` hook — extend, don't replace
- Avatar sibling pattern from `avatar-upload-zone.tsx:111-116` — reference for Layout fix

### Previous Story Intelligence (E43-S04)

E43-S04 implemented the session expiry banner and return-to-route pattern. Key learnings:
- `_userInitiatedSignOut` flag pattern works well for distinguishing sign-out causes
- `sessionStorage` is the right choice for ephemeral auth state (not localStorage)
- Layout.tsx header already has conditional auth rendering (line 518: `authUser ?`)
- The `useAuthLifecycle` hook is the single auth event handler — extend it, don't add a second listener

### Anti-Patterns to Avoid

- Do NOT add a second `onAuthStateChange` listener — `useAuthLifecycle` is the single handler
- Do NOT make the `onAuthStateChange` callback async or `await` Supabase methods inside it — causes deadlocks ([supabase/auth-js#762](https://github.com/supabase/auth-js/issues/762))
- Do NOT store Google avatar as base64 data URL — use the external URL directly (it's a Google CDN link)
- Do NOT remove the existing `profilePhotoUrl` → uploaded photo (data: URL) takes precedence over Google avatar (https: URL)
- Do NOT modify `signInWithGoogle()` action — the OAuth redirect flow is correct, the issue is session detection timing
- Do NOT call `getSession()` repeatedly or in a loop — it's designed to be called once after subscription
- Do NOT use `getUser()` on the client — it makes a network request every time. Use `getSession()` which reads from localStorage

### Known Limitations

- **"Remove Photo" reappears after Google re-login**: If a user removes their Google avatar via Settings then re-logs in, hydration sees no local avatar and re-populates from Google `avatar_url`. Fixing this would require a `profilePhotoRemoved: true` flag — overengineered for v1. Users who want no avatar can upload a custom photo (takes precedence).
- **Cross-tab session sync**: `onAuthStateChange` doesn't sync across tabs. Signing in on one tab won't update others until they receive a `storage` event via localStorage. This is a Supabase limitation, not in scope.
- **Google Workspace avatar restrictions**: Some Workspace admins restrict profile photo visibility. These accounts may lack `avatar_url` entirely — the initials fallback handles this.

## Testing Notes

### Manual Test Flow (Required — Google OAuth cannot be E2E tested)
1. Open app at `localhost:5173`
2. Click "Sign In" → navigate to `/login`
3. Verify: logo is clickable, navigates back to `/`
4. Select "Google" tab → click "Continue with Google"
5. Complete Google OAuth consent
6. Verify: redirected back to app, URL has no `#access_token` hash fragment
7. Verify: header shows Google avatar + name (not "Sign In" button)
8. Open DevTools Console → verify no CSP violations
9. Navigate to Settings → verify Account section shows email + "Signed in via google"
10. Verify: Settings profile section shows Google avatar in upload zone
11. Navigate to `/login` via URL bar → verify immediate redirect to `/`
12. Sign out → verify header shows "Sign In" button again

### Edge Cases
- **No Google avatar**: Some Google accounts don't have `avatar_url` in metadata — verify initials fallback works (guard with typeof check)
- **Custom photo already uploaded**: Verify uploaded photo (data: URL) takes precedence over Google avatar (https: URL)
- **Email/password user (no OAuth metadata)**: `user_metadata` won't have `full_name` or `avatar_url` — hydration must not overwrite existing settings with undefined
- **Session expiry after OAuth login**: Verify E43-S04 expiry banner still works correctly after `getSession()` addition
- **Multiple tabs**: Sign in on one tab → verify other tabs detect session (Supabase built-in cross-tab via localStorage)
- **Offline during OAuth callback**: Should fail gracefully (Supabase handles this)
- **Tab in background during OAuth redirect**: LockManager API (used by Supabase) only refreshes foreground tabs — verify backgrounded tab picks up session when foregrounded
- **CSP violation**: If `lh3.googleusercontent.com` not in CSP, avatar silently fails to load — no error visible to user, just shows initials
- **Avatar URL 403**: If `referrerPolicy` is missing, Google CDN returns 403. Radix AvatarFallback should auto-show initials (requires sibling pattern fix).
- **Malicious avatar_url**: Protocol guard (`startsWith('https://')`) prevents `javascript:`, `data:`, or other injection via compromised user_metadata.

### Unit Tests
- `hydrateSettingsFromSupabase()`: maps `full_name` to displayName for fresh user
- `hydrateSettingsFromSupabase()`: maps `avatar_url` to profilePhotoUrl for fresh user
- `hydrateSettingsFromSupabase()`: falls back to `picture` field when `avatar_url` missing
- `hydrateSettingsFromSupabase()`: rejects non-HTTPS avatar URLs
- `hydrateSettingsFromSupabase()`: custom displayName preserved over Google `full_name`
- `hydrateSettingsFromSupabase()`: custom avatar (data: URL) preserved over Google avatar (https: URL)
- `hydrateSettingsFromSupabase()`: custom `displayName` metadata key wins over `full_name`
- `hydrateSettingsFromSupabase()`: handles `undefined` metadata gracefully
- `hydrateSettingsFromSupabase()`: handles empty metadata object
- `hydrateSettingsFromSupabase()`: dispatches `settingsUpdated` event when updates occur

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] CSP allowlist configured for `*.googleusercontent.com` in BOTH `index.html` and `vite.config.ts`
- [ ] `referrerPolicy="no-referrer"` on `<AvatarImage>` for external URLs

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
