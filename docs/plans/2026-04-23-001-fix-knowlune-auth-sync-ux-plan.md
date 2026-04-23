---
title: Fix Knowlune auth + sync UX end-to-end
type: fix
status: active
date: 2026-04-23
---

# Fix Knowlune auth + sync UX end-to-end

## Context

Sign-in works technically but has three broken layers simultaneously: (1) Pedro's current browser session holds a zombie JWT whose `sub` UUID no longer exists in titan's `auth.users` — every `/auth/v1/user` call returns 403, every vault write fails, every sync query fails; (2) titan's self-hosted Supabase is missing ~19 migrations — the sync engine logs 30+ `table not found in schema cache` errors and `column study_sessions.updated_at does not exist`; (3) the user experience is opaque — after OAuth the navbar still shows "Sign In", the Sync settings panel renders blank, and there's no visible confirmation a sign-in succeeded.

Layers (1) and (2) are **data/infra** fixes, not code. Layer (3) includes real UX improvements (Google avatar in Settings → Profile, auth-gated rendering of Sync page with a helpful signed-out state) plus validation that the existing Layout header + AvatarImage already handle the auth state change — but currently look broken because the zombie session keeps `useAuthStore.user` populated with a phantom user whose JWT lookups all 403.

**Intended outcome:** After this plan, a fresh sign-up via Google on titan's Supabase:
- Shows the user's Google avatar + display name in the navbar avatar dropdown
- Persists the ABS API key to the Supabase vault so streaming, sync, collections, and series all work
- Renders a useful Sync Settings panel regardless of sign-in state (explains what sync does when signed out; shows controls when signed in)
- Successfully syncs the 19 Knowlune app tables without schema-cache errors

## Problem Frame

Three independent failure modes compound to produce the symptom "nothing works after I sign in":

1. **Zombie client session** — Browser holds a valid-looking JWT from a prior Supabase instance where Pedro's user row existed. Titan's current `auth.users` has no matching row, so `getUser()` returns 403 `user_not_found` on every request. Downstream: `useAuthStore.user` is set (from stale session), UI renders as "signed in", but every authenticated API call fails silently.

2. **Supabase schema drift on titan** — The Knowlune repo has 19 migrations at [supabase/migrations/](supabase/migrations/), ending at `20260427000002_p4_sync.sql`. Titan's DB only has the auth.users schema + whatever early migrations were applied. The sync engine's `fetchSince` pulls from all `tableRegistry` entries; 30+ tables return `PGRST205` / `PGRST204` (table not found, column not found).

