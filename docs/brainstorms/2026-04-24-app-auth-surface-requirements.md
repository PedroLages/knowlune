---
date: 2026-04-24
topic: app-auth-surface
status: ready-for-planning
supersedes: docs/ideation/2026-04-24-app-auth-ideation.md (user-surface portion only; Auth Kernel infra ideation still stands)
terminology:
  - "guest mode" = the anonymous 1-file-per-modality preview (this document). Never "trial mode" — that name is already taken by the E19 Stripe premium trial (`useTrialStatus`, `TrialIndicator`, `isTrialing`).
decisions:
  - guest-preview-shape: 1 course + 1 audiobook + 1 EPUB (resolved 2026-04-24)
  - audiobook-epub-in-guest: included with 1-file cap (resolved 2026-04-24)
  - auth-kernel-prerequisite: deferred entirely; existing useAuthStore is sufficient (resolved 2026-04-24)
  - settings-guest-gating: hide signed-in-only sections entirely; Account section stays visible (resolved 2026-04-24)
  - landing-sequencing: ship Slices 1-2 first, then commit remaining slices in same epic (resolved 2026-04-24)
  - minimum-viable-baseline: bugs and closed-app pivot are the same work (resolved 2026-04-24)
---

# Knowlune Auth Surface — Closed App with Guest Gate

## Context

The current auth surface is a mix of legacy offline-first assumptions and newer Supabase-paired code. Symptoms the user reports (static "Sign In" button after login, missing Google profile data in Settings, Sign Up/In buttons persisting, no dedicated auth page) are partly real bugs and partly UX gaps. Ground-truth inspection found:

- `src/app/components/Layout.tsx:627-710` already conditionally renders the top-bar (avatar+dropdown when signed in, "Sign In" button otherwise). The "static button" symptom is a state/hydration regression, not a missing UI branch.
- `src/app/components/settings/sections/AccountSection.tsx:26` already gates the "Sign Up/Sign In" card on `!user`. Same story — regression, not missing UI.
- `src/app/pages/Login.tsx` + route `/login` (`src/app/routes.tsx:214`) already exists as a standalone auth page, outside `Layout`. The `AuthDialog` modal in Settings is a second, redundant entry point.
- `src/lib/settings.ts:216 hydrateSettingsFromSupabase` has a real bug: it only writes Google profile fields when localStorage is at defaults, so any prior user edit blocks hydration forever.

The deeper problem is strategic: Knowlune was *architected* offline-first (Dexie, 26 tables, sync as a layer) but is being *productized* as a cloud-leaning SaaS (E19 entitlements, ABS/OPDS/Hardcover integrations, AI features, premium subscription). The product keeps trying to support an "anonymous steady state" that isn't doing any real work — it has no email reachability, no funnel signal, no identity in analytics, and creates an auth-seam across 20+ features that produces silent failures, zombie sessions, vault unauth bugs, and the problem this branch (`fix/abs-vault-unauth-guard`) is patching today.

**Intended outcome:** close the app behind sign-in as the default steady state, keep a ruthlessly-scoped "1-course guest preview" at the edge for acquisition, collapse the two auth entry points into one unified split-screen landing+auth surface, and fix the Google profile hydration bug.

## Goals

1. Sign-in becomes a hard requirement to access the app shell (sidebar, top-bar, all features).
2. Anonymous visitors land on a split-screen marketing+auth surface that explains the value prop, lets them sign in/up, or enter the bounded 1-course guest preview.
3. The guest preview is a real (not canned) experience: upload 1 course, take lessons, take notes, track progress — all locally. Integrations, sync, AI, multi-course, and premium are signed-in only.
4. When a guest user signs up, they are prompted to keep or discard their guest data on first sign-in (reusing the existing `LinkDataDialog` flow).
5. Top-bar and Settings/Account correctly reflect sign-in state on every render (no stale buttons).
6. Profile identity (display name, email, avatar) hydrates from Google on OAuth sign-in and stays consistent across devices by making `user_metadata` in Supabase the source of truth, with localStorage as a cache.
7. The anonymous code paths that currently scatter `!user` checks across features are deleted or consolidated behind a single `guestMode` flag (see Non-Goals for scope of deletion — the 60 existing `!user` call sites are not all in scope).

## Non-Goals

