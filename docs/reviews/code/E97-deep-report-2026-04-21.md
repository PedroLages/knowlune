---
title: "E97 Sync UX Polish — Deep Report"
epic: E97
type: deep-report
date: 2026-04-21
author: Claude Sonnet 4.6 (1M context)
---

# E97 Sync UX Polish — Deep Report

## Executive Summary

Epic E97 delivered the complete user-facing sync UX layer on top of the E92–E96 sync engine: a persistent header status indicator, a settings panel with pause/resume/reset controls, a first-time upload wizard for existing-device users, a download overlay for new-device sign-ins, and a credential setup banner that surfaces missing Vault-side API keys. All five stories shipped across PRs #381–#385, requiring 2–3 review rounds per story — slightly above the target of 1–2. Quality is high with no BLOCKER findings in the final merged state; the primary risk areas are thin E2E coverage on edge flows (deep-link focus chain, engine-watcher fast-path, AC6 banner re-appear) and 16 open low-severity known issues that were all triaged and deferred to future epics. The architectural foundation — snapshot-on-mount polling, observational store bridges, and a localStorage-keyed gate pattern — is well-established and reusable.

---

## Stories Shipped

| Story | Title | PR | Review Rounds | Status |
|---|---|---|---|---|
| E97-S01 | Sync Status Indicator in Header | #381 | 3 | Merged |
| E97-S02 | Sync Settings Panel | #382 | 2 | Merged |
| E97-S03 | Initial Upload Wizard | #383 | 1 | Merged |
| E97-S04 | New Device Download Experience | #385 | 2 | Merged |
| E97-S05 | Credential Sync UX for External Services | (last) | 1 (+ 4 deferred findings) | Merged |

---

## Known Issues (Open)

All 16 known issues are severity `low` with `status: open` and `decision: schedule-future`. They are grouped by story below.

### E97-S01

| ID | Summary | Recommended Action |
|---|---|---|
| KI-E97-S01-L01 | Live region silent on sync recovery (`error → synced`); screen-reader users do not receive confirmation that a retry succeeded. | Add a one-shot `aria-live` announcement in the Retry success path of `SyncStatusIndicator`. Small targeted fix. |
| KI-E97-S01-L02 | Reduced-motion test asserts absence of `animate-spin` but not presence of the `Cloud` icon fallback. Test could pass with any static substitution. | Tighten the assertion: also check `data-testid="cloud-icon-static"` (or equivalent) is rendered when reduced-motion is active. |
| KI-E97-S01-L03 | Pre-existing silent-catch warnings at `useSyncLifecycle.ts:172/220/268` (not introduced by E97-S01). | Address in a dedicated maintenance chore alongside the `icalFeedGenerator.js` lint debt (see Pre-Existing Issues). |

### E97-S02

| ID | Summary | Recommended Action |
|---|---|---|
| KI-E97-S02-L01 | `handleSyncNow` `useCallback` missing `user.id` dependency — future edits could capture stale ref. | Add `user.id` to the deps array or document why it's intentionally omitted via a `// eslint-disable-next-line` comment with justification. |
| KI-E97-S02-L02 | `window.__syncEngine__` shims in E2E may silently no-op if the global is not exposed. Mock injection unverified at runtime. | Add a guard assertion at spec setup: `expect(await page.evaluate(() => typeof window.__syncEngine__)).not.toBe('undefined')`. |
| KI-E97-S02-L03 | Sync nav entry visible to signed-out users; selecting it renders an empty pane. | Either hide the nav entry when `user === null` or render a signed-in prompt inside `SyncSection` (the component already returns `null` — the issue is the nav entry still appears). |
| KI-E97-S02-L04 | `computeTotalSyncedItems` runs `Promise.all(count())` across all tables on every `lastSyncAt` change (every 30s). Could be slow on large DBs. | Debounce or memoize: only recompute after `markSyncComplete`, not on every change. |