3. **UX gaps** —
   - `SyncSection` returns `null` when signed out → page appears completely blank instead of showing "Sign in to enable cloud sync"
   - Google avatar hydration exists at [src/lib/settings.ts:244-252](src/lib/settings.ts#L244-L252) but only runs on `SIGNED_IN`/`INITIAL_SESSION` and writes to localStorage — if the zombie session blocks hydration, avatar never appears
   - The navbar `Sign In` button / avatar-dropdown swap at [Layout.tsx:615-697](src/app/components/Layout.tsx#L615-L697) already works correctly; the user's perception of it being broken stems from the zombie session (user.id exists but email/avatar fail to load cleanly)
   - ABS credential save fails silently because vault writes need a valid JWT → already partially mitigated by the toast commit `1cdfa534`, but the root cause (no valid session) remains

## Requirements Trace

- **R1.** Pedro's zombie Supabase session is cleared; fresh Google sign-in on titan creates a valid auth.users row and a valid JWT.
- **R2.** All 19 Knowlune migrations are applied to titan's Supabase; the sync engine logs zero `PGRST205`/`PGRST204` errors for the Knowlune table set.
- **R3.** After Google sign-in, the navbar avatar-dropdown shows the user's Google profile photo + display name; the "Sign In" button is never visible while signed in.
- **R4.** Settings → Sync renders a useful, non-empty panel in both signed-in and signed-out states.
- **R5.** Settings → Profile shows the Google avatar URL and exposes a clear way to confirm authentication (signed in as X).
- **R6.** Settings → Integrations & Data → Audiobookshelf: re-entering the supplied API key at `http://192.168.2.200:13378` persists successfully; streaming, sync, collections, and series all work.
- **R7.** No silent failures during the sign-in → ABS connect → first sync flow; every error surfaces via toast.

## Scope Boundaries

- **In scope:** titan-side migration application, browser zombie-session cleanup helper, SyncSection signed-out state, Profile avatar affordance, Playwright validation of full flow, ABS reconnect verification.
- **Out of scope:** Redesigning the auth dialog flow itself — [Login.tsx](src/app/pages/Login.tsx) already has a polished standalone page. Reworking the Layout header (already correct). Supabase vault broker changes (already working when JWT is valid).

### Deferred to Separate Tasks

- Automatic zombie-session detection + self-heal: Future epic (requires detecting 403 `user_not_found` from `getUser()` and triggering `signOut()` + localStorage purge). This plan ships a one-time DevTools script; durable self-heal is a follow-up.
- Rolling out full sync for new P3/P4 tables on clean Supabase instances with seed data: covered by E95+E96 epics already in the backlog.

## Context & Research

### Relevant Code and Patterns

- **Navbar auth rendering:** [src/app/components/Layout.tsx:615-697](src/app/components/Layout.tsx#L615-L697) — Conditional `authUser ? <DropdownMenu>... : <Button>Sign In</Button>`. Avatar uses `settings.profilePhotoUrl` (hydrated from user_metadata.avatar_url).
- **Login page:** [src/app/pages/Login.tsx](src/app/pages/Login.tsx) — Standalone route at `/login`, has email/magic-link/Google tabs + sign-in/sign-up toggle.
- **Auth dialog (in Settings):** [src/app/components/auth/AuthDialog.tsx](src/app/components/auth/AuthDialog.tsx) — Same tabs, embedded in AccountSection for signed-out users.
- **Auth lifecycle:** [src/app/hooks/useAuthLifecycle.ts:198-220](src/app/hooks/useAuthLifecycle.ts#L198-L220) — Hydrates settings from user_metadata on SIGNED_IN / INITIAL_SESSION.
- **Google avatar hydration:** [src/lib/settings.ts:244-252](src/lib/settings.ts#L244-L252) — Reads `user_metadata.avatar_url` or `picture`, writes to `profilePhotoUrl`.
- **Sync settings panel:** [src/app/components/settings/sections/SyncSection.tsx](src/app/components/settings/sections/SyncSection.tsx) — Full implementation, returns `null` when signed out (line 239).
- **Supabase migrations:** [supabase/migrations/](supabase/migrations/) — 19 files, chronological, include both schema + RLS.

### Institutional Learnings

- Per memory `reference_supabase_unraid.md`: titan URL is `https://supabase.pedrolages.net` (prod) or `http://titan.local:8000` (dev); the anon key may differ between envs.
- Per memory `project_supabase_sync_design.md`: LWW sync across 26 tables + 4 Storage buckets via `tableRegistry`. Schema mismatches surface as PGRST errors in sync.
- Per memory `reference_sync_engine_api.md`: P0 stores wired in E92-S09. P3/P4 stores wired in E96-S02.

### External References

- Supabase 2026 Google OAuth guide: `https://supabase.com/docs/guides/auth/social-login/auth-google`
- Supabase self-hosted migration: `supabase db push` CLI with `--db-url` flag targeting the titan instance.

## Key Technical Decisions

- **Apply migrations via psql on titan (not supabase CLI)** — The titan box runs the Supabase stack in Docker; easier to `docker exec supabase-db psql` with the migration files mounted/copied, vs configuring the CLI to talk to a self-hosted instance with custom TLS. User to confirm before executing any write.
- **Zombie session cleanup is a one-shot user action, not a code change** — We provide the DevTools snippet; adding detection logic to production would require deciding when to force sign-out (false positives are dangerous). Defer durable fix.
- **SyncSection signed-out state is a small, additive render branch** — Replace `if (!user) return null` with an informational card that explains sync + CTA to sign in. Keeps the signed-in UI untouched.
- **Profile avatar visibility is already working in the header** — The user's "no indication of sign-in" report is likely the zombie session confusing things; validate with Playwright after Problem A fix before adding more UI affordances.

## Open Questions

### Resolved During Planning

- **Can we hit titan's postgres directly?** — User memory warns `docker exec psql` is blocked by the safety guardrail; ask Pedro before every DB-write command.
- **Are the migrations idempotent?** — Most use `CREATE TABLE IF NOT EXISTS` / `CREATE POLICY IF NOT EXISTS`. The older `001_entitlements.sql` / `002_calendar_tokens.sql` may not be — verify before apply.

### Deferred to Implementation

- Exact migration apply order if any have already partially run — will check titan's `schema_migrations` (or equivalent) table once we can connect.
- Whether `user_metadata.picture` vs `avatar_url` needs different handling for titan's GoTrue version — test with real Google sign-in.

## Implementation Units

- [ ] **Unit 1: Zombie session cleanup + fresh Google sign-in (Problem A)**

**Goal:** Clear Pedro's browser of the orphaned JWT, confirm a fresh Google sign-in against titan produces a valid session with user_metadata populated.

**Requirements:** R1, R3, R5

**Dependencies:** None (pure client-side + user action)

**Files:**
- No code changes — walkthrough in plan only.

**Approach:**
- Provide the exact DevTools console snippet (from user's brief).
- After cleanup: sign in with Google, verify `supabase.auth.getUser()` returns 200 with a `user_metadata.avatar_url` or `picture`.
- Verify navbar avatar shows Google photo; settings.profilePhotoUrl is populated.

**Verification:**
- `(await supabase.auth.getUser()).data.user` returns a real user (no 403).
- Navbar top-right shows the avatar image (not the Sign In button).

- [ ] **Unit 2: Apply Knowlune migrations to titan (Problem B)**

**Goal:** Apply all 19 migrations in chronological order to titan's Supabase so the sync engine stops throwing PGRST205/PGRST204.

**Requirements:** R2, R6

**Dependencies:** Unit 1 (fresh session required to verify downstream)

**Files:**
- No repo changes. Read-only use of [supabase/migrations/](supabase/migrations/).

**Approach:**
- SSH titan → verify current Supabase schema state (`\dt public.*` to list existing Knowlune tables) — user must confirm before DB query.
- Compare against expected table list from the 19 migration files.
- Apply missing migrations in chronological order via `docker exec -i supabase-db psql -U postgres -d postgres < migration.sql`.
- After each phase (P0, P1, P2, P3, P4), reload PostgREST schema cache: `docker exec supabase-kong` or restart PostgREST container.
- Validate zero schema errors in the running Knowlune app's console.

**Verification:**
- All 34 tables listed in user's bug report exist in `public.*` on titan.
- `study_sessions.updated_at` column exists.
- Knowlune app console: zero `PGRST205`/`PGRST204` errors during a `/sync/fullSync`.

- [ ] **Unit 3: SyncSection signed-out empty state**

**Goal:** Replace the `return null` in SyncSection with a friendly card explaining what cloud sync does and CTA to sign in. Fixes R4.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: [src/app/components/settings/sections/SyncSection.tsx](src/app/components/settings/sections/SyncSection.tsx) (line 239 auth gate)
- Test: [src/app/components/settings/sections/__tests__/SyncSection.test.tsx](src/app/components/settings/sections/__tests__/SyncSection.test.tsx)

**Approach:**
- When `!user`: render a card with Cloud icon + headline "Cloud Sync (sign in to enable)" + body explaining cross-device sync + Sign In / Sign Up buttons wiring into `useSettingsPage` auth dialog.
- Use the same `AuthDialog` pattern as AccountSection for consistency.
- Signed-in path: unchanged.

**Patterns to follow:**
- AccountSection's signed-out card at [AccountSection.tsx:26-67](src/app/components/settings/sections/AccountSection.tsx#L26-L67).

**Test scenarios:**
- Happy path: when `!user`, renders Sign In / Sign Up buttons with explanatory text.
- Happy path: when `user` present, renders the existing sync UI (regression).
- Integration: clicking Sign In opens the auth dialog via SettingsPageContext.

**Verification:**
- Navigate to Settings → Sync while signed out → panel shows an informative, non-empty card.
- Sign in → panel swaps to the existing sync controls (auto-sync, Sync Now, danger zone).

- [ ] **Unit 4: Profile avatar affordance + verify Google avatar flow**

**Goal:** Make the "I'm signed in" signal obvious — surface Google avatar in the Profile section (currently uses localStorage settings). Verify the existing hydration path end-to-end.

**Requirements:** R3, R5

**Dependencies:** Unit 1 (valid session)

**Files:**
- Verify-only (no edits expected): [src/app/components/settings/sections/ProfileSection.tsx](src/app/components/settings/sections/ProfileSection.tsx)
- Verify: [src/lib/settings.ts:244-252](src/lib/settings.ts#L244-L252) (Google avatar hydration)
- Only edit if validation shows a gap.

**Approach:**
- With Playwright: sign in with Google → navigate to Settings → Profile → assert avatar `<img>` has `src` starting with `https://lh3.googleusercontent.com/` (Google avatar CDN) OR a valid Google-hosted URL.
- If avatar is missing but `user_metadata.avatar_url` is present, debug hydration; likely edit would be forcing hydration to overwrite defaults on first sign-in.
- No speculative edits.

**Test scenarios:**
- Integration (Playwright): Google sign-in → navbar avatar image src matches user_metadata.avatar_url.
- Integration (Playwright): Settings → Profile shows the same avatar with the user's Google display name.

**Verification:**
- Screenshot of signed-in navbar shows Google photo.
- Screenshot of Settings → Profile shows Google display name + avatar.

- [ ] **Unit 5: ABS API key re-save + end-to-end verification**

**Goal:** Re-enter the supplied ABS API key, confirm vault write succeeds, confirm streaming + sync + collections + series all work.

**Requirements:** R6, R7

**Dependencies:** Unit 1 + Unit 2 (valid JWT + migrations for abs-linked tables)

**Files:**
- Verify-only: [src/app/hooks/useAudiobookshelfSync.ts](src/app/hooks/useAudiobookshelfSync.ts) (fix 1cdfa534 already in).
- Only touch if validation reveals regression.

**Approach:**
- Settings → Integrations & Data → Audiobookshelf → Edit → paste URL `http://192.168.2.200:13378` + API key (provided in brief).
- Save → verify vault write success via toast + server row status becomes `connected` (green dot).
- Trigger a manual sync → confirm books appear and no 401s in console.
- Open a book → confirm streaming plays.

**Test scenarios:**
- Integration (Playwright): paste key → toast "Saved" appears, red-dot status turns green.
- Integration: Library page shows ABS-imported audiobooks.

**Verification:**
- Audiobookshelf section shows connected server with green indicator.
- Sync button succeeds without `403 user_not_found`.

- [ ] **Unit 6: Full-flow Playwright validation + granular commits**

**Goal:** Record the end-to-end happy path and lock it with a smoke test. Granular commits per Unit.

**Requirements:** All

**Dependencies:** Units 1–5

**Files:**
- New: Playwright script (may be ad-hoc for validation; if we add a spec, place under `tests/e2e/auth-sync-smoke.spec.ts` using existing patterns).

**Approach:**
- Playwright MCP: open `http://localhost:5173`, verify navbar starts with "Sign In" (signed-out state).
- Navigate to /login, click Google (or use magic-link for deterministic e2e), verify nav swaps to avatar dropdown.
- Navigate to Settings → Sync (signed-in + signed-out states).
- Commit each Unit separately with `feat(...)` / `fix(...)` prefix + E## reference.

**Verification:**
- Playwright recording shows a clean, narrated flow from signed-out → signed-in → sync visible → ABS connected.

## System-Wide Impact

- **Interaction graph:** Auth state feeds Layout header, SyncSection, AccountSection, ProfileSection, `useSyncLifecycle`, `useAuthLifecycle`. All read from `useAuthStore`.
- **Error propagation:** Vault writes return 403 when JWT user doesn't exist — Unit 1 fixes at root. Sync returns PGRST errors when schema drift — Unit 2 fixes at root.
- **State lifecycle risks:** Clearing localStorage in Unit 1 wipes unsynced Knowlune data on this device. Acceptable — user already has dev workflow backed up by git.
- **Unchanged invariants:** Layout header auth UI at [Layout.tsx:615-697](src/app/components/Layout.tsx#L615-L697) is correct and remains untouched. AuthDialog + Login page unchanged. Vault broker and ABS proxy unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Migration apply partially fails mid-way on titan | Apply phase-by-phase (P0 → P1 → P2 → P3 → P4); if a phase fails, stop and inspect before continuing. Rollback SQL exists under [supabase/migrations/rollback/](supabase/migrations/rollback/). |
| Titan's GoTrue returns `avatar_url` vs `picture` in a different shape | Existing [settings.ts:248](src/lib/settings.ts#L248) handles both. If neither present, log user_metadata to console + adjust. |
| Google OAuth redirect URL not whitelisted in titan's GoTrue | Add `https://knowlune.pedrolages.net` + `http://localhost:5173` to GoTrue `ADDITIONAL_REDIRECT_URLS` env var; restart supabase-auth container. |
| Dirty working tree (untracked brainstorm/plan files visible in git status) | User likely has these intentionally — do not auto-clean. Commit plan file alone first. |

## Documentation / Operational Notes

- User memory `reference_supabase_unraid.md` may need update after confirming titan's current state (migrations applied, redirect URLs configured).
- Consider adding `docs/solutions/2026-04-23-zombie-supabase-session.md` after Unit 1 to document the DevTools snippet for future devs.

## Sources & References

- User-provided context (conversation above): zombie session symptoms, schema drift errors, ABS credentials.
- Related memories: `reference_supabase_unraid.md`, `project_supabase_sync_design.md`, `reference_sync_engine_api.md`.
- Recent commit: `1cdfa534 fix(abs): surface missing API key with toast + auth-failed status`.