- Rewriting the Auth Kernel infra (FSM, error taxonomy, `authedFetch`, event bus). That work is tracked in `docs/ideation/2026-04-24-app-auth-ideation.md` idea #1 and should be sequenced alongside this but is a separate planning artifact.
- Zombie-session auto-heal, cross-tab session sync, sync queue auth-awareness, troubleshoot panel. Same ideation doc, separate work.
- Passkeys, magic-link UX polish, step-up re-auth flows.
- Per-feature "sign in to unlock" micro-CTAs beyond what the guest boundary requires. The guest gate is the single boundary.
- Server-side entitlements (E19/E95) — guest vs signed-in is client-side (with server-side RLS enforcement per Risks); premium tier is a separate layer *inside* the signed-in experience.

## Access Model — The Guest Gate

> **Naming:** User-facing copy uses "guest mode" / "you're browsing as a guest." Code uses `isGuestMode` / `guestMode`. Do not use the word "trial" anywhere in this system — the Stripe premium trial owns that name (`useTrialStatus`, `TrialIndicator`, `isTrialing`). In the capability table below, the "Guest (anonymous)" column replaces the original "Trial" label.

### Capability split

| Capability | Guest (anonymous) | Signed in |
| --- | --- | --- |
| Upload 1 course (ZIP/folder) | ✅ (capped at 1) | ✅ unlimited |
| Take lessons, quizzes | ✅ (guest course only) | ✅ |
| Progress tracking, streaks | ✅ (local-only, device-bound) | ✅ (synced) |
| Notes on lessons | ✅ (local) | ✅ (synced) |
| Pomodoro, focus mode | ✅ | ✅ |
| Theme, display, accessibility | ✅ | ✅ |
| Connect Audiobookshelf | ❌ | ✅ |
| Connect OPDS catalog | ❌ | ✅ |
| Hardcover sync | ❌ | ✅ |
| AI features (summaries, Q&A, TTS) | ❌ | ✅ |
| Cloud sync across devices | ❌ | ✅ |
| Import from URL / Google Drive | ❌ | ✅ |
| Premium features (E19) | ❌ | ✅ (if entitled) |
| Upload 1 audiobook (local file) | ✅ (capped at 1) | ✅ unlimited |
| Upload 1 EPUB (local file) | ✅ (capped at 1) | ✅ unlimited |

**Rule of thumb:** *local + single-file = guest; cloud or multi-file = signed-in.* Any feature that talks to a network service, writes to Supabase, or requires a per-user key is signed-in only. The 1-file cap applies per modality: 1 course, 1 audiobook, 1 EPUB. This ensures the guest preview represents the full product (courses + reading + listening) without underselling it as "courses-only."

### Guest enforcement

- `isGuestMode` is a selector: `initialized && !user && sessionStorage.getItem('knowlune-guest') === 'true'`. Three states exist at the app level: `authenticated` (user present), `guest` (session marker set, no user), `anonymous` (no user, no guest marker → landing page). The `initialized` clause prevents a flash of landing/guest on every reload before `onAuthStateChange` resolves.
- Guest-eligible features render normally; gated features render a single consistent "Sign in to unlock" affordance (see UX section).
- The "1 course" cap is enforced at the data layer (inside `useCourseImportStore` and `useYouTubeImportStore`, not only at the UI button), because there are multiple course-import entry points (ZIP/folder via `BulkImportDialog`, YouTube via `YouTubeImportDialog`). When a guest tries to add a second course, they get a "You've got 1 course already — sign up to add more courses" prompt.
- **Open:** decide during planning whether YouTube import is guest-eligible at all (it creates an `importedCourses` row like a ZIP, so capability-wise it fits "local + single" — but it also requires network access to YouTube). Default: allow in guest with the same 1-course cap.

## UX / UI

### Route topology

- `/` and any unauthenticated route →
  - If `initialized === false` → render a neutral splash (reuse the existing `PageLoader` / `DelayedFallback` pattern) so the landing does not flash for authed users restoring their session.
  - If `initialized && window.location.hash` contains `access_token`/`code`/`type=recovery` (OAuth or magic-link return) → render the splash and wait for `onAuthStateChange` to resolve; do not show the landing page in this window.
  - If `initialized && user` → continue into the app shell (route to stored `RETURN_TO_KEY` path or `/courses`).
  - If `initialized && !user && guestMode` → render the guest shell.
  - If `initialized && !user && !guestMode` → render the **landing page** (split-screen).