### E97-S03

| ID | Summary | Recommended Action |
|---|---|---|
| KI-E97-S03-L01 | `suppressErrorUntilSyncingRef` never clears if `fullSync()` rejects before transitioning to `'syncing'`, leaving the wizard potentially stuck in `'uploading'`. | Add a `finally` block in the Retry handler that clears the ref. |
| KI-E97-S03-L02 | `computeUnlinkedCount` runs a full `.filter()` scan per table on every snapshot — may compound snapshot race on low-end devices. | Index `userId` column in Dexie and use `where('userId').equals(userId).count()` instead. |
| KI-E97-S03-L03 | `story-97-03.spec.ts` uses `page.waitForTimeout(500)` without a justification comment — violates `test-patterns/no-hard-waits`. | Replace with `waitForFunction(() => document.querySelector('[data-phase="uploading"]') !== null)` or document with `// Intentional: waiting for animation`. |

### E97-S04

| ID | Summary | Recommended Action |
|---|---|---|
| KI-E97-S04-L01 | Auto-close effect deps include inline `onClose` prop — the 250ms timer resets on every parent re-render. | Wrap `onClose` in `useCallback` at the call site in `App.tsx`, or use `useRef` inside the component to stabilize the reference. |
| KI-E97-S04-L02 | `WATCHDOG_MS` is hard-coded at 60 000ms — requires expensive fake-timer advances in tests; acceptance as prop with default would help testability. | Accept as `watchdogMs?: number` prop (default 60000). Call sites pass the constant. |
| KI-E97-S04-L03 | Engine watcher operates during `'hydrating-p3p4'` phase — broader than the plan specifies (should only be active during Phase B, `'downloading-p0p2'`). | Tighten the watcher's subscription guard: check `useDownloadStatusStore.getState().status === 'downloading-p0p2'` before acting on engine state transitions. |
| KI-E97-S04-L04 | `__mockHeadCounts` scalar shim cannot simulate per-table partial HEAD failures in E2E. | Expand shim to a `Record<string, number | null>` map where `null` means the HEAD request failed for that table. |
| KI-E97-S04-L05 | `observedHydrate` re-throws after `failDownloading` — potential duplicate error surfacing on rapid retries. | Guard with a ref flag: if `failDownloading` has already been called, suppress the re-throw (or swallow the second `failDownloading` call idempotently). |

---

## Deferred Review Findings

These findings were raised in review rounds and explicitly deferred (not fixed in the current merged PRs).

### E97-S05 — R1 Deferred (not fixed)

| ID | Severity | File | Description | Recommended Fix |
|---|---|---|---|---|
| R1-M1 | Medium | `src/app/components/sync/CredentialSetupBanner.tsx` + test | AC6 banner-reappear unit test missing. The `missing.length 0 → N` transition that clears the `sessionStorage` dismissal flag has no unit test — only the E2E spec covers it. | Add a focused RTL test: mount with `missing=[]`, then update to `missing=[entry]`, assert `sessionStorage.getItem(key)` returns null. |
| R1-M2 | Medium | `tests/e2e/story-e97-s05-credential-sync-ux.spec.ts` | `waitForTimeout(500)` present in the E2E spec without a justification comment, violating `test-patterns/no-hard-waits`. | Replace with `page.waitForSelector('[data-testid="credential-banner"]')` or add `// Intentional: dialog animation settle` comment. |
| R1-M3 | Medium | E2E spec (story-e97-s05) | E2E coverage thin on three edge flows: (1) deep-link `?focus=opds:id` focus chain when dialog is already open, (2) popover content rendered by the "Why?" button, (3) `CustomEvent` dispatch chain from banner through Library to dialog open. | Add three targeted E2E assertions: one for each flow. They can be short append-only tests on the existing spec file. |
| R1-L1 | Low | `src/app/components/library/CatalogForm.tsx` | Unnecessary `internalPasswordRef` allocation — a `useRef` is created and populated but never actually used for focus (the focus is driven by the external `passwordInputRef` forwarded prop). | Remove `internalPasswordRef`; use the forwarded ref directly in the existing focus effect. |
| R1-L3 | Low | `src/app/components/sync/CredentialSyncStatusBadge.tsx` | `role='img'` on the badge wrapper when `showLabel=true` is redundant — the text label provides the accessible name, so the implicit ARIA role of the wrapping element already covers it. | Remove `role='img'` when `showLabel === true`; keep it (or use `aria-label`) when `showLabel === false`. |
| R1-L4 | Low | `src/app/App.tsx` | `eslint-disable` comment formatting is inconsistent with the project convention (inline vs block comment style). | Align with existing `// eslint-disable-next-line` single-line style used elsewhere in the file. |
| R1-M4 | Medium | `src/app/hooks/useDeepLinkFocus.ts` | `useDeepLinkFocus` fires the `onFocus` callback even when its host dialog is closed (edge case: user navigates to Library with `?focus=opds:id` without the credential banner prompting the dialog open). | Add a guard prop `enabled?: boolean`; only consume the `?focus` param when `enabled === true`. |

