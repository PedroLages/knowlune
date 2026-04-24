---
date: 2026-04-24
topic: app-auth
focus: app auth
---

# Ideation: App Authentication Surface

## Codebase Context

**Project shape.** Knowlune is a React 19 + Vite + TS PWA with a Zustand + Dexie local-first architecture, paired to a self-hosted Supabase (Unraid) for auth and sync. Sync engine is live (E92), LWW across ~26 tables, 4 Storage buckets. Beta launch is imminent — deployed at `knowlune.pedrolages.net`.

**Auth-adjacent code.**
- `src/lib/auth/supabase.ts` — client wrapper
- `src/stores/useAuthStore.ts` — Zustand store with ad-hoc booleans (`initialized`, `sessionExpired`, `_userInitiatedSignOut`) and a substring-matching `mapSupabaseError`
- `src/lib/vaultCredentials.ts` — user-scoped vault with repeated `getUser()` guards
- `src/lib/credentials/` — resolver factory, cache, `credentialStatus`, telemetry, and a rebuild-recovery migration helper
- Active branch `fix/abs-vault-unauth-guard` patches an unauth-access gap in the vault today

**Past learnings.**
- `docs/solutions/2026-04-23-zombie-supabase-session.md` — a known "valid JWT, deleted server-side user" split-brain state. The runbook is manual DevTools paste; auto-heal is explicitly deferred.
- `docs/plans/2026-04-23-001-fix-knowlune-auth-sync-ux-plan.md` — in-flight auth/sync UX fixes surrounding this.
- `docs/solutions/2026-04-23-titan-supabase-migration-apply.md` — confirms Supabase rebuilds are routine; they silently invalidate every session.

**Pain surface.** Silent failures dominate: vault writes return `{ok: false}` and warn to console; resolvers return `null` for four distinct reasons; network/expired/zombie errors funnel through one opaque string; multi-tab state diverges; sync queue 403-cascades on a stale session; pre-auth credential pastes are discarded.

## Ranked Ideas

### 1. Auth Kernel — state machine + error taxonomy + `authedFetch` + event bus

**Description:** Consolidate four infrastructure upgrades into one foundational module:
- Explicit FSM (`uninitialized → anonymous → authenticating → authenticated → stale → expired → signing-out`) replacing the ad-hoc booleans in `useAuthStore`.
- Discriminated `AuthFailure` union (`unauthenticated | zombie-session | expired | network | rate-limited | forbidden | unknown`) replacing `mapSupabaseError`'s substring checks and the three ad-hoc reason strings in `vaultCredentials.ts`.
- `authedFetch` wrapper that gates on FSM state, tags 4xx with a `reason`, auto-triggers `stale` transition on `user_not_found`, and refreshes-then-retries once on generic 401.
- Typed `authEvents` emitter (`signin.attempt`, `session.refreshed`, `zombie.detected`, `vault.unauth_blocked`, …) feeding console/Sentry/PostHog and a dev panel.

**Rationale:** This is the compounding idea — every other survivor (zombie auto-heal, cross-tab sync, sync queue, progress receipts) is a thin consumer of the kernel. It eliminates the 4× duplicated `getUser()` guard in `vaultCredentials.ts`, kills the silent-null-with-four-reasons pattern in `resolverFactory.ts`, and makes every future API integration (Hardcover, ABS, OPDS, AI providers) get correct auth handling for free.
**Downsides:** Largest ticket in this batch; touches every auth-adjacent call site. Needs careful sequencing so partial migration doesn't regress the vault bug the current branch is fixing.
**Confidence:** 90%
**Complexity:** High
**Status:** Unexplored

### 2. Zombie-session auto-heal