- `/login` → redirects to `/` so there is one canonical landing surface. OAuth redirect target and magic-link landing point to `/`; the guard above handles the post-auth transition. Preserve the existing `RETURN_TO_KEY` (sessionStorage) flow — validate that the stored value is a same-origin relative path before `navigate(returnTo)`.
- `/guest` → entry point for "Try without signing up." Sets `knowlune-guest=true` in sessionStorage and routes into the guest shell.
- All in-app routes (`/courses`, `/library`, `/settings`, `/reports`, …) require `user` OR `guestMode`. Otherwise redirect to `/`.

### Landing page (split-screen, replaces the current `Login.tsx`)

- **Left half:** value proposition (headline, 3 bullets, 1 screenshot/hero), "Try without signing up →" secondary CTA at the bottom.
- **Right half:** auth form with Email / Magic Link / Google tabs (reuse existing `EmailPasswordForm`, `MagicLinkForm`, `GoogleAuthButton`).
- Desktop (≥1024px): real split-screen, 50/50.
- Tablet (640–1023px): stacked, value prop on top, auth form below.
- Mobile (<640px): auth form first with a "Why Knowlune?" accordion above it; "Try as guest" CTA at the bottom.
- WCAG 2.1 AA: maintain `4.5:1` contrast, proper form labels, focus order left→right on desktop / top→bottom on mobile, skip-to-auth link for screen readers.

### Guest shell

- Same `Layout` (sidebar + top-bar) as the signed-in app, but:
  - Top-bar "Sign In" button replaces the avatar/dropdown slot.
  - A persistent slim "You're browsing as a guest — sign up to save your progress" banner at the top of main content with a "Sign up" CTA, dismissible **for the session only** (sessionStorage key `knowlune-guest-banner-dismissed`, cleared on tab close). The banner must have `role="status"` and announce once on mount.
  - Gated nav items (ABS, OPDS, Hardcover, AI, Sync indicator) are **hidden** in the top-level sidebar (cleaner). Do not show lock icons in the sidebar — matching the top-bar treatment where the "Sign In" button replaces the avatar entirely rather than showing a locked avatar.
  - Any attempt to import a second course shows a modal: "You've got 1 course already. Sign up to add unlimited courses, connect your library, and unlock AI."