---

## Pre-Existing Issues (Baseline Debt)

These issues were discovered during E97 reviews but were not introduced by E97.

| Issue | File(s) | Severity | Notes |
|---|---|---|---|
| 10 `no-undef` ESLint errors | `src/lib/icalFeedGenerator.js`, `src/lib/ssrfProtection.js` | Low | Plain-JS files using browser globals without `/* global */` annotations or a `browser: true` ESLint env. Not blocking but noisy. Fix: add `/* global self, fetch, ... */` headers or convert to TypeScript. |
| Silent-catch warnings at `useSyncLifecycle.ts:172/220/268` | `src/app/hooks/useSyncLifecycle.ts` | Low | Pre-existing catch blocks that suppress errors without user notification. Flagged as KI-E97-S01-L03. Matches `error-handling/no-silent-catch` rule. |

---

## Architectural Concerns

### 1. Polling Architecture — Cumulative Timer Load

E97 introduced three independent polling loops:
- `useSyncLifecycle` — 30s nudge interval (pre-existing)
- `useInitialUploadProgress` (S03) — 500ms `syncQueue` poll while wizard is open
- `useDownloadProgress` (S04) — 500ms Dexie poll while overlay is open
- `useMissingCredentials` (S05) — 120s Edge-Function poll while tab is visible

Each is individually justified and bounded. However, the cumulative picture should be revisited if a user lands simultaneously in a slow-restore + credential-check state (e.g., new device sign-in). The 500ms loops are bounded to wizard/overlay lifetime, which is good. The 30s sync nudge and 120s credential poll are permanent once signed in. On low-end mobile devices this could contribute to CPU wake patterns.

**Recommendation:** Add a shared `usePollingBudget` hook or a simple Zustand-based slot manager in a future story so polling-heavy features can yield to each other gracefully. Not urgent — the current design is sound within its intended load envelope.

### 2. ARIA Live Region Strategy

E97 uses `aria-live="polite"` on three distinct components (`SyncStatusIndicator`, `InitialUploadWizard`, `CredentialSetupBanner`). When all three are mounted simultaneously (e.g., during a credential-missing new-device restore), screen readers will receive overlapping announcements.

**Recommendation:** Adopt a single app-level live-region slot (a hidden `<div aria-live="polite">` managed by a small hook). Producers write messages to it in priority order: error > warning > info. This is a low-effort architectural improvement for a future accessibility story.

### 3. CustomEvent Dispatch Chain (S05)

The OPDS/ABS "Re-enter" deep-link flow uses a `CustomEvent('open-opds-settings')` dispatched from `CredentialSetupBanner` and consumed by `Library.tsx`, which then sets `?focus=opds:<id>` for `useDeepLinkFocus` inside the dialog. This is a three-hop chain (banner → Library → dialog), which is difficult to test and debug. R1-M3 (deferred) calls this out specifically.