**Description:** Dedicated detector module that counts `/auth/v1/user` 403s with `error.code === 'user_not_found'` in a rolling window; at threshold (≥2, or single occurrence on session bootstrap), emits `ZombieSessionDetected`, purges `sb-*` localStorage, signs out locally, and shows a dedicated toast: "Your session is out of date — please sign in again."
**Rationale:** Converts a documented manual runbook into a shipping feature. Beta users have zero tolerance for pasting DevTools snippets. The detection counter is trivial to implement on top of the Auth Kernel event bus.
**Downsides:** Must be sure not to wipe unsynced Dexie data on purge — needs the "export unsynced" escape hatch (idea #6) as a safety net for first release.
**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

### 3. Cross-tab session sync via BroadcastChannel

**Description:** `new BroadcastChannel('knowlune-auth')` — every FSM transition (sign-in, sign-out, refresh, zombie-detected) broadcasts to sibling tabs; other tabs transition their own state machine without reload. Solves "signed in one tab, 403 in another" and prevents tab-split-brain after zombie recovery.
**Rationale:** Beta users keep dashboard + player tabs open simultaneously. Coherence is cheap (≈50 LOC) once the FSM exists. Prevents a whole class of "reload fixes it" support tickets.
**Downsides:** Only works within one browser origin; Safari private-mode quirks. Requires the Auth Kernel to be in place first.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

### 4. Sign-in progress receipts (+ offline-aware sign-in page)

**Description:** Post-OAuth landing becomes a 3-step checklist: "Session established ✓ → Profile loaded ✓ → Sync connected ✓" with live spinners and per-step failure branches that route to the troubleshoot panel. Sign-in form detects `navigator.onLine === false` or a failed Supabase health ping and shows a specific "You're offline — sign-in needs a connection" message instead of the generic network error.
**Rationale:** Beta users currently see a redirect + an avatar change and nothing else when something fails in the hydration fan-out (session → profile → vault → sync). Progress receipts surface exactly which handoff broke. Offline branching is a one-line win for PWA install flows on mobile.
**Downsides:** New UI surface to design; risk of over-engineering the happy-path for a 200ms moment.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 5. Pre-auth credential grace buffer

**Description:** When a user pastes an ABS or AI-provider key while signed out, encrypt and buffer it in Dexie under a device key, show an inline "Will save to your vault when you sign in" notice, and auto-flush on the next `SIGNED_IN` event. Removes the "paste, hit save, silent failure, re-paste after login" cycle that the current `fix/abs-vault-unauth-guard` branch is only partly addressing.
**Rationale:** Directly answers the pain driving the active branch. Small, user-visible win; amplifies the vault's perceived reliability during onboarding.
**Downsides:** Adds a local XSS surface (a device-encrypted secret in Dexie before Supabase vault wrap). Needs the grace buffer to expire and clear itself aggressively if sign-in doesn't happen within N minutes.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored

### 6. Troubleshoot panel in Settings

**Description:** Settings → Troubleshoot tab with buttons: "Reset local session" (runs the zombie-session purge), "Re-link Google," "Export unsynced data before reset" (IDB dump download). Called out from failure branches of the progress receipts (idea #4) and zombie auto-heal (idea #2).
**Rationale:** Safety net for every reset flow. Converts the solutions-doc runbook into a supported UI. Un-blocks shipping the auto-heal without fear of silently wiping unsynced user data.
**Downsides:** Requires a reliable "what's unsynced?" query against the E92 sync queue — cheap to add but needs care.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 7. Auth-aware sync queue (pause / quarantine / replay)

**Description:** Teach the E92 sync engine three FSM-aware behaviors: (a) pause outbound writes when FSM state ≠ `authenticated`; (b) on `stale` transition, move user-scoped queue items to a "quarantine" bin instead of dead-lettering; (c) on next `authenticated` as the same user, replay; as a different user, drop.
**Rationale:** The current `syncQueue` terminal state is `dead-letter` — meaning every mutation queued during a zombie session is effectively lost. Quarantine preserves user intent across the exact failure mode the zombie detector catches.
**Downsides:** Touches E92 sync API; needs the Auth Kernel FSM and session-scoped keys to be in place. Highest coupling in this batch.
**Confidence:** 70%
**Complexity:** High
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Auth health beacon (navbar chip) | UI noise for an ambient state already surfaced by progress receipts + error taxonomy |
| 2 | QR / magic-link device pairing | Novel but post-beta scope; magic-link email path is sufficient for launch |
| 3 | Proactive token-refresh scheduler | Supabase SDK handles silent refresh; wrapper in Auth Kernel catches the failure modes |
| 4 | First-run "set a recovery method" nudge | Onboarding concern, not auth architecture |
| 5 | Remove login-as-gate (local-first-only shell) | Contradicts beta's sync-first positioning; conflicts with entitlements roadmap |
| 6 | Unify session + vault key via HKDF from JWT | Crypto blast radius too high; JWT rotation would brick decryption |
| 7 | Passkey-first sign-up | Self-hosted Supabase WebAuthn maturity uncertain for beta window |
| 8 | Auto-migrate vault on Supabase rebuild | Rare event; solutions-doc runbook acceptable |
| 9 | Remove `/login` route entirely | Aesthetic refactor with no measured user pain |
| 10 | Resolver circuit breaker on auth health probe | Subsumed by Auth Kernel's `authedFetch` |
| 11 | Vault DEK rotation on every sign-out | Crypto complexity without clear user demand |
| 12 | URL-as-identity (bookmarkable sign-in) | Undermines Supabase investment and multi-device story |
| 13 | Abuse-resistant login (Turnstile / rate-limit) | Real need but infra (Cloudflare), not an app-code ideation item |
| 14 | Sentry/PostHog identity binding | Trivial once Sentry lands; falls out of Auth Kernel event bus naturally |
| 15 | E2E `authAs(state)` fixture | Testing infra — comes for free once the FSM exposes transitions |
| 16 | Post-signin vault probe | Subsumed by progress receipts (idea #4) |
| 17 | Entitlements via JWT claims | Speculative pre-entitlements-infra; deserves its own ideation pass |
| 18 | Session-bound cache namespacing | Bold; depends entirely on Auth Kernel landing first — revisit after #1 |
| 19 | Recovery method nudge after sign-up | Onboarding concern, not ideation-worthy on its own |

## Session Log

- 2026-04-24: Initial ideation — 33 raw candidates across 3 frames (friction, inversion/removal, reliability/leverage), 7 survived after dedupe + 2-pass adversarial filter. Focus: app auth surface, beta-launch-relevant.