- The guest shell renders on `/guest` (explicit) and on any in-app route where `guestMode=true` and `user=null`. Guest data lives in the same Dexie database as signed-in data; we do **not** maintain a parallel guest database. **Row-ownership invariant:** every write from the guest shell goes through `syncableWrite` with `userId: null` (existing behaviour in `src/lib/sync/syncableWrite.ts:139–155`), AND carries a `guestSessionId` UUID stamped at guest-session start in sessionStorage. The migration reconciles by `guestSessionId`, not by null-ness alone (prevents a zombie-session's orphaned rows from being claimed).

### Gated-feature pattern (signed-in only, e.g. ABS settings)

- Render the section's normal header and description.
- Where the form/content would be, show a centered card: lock icon, short copy ("Audiobookshelf integration is available when you're signed in. Your library syncs across devices."), "Sign In" + "Sign Up" buttons.
- This is the ONE gated-feature pattern. Every signed-in-only feature in Settings uses the same component.

### Top-bar (signed-in)

- Avatar, name, dropdown (Profile, Settings, Sign out). Already implemented and working; the "static button" symptom is a regression to fix, not a redesign target.
- Avatar falls back to initials when no `profilePhotoUrl` is set (already implemented).
- Warning dot on avatar when `sessionExpired` is true (already implemented).

### Settings / Account (signed-in)

- Remove the "Get Started" Sign Up/Sign In card entirely — anonymous users can't reach Settings in the closed app.
- Keep the signed-in sections as today: Account info, Subscription, Security (email/password accounts only), My Data, Danger Zone.
- `AuthDialog` in `AccountSection.tsx` is deleted. There is no longer a modal auth entry point. The single auth surface is the landing page.

### Settings / Account (guest mode)

- Show a dedicated "You're browsing as a guest" card at the top with: what you get, what sign-up unlocks, "Sign up" CTA.
- Render only the sections that work for guests: Appearance, Learning preferences (local), Display/Accessibility, Focus mode settings.
- All signed-in-only sections (Subscription, Security, Integrations, Sync, My Data, Danger Zone) are **hidden entirely** in guest mode. Do not show gated-feature lock cards for these sections — six padlock placeholders signal a paywall, not an auth gate, and poison first impressions. The Account section remains visible as the single sign-up entry point in Settings.

## Profile Hydration Fix

**Current bug:** `src/lib/settings.ts:216 hydrateSettingsFromSupabase` guards every field write with `current.displayName === defaults.displayName || current.displayName === ''`. Any user edit (including the default drift from "Learner" → "Student" in the metadata branch logic) permanently blocks Google metadata from being written.

**Root-cause fix:** make Supabase `user_metadata` the source of truth for profile fields (`displayName`, `bio`, `profilePhotoUrl`), with localStorage as a cache.

- On first sign-in for a given `user.id` on a given device (tracked via a `knowlune-hydrated-for:${userId}` localStorage flag), force-overwrite localStorage from Google `user_metadata` (`full_name`, `avatar_url` / `picture`, `email`).
- On subsequent sign-ins for the same user on the same device, read from `user_metadata` first, fall back to localStorage if empty.
- Edits in `ProfileSection` write through to `supabase.auth.updateUser({ data: {...} })` AND localStorage (both succeed → source-of-truth stays coherent; network failure → localStorage wins until next sync).
- `avatar_url` vs `picture` fallback stays (both are Google-provided); extend to also accept `image_url` for future OIDC providers.

**Acceptance:** a new Google sign-in on a fresh browser shows the Google avatar, display name, and email in the top-bar and Settings/Account within one render cycle. An edit in `ProfileSection` survives a sign-out/sign-in cycle. A sign-in on a second device shows the user's edited values (not the Google defaults) because `user_metadata` is the source of truth.

## Migration (Guest → Signed-In)

**Reuse existing infrastructure.** Knowlune already has this exact flow implemented for the "linked a previously-anonymous session to an account" case: `LinkDataDialog` (Keep vs Start-fresh modal), `backfillUserId` (attaches `user.id` to userId-null rows), `hasUnlinkedRecords` / `countUnlinkedRecords` (modal gate + preview), `clearSyncState` (Start-fresh path), all wired to the `SIGNED_IN` event by `useAuthLifecycle.onUnlinkedDetected`. Do **not** build a parallel system in `src/lib/guestMode.ts`.

The work for this epic is:

1. Stamp every guest write with `guestSessionId` alongside `userId: null` (extend the `syncableWrite` metadata, or add a trailing column on the affected tables). This disambiguates guest writes from zombie-session orphans and from rows corrupted by partial sync failures.
2. Extend `hasUnlinkedRecords` / `backfillUserId` / `clearSyncState` to key off `(userId IS NULL AND guestSessionId = ?)` rather than `userId IS NULL` alone.
3. Tweak `LinkDataDialog` copy to fit the guest→signed-in narrative ("Keep your guest course?" instead of the current phrasing).
4. On first successful sign-in after a guest session, `useAuthLifecycle` fires `onUnlinkedDetected`, which opens `LinkDataDialog`.
5. **Close-without-choosing default:** the existing `LinkDataDialog` dismiss behaviour is authoritative. Do not override it here. Planning should verify the current default does not clobber privacy expectations (a shared-device guest whose rows would be auto-attached to an unrelated sign-in).

**Edge cases:**

- **Second device mid-guest:** the second device has no guest-session marker, so no modal. The first device retains its guest data until the user signs in there.
- **Sign out + new guest session:** old guest data was migrated (or discarded) on the previous sign-in; the new guest session starts with an empty Dexie.
- **Per-table PK shape:** some tables (e.g., composite PKs that include `user_id`) require the backfill to go through Dexie's upsert path, not `add`. This is the same constraint `backfillUserId` already handles for existing unlinked-record flows — follow its patterns.
- **Zombie-session contamination:** rows with `userId` pointing at a deleted server-side user must not be mis-detected as guest rows. The `guestSessionId` filter prevents this; `hasUnlinkedRecords` must be updated to require both conditions.

## Success Criteria

- The app shell (`Layout`) never renders for `initialized && !user && !guestMode`. The only unauthenticated surface is the landing page.
- A new visitor can: land, read the value prop, sign up in <30 seconds via Google, land in the dashboard with their correct profile (avatar, name, email).
- A new visitor can also: land, click "Try without signing up," upload 1 course, take a lesson, close the browser, come back, pick up where they left off.
- A guest user who signs up is shown the "Keep your guest course?" modal (reusing `LinkDataDialog`) exactly once and lands in the dashboard with their course migrated (on Keep) or an empty account (on Start fresh).
- Signed-in top-bar always shows the correct avatar/name/email on every render — no "static Sign In button" regression. This requires a **reproducer captured before planning begins** (see Risks & Open Questions).
- Settings/Account signed-in view shows Google avatar + display name + email after OAuth sign-in, and survives an edit + sign-out + sign-in roundtrip.
- The `AuthDialog` modal is deleted from AccountSection, SyncSection, PremiumGate, and the `authDialogOpen` / `setAuthDialogOpen` / `authDialogMode` fields in `SettingsPageContext`. No feature imports it. (PremiumGate's `!user` branch becomes dead code in the closed app — delete or assert-unreachable.)
- **Feature-level** `!user` branching in pages and feature components is gone or consolidated behind the `GatedFeatureCard`. **Service-layer** `!user` guards (in `src/lib/sync/`, `src/ai/`, `src/stores/`, `src/lib/entitlement/`, `src/lib/compliance/`, `src/lib/vaultCredentials.ts`, `useAuthLifecycle`, `backfillUserId`) are **out of scope** — they are correct defensive code and must not be deleted in this epic.
- `displayName` and `bio` inputs in `ProfileSection` are length-limited (e.g., 40 chars for name, 300 for bio) and rendered as React text nodes only. Avatar URLs from `user_metadata` are validated against an allowlist (`lh3.googleusercontent.com` for Google; reject on mismatch, fall back to initials).

## Risks & Open Questions

- **Top-bar "static Sign In" reproducer is not captured.** The brainstorm treats this as a regression of known cause, but `Layout.tsx:627` already conditions on `authUser` and `settings.ts:257` already dispatches `settingsUpdated` after hydration. If the failing path is actually `hydrateSettingsFromSupabase`'s guard (the same bug Goal 6 fixes), the separate Layout fix may be a phantom. **Before slicing:** capture exact repro steps, git ref, browser, whether `user_metadata` loads in the Network tab, whether `settingsUpdated` fires. Decision point: if the guard bug IS the whole bug, the separate Layout slice collapses into the hydration fix.
- **Existing beta-account data is not zero.** The user said "no users," but Knowlune is live at `knowlune.pedrolages.net` and Pedro has at least one active account across devices (per `memory/project_actual_deployment_topology.md`). The hydration rewrite (Goal 6) must not clobber existing locally-edited displayName/bio/avatar on next sign-in. **Before implementation:** inventory Dexie state on Pedro's primary device. The `knowlune-hydrated-for:${userId}` flag will not exist for pre-existing accounts, so "force-overwrite on first sign-in" is a data-loss path in production as currently written.
- **Hydration strategy — scope decision.** Two valid options:
  - (a) **Minimal fix:** remove the `current.displayName === defaults.displayName` guard at `settings.ts:228` (~3 lines), hydrate Google metadata when localStorage looks like a default or placeholder. Does not touch `ProfileSection` or `supabase.auth.updateUser`. Preserves existing beta-account edits.
  - (b) **Source-of-truth rewrite:** `user_metadata` becomes canonical, write-through on edits, per-device flag. Fixes the cross-device story but introduces `updateUser` failure modes and requires retry-queue semantics.
  - Recommendation: plan ships (a); (b) is a separate post-beta story. If (b) is chosen, add explicit acceptance criterion: "existing beta accounts do not lose local edits on first post-ship sign-in."
- **Guest storage bloat.** A guest could upload a 500MB course into IndexedDB and never sign up. Mitigation: cap guest course size (e.g., 50MB) and surface in the import flow. Cap also applies to migrated rows so a bot-scale guest cannot flood an account at sign-up.
- **Local EPUB / audiobook in guest.** ~~Deferred.~~ **Resolved:** include both with a 1-file cap per modality (1 course + 1 audiobook + 1 EPUB). Courses-only guest misrepresents the product. The cap is a row-count check in the relevant import store — low complexity, correct framing. Slices 4 and 5 must cover audiobook and EPUB import caps alongside the course cap.
- **Guest shape.** ~~"1 course, no integrations" is one of several plausible gates.~~ **Resolved:** 1-file-per-modality cap (courses + audiobooks + EPUBs). Time-windowed (14-day) and unlimited-1-device alternatives were weighed. 14-day requires a clock and an expiry UI. Unlimited-1-device optimizes for feel but creates a weaker conversion signal. 1-file-per-modality has the lowest carrying cost, creates clear conversion pressure, and honestly represents the product's breadth in a single session.
- **Ambient gating cost in Settings.** ~~"Every signed-in-only section shows a gated-feature card."~~ **Resolved:** hide those sections entirely in guest mode (see Settings / Account — Guest mode section). The Account section is the only visible sign-up entry point. This matches the sidebar treatment where gated nav items are hidden, not padlocked.
- **Auth Kernel sequencing.** ~~Spike needed.~~ **Resolved:** defer the Auth Kernel entirely from this epic. The existing `useAuthStore` (`initialized`, `sessionExpired`, `_userInitiatedSignOut`) is sufficient for the three-state route guard and the one-shot migration modal. Adding even a "minimal FSM subset" bleeds infra scope into a UX epic without a proven gap. If the planner finds a missing transition during slicing, file it as a prerequisite story; do not pull the full Auth Kernel in speculatively.
- **Client-side-only gate.** Route guards and `isGuestMode` are client-side; server-side enforcement must live in Supabase RLS (already in place for most tables). Planning must verify every guest-gated capability has a corresponding server-side policy, so a user who bypasses the client gate via DevTools cannot write to signed-in-only tables. Also: `window.__authStore` is currently exposed in non-production builds (`useAuthStore.ts:157`) — confirm it is not reachable in any user-facing deploy.
- **OAuth + magic-link return.** `redirectTo: window.location.origin` (`useAuthStore.ts:112`) means the landing URL hash carries tokens during the OAuth/magic-link window. The route guard must detect this (splash + wait) — handled in the updated Route Topology. Planning should add a test that the landing page never renders during this interval.
- **`user_metadata` is user-writable.** `supabase.auth.updateUser({ data })` has no server-side schema validation by default. Inputs need length caps (40 char `displayName`, 300 char `bio`) validated at the ProfileSection form, and avatar URLs need a same-origin / allowlisted-host check before being stored and rendered.
- **PostHog identity alias.** The guest-to-signed-in funnel reconciliation relies on `posthog.alias()` being called on sign-up. Confirm during planning that the anonymous `distinct_id` actually reconciles and that guest events are not lost.
- **Password-manager autofill.** 1Password/Bitwarden key off URL and form fields — confirm `/` serving both authed and unauthed content (via client-side redirect) does not break autofill. Manual test during implementation.
- **SEO / crawlability.** SPA landing not indexed. Not a beta blocker; worth a future marketing-site split.

## Handoff Notes for Planning

**Files that will change (non-exhaustive, anchor for planning):**

- `src/app/pages/Login.tsx` → becomes `src/app/pages/Landing.tsx` with split-screen (value prop + auth form).
- `src/app/routes.tsx` → add `/guest` route; add route guard (see Route Topology); keep `/login` as a `/` redirect for link compatibility.
- `src/app/components/Layout.tsx` → verify top-bar state re-renders correctly on every auth transition (reproducer required first); add guest banner slot.
- `src/app/components/settings/sections/AccountSection.tsx` → remove "Get Started" card and `AuthDialog` usage.
- `src/app/components/settings/sections/SyncSection.tsx` → remove `SignedOutSyncCard` and `AuthDialog` usage (route-gating handles the unauth case).
- `src/app/components/settings/sections/PrivacySection.tsx` → remove `SignedOutPrivacyCard` (route-gating handles it).
- `src/app/components/settings/sections/IntegrationsDataSection.tsx` → add `GatedFeatureCard` for guest mode (no existing signed-out path).
- `src/app/components/settings/SettingsPageContext.tsx` → remove `authDialogOpen`, `setAuthDialogOpen`, `authDialogMode`, `setAuthDialogMode`, and the `AuthMode` type export.
- `src/app/components/PremiumGate.tsx` → delete the `showAuthDialog` branch and `AuthDialog` render; the `!user` path is unreachable in the closed app.
- `src/app/components/__tests__/PremiumGate.test.tsx` → update the "opens AuthDialog" test to reflect the new unreachable contract.
- `src/app/components/auth/AuthDialog.tsx` → delete.
- `src/stores/useAuthStore.ts` → add `selectIsGuestMode` selector. **Do not** bake new state into the store; `guestMode` is a sessionStorage derivation.
- `src/lib/settings.ts:228 hydrateSettingsFromSupabase` → minimum fix: replace the over-restrictive `current.displayName === defaults.displayName` guard so Google metadata writes when localStorage is at defaults or empty. Source-of-truth rewrite is a separate story per Risks.
- `src/lib/sync/syncableWrite.ts` + `tableRegistry.ts` → add `guestSessionId` to guest writes.
- `src/lib/sync/backfill.ts` + `hasUnlinkedRecords` / `countUnlinkedRecords` / `clearSyncState` → key off `(userId IS NULL AND guestSessionId = ?)` for the guest→signed-in path. Reuse the existing infrastructure; do not build a parallel system.
- `src/app/components/sync/LinkDataDialog.tsx` → tweak copy for the guest→signed-in narrative.
- `src/app/hooks/useAuthLifecycle.ts` → existing `onUnlinkedDetected` fires; no rewrite needed, confirm it still triggers after the `guestSessionId` filter is added.
- `src/stores/useCourseImportStore.ts` and `src/stores/useYouTubeImportStore.ts` → 1-course cap enforced at the data layer (before `syncableWrite`).
- Audiobook import store and EPUB import store (identify exact store names during planning) → same 1-file cap pattern: row-count check before guest write, with "You've got 1 audiobook already — sign up to add more" modal.
- A new `GatedFeatureCard` component used by Settings integration tabs. Unify `SignedOutSyncCard` and `SignedOutPrivacyCard` into this component as a techdebt follow-up (out of scope for this epic).

**Suggested slicing for planning:**

1. **Hydration guard fix** — minimum fix in `settings.ts:228`. Independent, user-visible, 1-day ship. Includes top-bar "static Sign In" reproducer capture + verification (may be the same bug).
2. **AuthDialog removal** — delete AuthDialog and all four consumers (AccountSection, SyncSection, PremiumGate, SettingsPageContext). Route `/login` → `/`. Kills two redundant modal entry points. Independent of the landing redesign.
3. **Guest selector + route guards** — `selectIsGuestMode`, three-state router (authenticated / guest / anonymous), splash during `!initialized` and OAuth-in-flight, `RETURN_TO_KEY` validation. This is the backbone of the closed app.
4. **Guest shell** — banner with `role="status"`, hidden-in-nav gating, `GatedFeatureCard` component, one consumer in IntegrationsDataSection.
5. **Guest enforcement** — 1-file-per-modality cap: `useCourseImportStore`, `useYouTubeImportStore`, audiobook import store, EPUB import store. `guestSessionId` stamping in `syncableWrite`. Each import store checks its own row count before allowing a guest write.
6. **Guest→signed-in migration** — extend `backfillUserId` / `hasUnlinkedRecords` / `clearSyncState` to filter by `guestSessionId`; tweak `LinkDataDialog` copy.
7. **Landing redesign** — split-screen layout, value prop, responsive breakpoints, WCAG polish, mobile accordion. Design-heavy; ships last; does not block closed-app cut.

**Dropped from the original slicing:**

- Old Slice 8 ("delete anonymous code paths") — dropped as a batch. 60 `!user` call sites span service/sync/entitlement code where the guards are correct defensive logic. Feature-level sites are deleted as part of Slices 2, 3, 4, 6 in-context. Service-layer guards are explicitly out of scope.
- `src/lib/guestMode.ts` as a multi-responsibility module — dropped. Selector lives in `useAuthStore`; course-cap lives with the import stores; migration lives in the existing `backfill` pipeline.

Slices 1 and 2 unblock the user-visible bugs and can ship before the landing redesign (Slice 7) is designed.