**Recommendation:** Consider collapsing to a direct state lift: expose an `openCatalogEdit(id: string)` callback from `Library.tsx` via a Zustand action or context, and have `App.tsx` store state instead of dispatching a custom event. This would reduce the chain to two hops and make the flow directly unit-testable.

### 4. App.tsx Floating UI Accumulation

`App.tsx` now mounts five root-level floating components: `LinkDataDialog`, `InitialUploadWizard`, `NewDeviceDownloadOverlay`, `CredentialSetupBanner`, plus the existing `Toaster`. Each adds conditional rendering logic and state to `App.tsx`, which is becoming a coordinator for the entire onboarding + sync UX layer.

**Recommendation:** Extract a `<SyncUXShell>` component that owns all five of these mounts and the evaluation logic for each. This keeps `App.tsx` as a routing shell and moves the sync UX coordination to a dedicated component. Ideal for a future maintenance chore before E98.

---

## Suggested Improvements

These are enhancements for future epics — not bugs, not deferred findings.

1. **Batch `checkCredential` endpoint (S05 debt):** As OPDS and ABS catalogs grow, the N+M parallel `checkCredential` Edge-Function calls will multiply. The S05 plan explicitly deferred this. Budget: 8 calls/120s is fine for typical users; for power users with 10+ catalogs, add a batch endpoint to the `vault-credentials` Edge Function.

2. **Cross-tab sync status via `BroadcastChannel` (S01 debt):** The S01 plan deferred BroadcastChannel fan-out. If a user has multiple Knowlune tabs open, the header indicator in idle tabs shows stale state. At beta scale this is cosmetic, but for power users it creates confusion when a retry in one tab doesn't update another.

3. **"Paused" visual state for auto-sync toggle (S02 gap):** When `autoSyncEnabled === false`, the header indicator continues showing `synced` with no visual signal that sync is intentionally paused. KI-E97-S02-L03 touches on this. Add a `paused` status to `useSyncStatusStore` to reflect this state.

4. **Promote "Local only" AI keys to Vault (S05 debt):** Currently, users with local-only AI keys must delete and re-enter them to move to Vault. S05 deferred a one-click "promote" action. A small UX addition to `ProviderKeyAccordion` (a "Sync to Vault" button that calls `storeCredential`) would complete the credential sync story.

5. **`liveQuery` subscription for progress hooks (S03/S04):** Both `useInitialUploadProgress` and `useDownloadProgress` use 500ms polling timers. Dexie 4's `liveQuery` observable would eliminate polling jitter and remove the `setInterval` cleanup complexity. Consider as a future perf/quality chore.

6. **Per-user `sync:wizard:complete` flag cross-device sync:** The S03 plan explicitly deferred persisting the wizard completion flag across devices. Once Supabase's `user_settings` JSONB column is wired, this flag should be stored server-side so that re-installing the app on the same device doesn't re-trigger the wizard.

---

## Patterns Established in E97

These patterns are reusable across future epics and should be considered canonical.

### 1. Snapshot-on-Mount Poll Pattern

Introduced in S03 (`useInitialUploadProgress`) and mirrored in S04 (`useDownloadProgress`):
- Capture `total` once at mount via a ref (`totalRef.current`)
- Poll `current` every 500ms, derive `processed = clamp(total - current, 0, total)`
- This avoids the "moving denominator" UX regression where new items enqueued mid-sync cause the progress bar to regress

**File references:** `src/app/hooks/useInitialUploadProgress.ts`, `src/app/hooks/useDownloadProgress.ts`

### 2. Observational Store Bridge Pattern

Introduced in S04 (`useDownloadEngineWatcher`): a hook that subscribes to an existing store (`useSyncStatusStore`) and drives state in a second store (`useDownloadStatusStore`) without touching the engine's API. Key invariants:
- Never writes to the observed store
- Uses `firstSyncingSeenRef` to latch first-time transitions (avoids false positives from pre-signin state)
- Unsubscribes on disable/unmount

**File reference:** `src/app/hooks/useDownloadEngineWatcher.ts`

### 3. localStorage-Keyed Gate Pattern (Extending E92)

E92-S08 established `sync:linked:<userId>` as the per-user localStorage key prefix. E97 extends this:
- `sync:wizard:complete:<userId>` — permanent completion flag
- `sync:wizard:dismissed:<userId>` — session-scoped dismissal, cleared on sign-out
- `knowlune:credential-banner-dismissed:<userId>` — session-scoped dismissal, cleared on missing 0→N transition

**Rule:** Per-user keys use `:<userId>` suffix. Completion flags are permanent. Dismissal flags are session-scoped (cleared on sign-out or on condition re-trigger). Never clear completion flags on sign-out.

### 4. Credentialled Aggregate Status Pattern (S05)

The `aggregateCredentialStatus` pure module separates status computation (async, testable) from the React hook (`useMissingCredentials`) that subscribes to data sources and drives lifecycle. Three tiers of freshness:
- Event-driven (immediate, free): Zustand store changes, `ai-configuration-updated` event
- Visibility-gated poll (120s while visible, 0 while hidden): bounds Edge-Function spend
- One-shot on visibility resume: prevents stale state after tab re-focus

**File references:** `src/lib/credentials/credentialStatus.ts`, `src/app/hooks/useMissingCredentials.ts`

### 5. Two-Phase Overlay Lifecycle Pattern (S04)

For operations that span two async phases (hydrate then engine sync), the correct pattern is:
- Phase A store state drives UI ("Restoring library…")
- `observedHydrate` wrapper transitions store on resolve/reject
- Separate `useDownloadEngineWatcher` hook handles Phase B completion signal
- 2s deferred mount short-circuits the overlay if both phases complete within 2s (no flash)
- 60s watchdog forces error transition if either phase hangs

**File references:** `src/lib/sync/observedHydrate.ts`, `src/app/hooks/useDownloadEngineWatcher.ts`, `src/app/components/sync/NewDeviceDownloadOverlay.tsx`

### 6. Separate Deep-Link Hooks by Domain

E97-S05 explicitly chose NOT to extend the existing `useDeepLinkEffects` hook (lesson-player scoped) and instead created `useDeepLinkFocus` (cross-feature settings navigation). The split rationale is documented in the plan and as JSDoc in the hook file. The discriminator: "fires once per URL token and clears" (navigation) vs "re-fires on param change" (seek semantics).

**File references:** `src/app/hooks/useDeepLinkEffects.ts` (unchanged), `src/app/hooks/useDeepLinkFocus.ts` (new)

---

## Quality Metrics

| Story | Review Rounds | Blockers Found | Highs Found | Mediums Found | Lows Found | Test Coverage Notes |
|---|---|---|---|---|---|---|
| E97-S01 | 3 | 0 | 0 | 2 (fixed) | 3 (KI) | Unit: store + component. E2E: 4 scenarios. Gap: live-region SR recovery test (KI-L01). |
| E97-S02 | 2 | 0 | 0 | 2 (fixed) | 4 (KI) | Unit: SyncSection + settings. E2E: 6 scenarios. Gap: `__syncEngine__` shim verification (KI-L02). |
| E97-S03 | 1 | 0 | 0 | 0 | 3 (KI) | Unit: predicate + hook + component. E2E: 5 scenarios. Gap: `waitForTimeout` violation (KI-L03). |
| E97-S04 | 2 | 0 | 0 | 3 (fixed) | 5 (KI) | Unit: store + hooks + component. E2E: 7 scenarios. Gap: engine-watcher tighter phase guard (KI-L03). |
| E97-S05 | 1 (4 deferred) | 0 | 0 | 4 (deferred) | 3 (deferred) | Unit: aggregator + hook + badge + deep-link. E2E: 5 scenarios. Gaps: R1-M1, R1-M3 (AC6 unit, 3 flow assertions). |

**Totals across epic:** 0 BLOCKER, 0 HIGH, 11 MEDIUM (7 fixed, 4 deferred), 18 LOW (3 fixed, 15 deferred / carried as KI).

**Review-round target (1–2 per story):** E97-S01 exceeded at 3 rounds. Main driver was ARIA double-announce pattern and E2E seeding anti-pattern corrections. All other stories met the target.

---

## Next Steps

Prioritized recommended follow-up actions:

### Priority 1 — Test Coverage Gaps (Short-term, before E98 ships)

1. **Fix R1-M1** — Add missing AC6 unit test for `CredentialSetupBanner` `missing 0→N` re-appear transition. Estimated effort: 30 min. File: `src/app/components/sync/__tests__/CredentialSetupBanner.test.tsx`.

2. **Fix R1-M2 + KI-E97-S03-L03** — Replace two `waitForTimeout` calls with `waitForFunction`/`waitForSelector`. Estimated effort: 20 min. Files: `tests/e2e/story-97-03.spec.ts`, `tests/e2e/story-e97-s05-credential-sync-ux.spec.ts`.

3. **Fix R1-M3** — Add three targeted E2E assertions for the deep-link focus chain, "Why?" popover content, and CustomEvent dispatch chain. Estimated effort: 45 min.

### Priority 2 — Low-Effort Code Quality (Schedule in next maintenance chore)

4. **Fix R1-L1** — Remove unused `internalPasswordRef` from `CatalogForm.tsx`.

5. **Fix R1-L3** — Remove redundant `role='img'` when `showLabel=true` in `CredentialSyncStatusBadge`.

6. **Fix KI-E97-S02-L01** — Add `user.id` to `handleSyncNow` `useCallback` deps in `SyncSection`.

7. **Fix KI-E97-S04-L01** — Stabilize `onClose` reference in `NewDeviceDownloadOverlay` auto-close effect.

8. **Fix KI-E97-S04-L02** — Accept `watchdogMs` as a prop with a default value to improve testability.

### Priority 3 — Architectural Improvements (E98 or dedicated maintenance epic)

9. **Extract `<SyncUXShell>`** from `App.tsx` to encapsulate the five floating UX components and their evaluation logic.

10. **Address pre-existing lint debt** — Fix 10 `no-undef` errors in `src/lib/icalFeedGenerator.js` and `src/lib/ssrfProtection.js`, and the 3 silent-catch warnings in `useSyncLifecycle.ts`.

11. **Implement `useDeepLinkFocus` `enabled` guard** (R1-M4) — Prevent the hook from firing when its target dialog is not mounted.

### Priority 4 — Future Epic Candidates

12. **Cross-tab `BroadcastChannel` for sync status** — Deferred from S01. Low user-impact at current scale; revisit at beta scale.

13. **"Promote Local to Vault" action for AI keys** — Deferred from S05. Completes the credential sync narrative.

14. **`liveQuery` subscription refactor** — Replace 500ms polling in `useInitialUploadProgress` and `useDownloadProgress` with Dexie 4's reactive `liveQuery`.

15. **`autoSyncEnabled` Supabase sync** — Deferred from S02. Currently localStorage-only; the "sync the sync setting" story becomes relevant once cross-device UX parity matters.

---

*Generated 2026-04-21 from: `docs/known-issues.yaml` (E97 entries), `.context/compound-engineering/ce-runs/epic-E97-2026-04-19.md`, plan files `2026-04-19-021/023/024/025/026`, git log (main, HEAD~40), and R1 deferred findings from E97-S05 review.*
