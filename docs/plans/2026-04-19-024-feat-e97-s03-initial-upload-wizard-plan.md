---
title: "feat(E97-S03): Initial Upload Wizard"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e97-s03-initial-upload-wizard-requirements.md
---

# feat(E97-S03): Initial Upload Wizard

## Overview

Add a one-time onboarding modal that appears the first time a Knowlune user with existing local Dexie data completes sign-in on a given device. The wizard explains the upload, shows progress (item count + progress bar) driven by polling `db.syncQueue.where('status').equals('pending').count()`, supports "Skip for now" dismissal, and auto-completes with a success state. It renders at App.tsx root alongside `LinkDataDialog` and never co-appears with it. The existing `syncEngine.fullSync()` handles the actual upload — no new sync primitives are introduced.

## Problem Frame

Users signing in on a device with local learning data (notes, flashcards, books, progress, etc.) see the header sync indicator (E97-S01) flip silently without any explanation. They get no visibility into progress, no affordance to defer, and no confirmation when the backfill completes. The Sync Settings Panel (E97-S02) gives ongoing control but doesn't intercept the first-run moment. E97-S03 is the friendly wrapper around that first fullSync cycle. (see origin: docs/brainstorms/2026-04-19-e97-s03-initial-upload-wizard-requirements.md)

## Requirements Trace

- **R1 (AC1):** Wizard shown once per `{deviceId, userId}` when sign-in yields `shouldShowInitialUploadWizard(userId) === true`. Never co-appears with `LinkDataDialog`.
- **R2 (AC2):** Progress bar + "Uploading X of Y" count + per-table hint, sourced from syncQueue polling.
- **R3 (AC3):** "Skip for now" dismissal persisted as session-scoped localStorage flag; wizard reappears next sign-in if still incomplete.
- **R4 (AC4):** On `status === 'synced' && processed === total`: show success view, write completion flag, fire toast. On error: show retry/close.
- **R5 (AC5):** Silent no-op (never mounted) when no local data needs upload.
- **R6 (AC6):** Upload uses existing `syncEngine.fullSync()` — no new engine primitives.

## Scope Boundaries

- No changes to `src/lib/sync/syncEngine.ts` (invariant, verified by diff).
- No event-based progress pubsub from the engine.
- No upload cancellation (skip only hides UI; sync continues in background).
- No download-phase progress (upload only).
- No multi-device progress aggregation.
- No i18n — English strings only, matching current app conventions.

### Deferred to Separate Tasks

- Per-table label localization / icon polish: follow-up if E97 design review requests it.
- Persisting wizard completion cross-device: intentionally deferred — the flag is per-device by design.

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useAuthLifecycle.ts` — `handleSignIn()` orchestrates post-auth setup and `onUnlinkedDetected` → `LinkDataDialog` flow. Best hook-point for wizard evaluation.
- `src/app/App.tsx` — renders `LinkDataDialog` at root with `showLinkDialog` state + `onResolved` callback. Mirror this pattern for `InitialUploadWizard`.
- `src/app/components/sync/LinkDataDialog.tsx` — radix-ui Dialog composition, localStorage `sync:linked:<userId>` flag pattern, fire-and-forget `syncEngine.start()` pattern.
- `src/app/stores/useSyncStatusStore.ts` — `status`, `lastError`, `markSyncComplete` observables. Exposed on `window.__syncStatusStore` in dev/test.
- `src/lib/sync/syncEngine.ts` lines 1068–1160 — public `fullSync()`, `start()`, `stop()` API.
- `src/lib/sync/hasUnlinkedRecords.ts` — same detection function `useAuthLifecycle` already uses; reuse for wizard trigger.
- `src/app/components/ui/dialog.tsx` and `src/app/components/ui/progress.tsx` — shadcn primitives to compose.
- `src/lib/sync/classifyError.ts` — pattern for error messages already consumed by header indicator.
- `src/app/components/sync/SyncStatusIndicator.tsx` — sibling component for visual consistency (same Lucide CloudUpload family).

### Institutional Learnings

- `docs/solutions/` pattern: never dispatch sync from UI components — always go through `syncEngine` public API (matches AC6 invariant).
- Per-user localStorage key pattern (`sync:linked:<userId>`) already established in E92-S08 — extend with `sync:wizard:complete:<userId>` and `sync:wizard:dismissed:<userId>` rather than stuffing into `AppSettings`.
- Dev/test stores exposed on `window.__*` for E2E is an established pattern (E92-S07) — expose wizard state for deterministic tests if needed.

### External References

- None needed — all patterns are local.

## Key Technical Decisions

- **Progress derivation via polling, not events:** Poll `db.syncQueue.where('status').equals('pending').count()` every 500ms while wizard is open. Preserves the "no engine primitive changes" invariant (R6) at the cost of <500ms visual lag. Accepted tradeoff documented in origin doc §3.3.
- **Snapshot total at wizard open:** `total = pendingQueueCount + unlinkedRowCount` captured once. `processed = clamp(total - currentPending, 0, total)`. Avoids "moving denominator" UX where items that get re-enqueued during sync cause progress to regress.
- **Two separate localStorage keys (completion vs dismissal):** Completion is permanent per `{device, userId}`. Dismissal is session-scoped (cleared on SIGNED_OUT). Keeps the "nag me once per session" semantics without annoying persistent suppression.
- **Render at App.tsx root, not nested in a page:** Matches `LinkDataDialog` mounting so the wizard is present regardless of which route the user lands on post-auth.
- **Evaluation deferred to `onResolved` of LinkDataDialog OR direct auth-ready effect:** Guarantees wizard never co-appears with LinkDataDialog (R1 invariant). Two trigger sources converge on the same `shouldShowInitialUploadWizard(userId)` gate.
- **Wizard does not block sync:** `syncEngine.start()` proceeds regardless of wizard state. Wizard is purely observational + explanatory. Skip closes UI only.
- **Proactive completion flag on silent no-op path:** If `shouldShowInitialUploadWizard` returns `false` because the DB is already fully synced (not because the flag was set), write the completion flag to short-circuit future checks (resolves origin doc §7 Q1).
- **Require click on "Start upload" in `intro` state:** Reinforces user control over timing. Fast-path where sync is already running from `syncEngine.start()` opens wizard directly in `uploading` state (resolves origin doc §7 Q2).

## Open Questions

### Resolved During Planning

- **Should the completion flag auto-write on silent no-op?** Yes — write on every `shouldShowInitialUploadWizard === false` path where the flag was not already set, to short-circuit future calls.
- **Auto-start upload on mount or require click?** Require click in `intro`. Fast-path (sync already in flight) opens directly in `uploading`.
- **Per-table humanization:** ship a small map for top 6 tables; fall back to raw name for the rest.
- **i18n:** deferred to the localization epic.

### Deferred to Implementation

- Exact animation timings for state transitions (developer judgment — follow `prefers-reduced-motion`).
- Whether to expose `__initialUploadWizardState` on window for E2E (decide when writing the spec — fall back to DOM selectors if sufficient).

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
sequenceDiagram
    participant Auth as useAuthLifecycle
    participant App as App.tsx
    participant Link as LinkDataDialog
    participant Wizard as InitialUploadWizard
    participant Engine as syncEngine
    participant LS as localStorage

    Auth->>App: onUnlinkedDetected(userId)  %% if unlinked rows
    App->>Link: open(userId)
    Link->>Engine: start(userId)  %% via Link/Start-fresh path
    Link->>App: onResolved()
    App->>Wizard: evaluate shouldShowInitialUploadWizard(userId)
    alt returns true
        Wizard->>Wizard: snapshot total (pending + unlinked)
        Wizard-->>App: render intro → uploading → success
        Wizard->>LS: set sync:wizard:complete:<userId>
    else returns false
        Wizard->>LS: set sync:wizard:complete:<userId> (short-circuit)
    end

    Note over Auth,App: Fast path (already linked): no Link dialog
    Auth->>Engine: start(userId) directly
    App->>Wizard: evaluate on useAuthStore.user change
```

State machine for the wizard component:

```
intro ── Start ──▶ uploading ── status='synced' && processed===total ──▶ success
  │                   │
  │                   └── status='error' ──▶ error ── Retry ──▶ uploading
  └── Skip ──▶ (closed, dismissed flag set)          └── Close ──▶ (closed)
```

## Implementation Units

- [ ] **Unit 1: Detection helper `shouldShowInitialUploadWizard`**

**Goal:** Pure read-only predicate answering "should the wizard appear for this user on this device?"

**Requirements:** R1, R5

**Dependencies:** None

**Files:**
- Create: `src/lib/sync/shouldShowInitialUploadWizard.ts`
- Test: `src/lib/sync/__tests__/shouldShowInitialUploadWizard.test.ts`

**Approach:**
- Export `shouldShowInitialUploadWizard(userId: string): Promise<boolean>`.
- Early return `false` if `localStorage.getItem('sync:wizard:complete:<userId>')` is non-null.
- Return `true` if `db.syncQueue.where('status').equals('pending').count() > 0` OR `hasUnlinkedRecords(userId) === true`.
- Otherwise, write the completion flag (short-circuit future calls per design decision) and return `false`.
- Export constants `WIZARD_COMPLETE_KEY` and `WIZARD_DISMISSED_KEY` prefix helpers for use elsewhere.

**Execution note:** Test-first — the helper is pure and small; writing the truth table as tests first is the cheapest path.

**Patterns to follow:**
- `src/lib/sync/hasUnlinkedRecords.ts` for Dexie + localStorage access patterns.

**Test scenarios:**
- Happy path: empty DB, no flag → returns `false` AND writes completion flag.
- Happy path: pending queue entry present → returns `true`, no flag write.
- Happy path: unlinked rows present (mock `hasUnlinkedRecords` → true) → returns `true`, no flag write.
- Edge case: completion flag already set + pending queue entries → returns `false` (flag wins).
- Edge case: empty DB but flag not set → returns `false` AND writes flag (short-circuit).
- Error path: Dexie throws → function propagates (caller catches and defaults to safe false).

**Verification:**
- Truth table matches origin doc §FR1.
- Flag write only happens on the "empty + not set" branch.

---

- [ ] **Unit 2: Progress source hook `useInitialUploadProgress`**

**Goal:** Hook that snapshots total and polls syncQueue to derive `{ processed, total, recentTable, done }`.

**Requirements:** R2, R4

**Dependencies:** None

**Files:**
- Create: `src/app/hooks/useInitialUploadProgress.ts`
- Test: `src/app/hooks/__tests__/useInitialUploadProgress.test.ts`

**Approach:**
- On first effect run: snapshot `total = (pendingCount + unlinkedCount)` and `startedAt = new Date()`.
- Start a 500ms `setInterval` that:
  - Reads `db.syncQueue.where('status').equals('pending').count()`.
  - Reads the most-recently-updated pending row's `tableName` for `recentTable`.
  - Computes `processed = clamp(total - currentPending, 0, total)`.
  - Sets `done = (currentPending === 0)`.
- Cleanup: clear interval on unmount.
- Return value: `{ processed, total, recentTable, done, error }`.
- Swallow Dexie read errors silently with a single `console.error` (non-fatal — next poll retries).

**Execution note:** Test-first — use fake timers to drive the interval deterministically.

**Patterns to follow:**
- `src/app/stores/useSyncStatusStore.ts` `refreshPendingCount` for Dexie query shape.
- `src/app/hooks/useSyncLifecycle.ts` interval/cleanup pattern.

**Test scenarios:**
- Happy path: pending count drops 5 → 0 over polls; `processed` progresses 0 → 5, `done` flips to `true`.
- Happy path: initial snapshot with `total === 0` yields `done === true` immediately (no interval needed for AC5 belt-and-suspenders).
- Edge case: `recentTable` updates when a different table's entry becomes the newest pending row.
- Edge case: unmount cancels interval (verify no further Dexie reads after cleanup).
- Error path: Dexie count() rejects once → hook logs and retries next tick without throwing.

**Verification:**
- No timers leak after unmount (use vitest's fake-timer assertions).
- `processed` never exceeds `total` even if new entries get enqueued after snapshot (clamped).

---

- [ ] **Unit 3: `InitialUploadWizard` component**

**Goal:** Modal component that renders the four states and handles user actions.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 2

**Files:**
- Create: `src/app/components/sync/InitialUploadWizard.tsx`
- Test: `src/app/components/sync/__tests__/InitialUploadWizard.test.tsx`

**Approach:**
- Props: `{ open: boolean; userId: string; onClose: () => void }`.
- Local state: `phase: 'intro' | 'uploading' | 'success' | 'error'`.
- On mount when `open && userId`: if `useSyncStatusStore.getState().status === 'syncing'`, jump to `uploading` (fast path); otherwise start in `intro`.
- Subscribe to `useSyncStatusStore` for `status` + `lastError`:
  - `status === 'error'` → set `phase = 'error'`.
  - `status === 'synced' && progress.done && progress.total > 0` → set `phase = 'success'`, write completion flag, clear dismissal flag, `toast.success('Initial upload complete')`.
- Consume `useInitialUploadProgress` while `phase === 'uploading'`.
- Actions:
  - **Start upload:** `syncEngine.fullSync().catch(() => {})` (errors surface via status store); set `phase = 'uploading'`.
  - **Skip for now:** write dismissal flag with ISO timestamp, call `onClose()`. Do not touch engine.
  - **Retry:** write nothing, `syncEngine.fullSync().catch(() => {})`, set `phase = 'uploading'`.
  - **Done / Close:** call `onClose()`.
- Use `Dialog`, `DialogContent` from `src/app/components/ui/dialog.tsx`; `Progress` from `src/app/components/ui/progress.tsx`; `Button variant="brand" | "ghost"`.
- Icons: `CloudUpload`, `CheckCircle2`, `AlertTriangle` from `lucide-react`.
- `aria-live="polite"` on the counts text only.
- Humanize `recentTable` via a small local map with fallback.
- Render `null` when `!open || !userId`.

**Patterns to follow:**
- `src/app/components/sync/LinkDataDialog.tsx` for radix composition and useEffect guards.
- `src/app/components/settings/sections/SyncSection.tsx` (E97-S02) for button variants + toast feedback.
- `src/app/components/sync/SyncStatusIndicator.tsx` for icon/color parity.

**Test scenarios:**
- Happy path: mounts in `intro`; clicking Start calls `syncEngine.fullSync` and transitions to `uploading`.
- Happy path: `useSyncStatusStore.status` → `'synced'` with `progress.done` triggers `success`, writes completion flag, fires toast.
- Happy path: fast-path mount when `status === 'syncing'` skips `intro`.
- Edge case: `total === 0` → wizard closes immediately (guards against rendering empty progress).
- Edge case: Skip writes dismissal flag; `syncEngine` is not invoked.
- Error path: `status → 'error'` transitions to `error` state with `lastError` text.
- Error path: clicking Retry re-invokes `fullSync` and returns to `uploading`.
- Integration: completion flag write clears the dismissal flag (verify localStorage state after success).
- Integration: `onClose` is called on Done, Skip, and error Close paths.

**Verification:**
- Component renders `null` when `!open`.
- Completion flag is only written in the success branch (not on Skip, not on error).
- No direct engine mutations beyond `fullSync()`.

---

- [ ] **Unit 4: Mount wizard from App.tsx + auth trigger wiring**

**Goal:** Render the wizard at App root with the correct evaluation ordering so it never co-appears with `LinkDataDialog`.

**Requirements:** R1, R5

**Dependencies:** Unit 1, Unit 3

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/hooks/useAuthLifecycle.ts` (minimal — add sign-out cleanup of dismissal flag)
- Test: `src/app/__tests__/App.initialUploadWizard.test.tsx` (or colocated in existing App test file if present)

**Approach:**
- In `App.tsx`:
  - Add state `const [uploadWizardUserId, setUploadWizardUserId] = useState<string | null>(null)`.
  - In the existing `onResolved` handler of `LinkDataDialog`: after closing the link dialog, call `shouldShowInitialUploadWizard(userId)` and `setUploadWizardUserId(userId)` if true; else write the completion flag (already handled inside the helper).
  - Add a `useEffect` on `useAuthStore.user`: when `user` becomes non-null AND `showLinkDialog === false`, run the same `shouldShowInitialUploadWizard` evaluation.
  - Render `<InitialUploadWizard open={uploadWizardUserId !== null} userId={uploadWizardUserId ?? ''} onClose={() => setUploadWizardUserId(null)} />` next to `<LinkDataDialog />`.
- In `useAuthLifecycle.ts`:
  - In the `SIGNED_OUT` branch, clear `localStorage['sync:wizard:dismissed:<userId>']` for the just-signed-out user. Do NOT clear the completion flag.
  - Use a constant for the key prefix to avoid stringly-typed drift.

**Patterns to follow:**
- `src/app/App.tsx` existing `LinkDataDialog` gating pattern.
- `src/app/hooks/useAuthLifecycle.ts` `LINKED_FLAG_PREFIX` constant pattern.

**Test scenarios:**
- Happy path: seeded pending queue + sign-in (no unlinked) → wizard renders, link dialog does not.
- Happy path: seeded unlinked rows + pending queue → link dialog renders first; on `onResolved`, wizard renders (never overlapping).
- Edge case: sign-in with fresh DB → neither dialog renders; completion flag is written.
- Edge case: sign-out clears only the dismissal flag (completion flag persists for future sign-ins of the same userId).
- Integration: re-evaluation on `onResolved` runs after link-dialog-induced backfill so newly-enqueued rows are counted.

**Verification:**
- `LinkDataDialog` and `InitialUploadWizard` are never both `open` simultaneously (assert in test).
- Sign-out preserves `sync:wizard:complete:<userId>` but clears `sync:wizard:dismissed:<userId>`.

---

- [ ] **Unit 5: E2E spec `story-97-03.spec.ts`**

**Goal:** End-to-end validation of the three headline flows (happy, skip, link-first-then-wizard) + fresh-device silent path.

**Requirements:** R1–R5

**Dependencies:** Units 1–4

**Files:**
- Create: `tests/e2e/story-97-03.spec.ts`

**Approach:**
- Use existing IndexedDB seeding helpers (per `.claude/rules/testing/test-patterns.md`).
- Mock `syncEngine.fullSync` at the module boundary where the app is built, or drive progress via direct Dexie manipulation (delete syncQueue rows to simulate drain) — prefer the latter to exercise real engine paths except for the network.
- Use `FIXED_DATE` for determinism.
- Seed Supabase client mock so `hasUnlinkedRecords` returns predictable values.

**Patterns to follow:**
- `tests/e2e/story-97-01.spec.ts` and `tests/e2e/story-97-02.spec.ts` for layout, sign-in helpers, and selectors.
- `tests/e2e/story-92-08.spec.ts` (LinkDataDialog) for the "seed unlinked rows" pattern.

**Test scenarios:**
- Happy path: sign in with 5 pending queue entries → wizard `intro` → click Start → progress advances as rows are deleted → success state + completion flag asserted → reload → wizard does not reappear.
- Edge case: fresh DB + sign in → wizard never mounts; `__syncStatusStore` progresses to `synced` normally.
- Edge case: Skip for now → wizard closes, sync continues; reload in same session → wizard reappears (dismissal is session-scoped).
- Integration: unlinked rows + pending queue → LinkDataDialog first → "Link to my account" → wizard appears after dialog resolves (ordering assertion).
- Error path: force `fullSync` to reject → wizard transitions to `error` → Retry returns to `uploading`.

**Verification:**
- All five scenarios pass in Chromium.
- No console errors during happy path.
- `localStorage.getItem('sync:wizard:complete:<userId>')` asserted directly via `page.evaluate`.

## System-Wide Impact

- **Interaction graph:** `App.tsx` gains a second post-auth modal alongside `LinkDataDialog`. `useAuthLifecycle.ts` SIGNED_OUT branch gains a one-line dismissal-flag cleanup.
- **Error propagation:** Wizard surfaces `useSyncStatusStore.lastError` verbatim (already classified by `classifyError`). No new error paths introduced.
- **State lifecycle risks:** Race between `LinkDataDialog` backfill → syncQueue enqueue → wizard evaluation is addressed by deferring wizard evaluation to `onResolved` (fires after backfill completes). No partial-write risk.
- **API surface parity:** None — no new engine methods. Public surface of `syncEngine` unchanged (AC6 invariant).
- **Integration coverage:** E2E covers the two-modal ordering; unit tests cover the evaluation gate. Both are needed because the ordering only manifests with real auth lifecycle events.
- **Unchanged invariants:** `syncEngine.ts` signature and internals remain untouched. `AppSettings` interface is not extended (wizard flags live in per-user localStorage keys). `useSyncStatusStore` contract from E92-S07 / E97-S01 / E97-S02 is consumed read-only.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Wizard flashes open then closes on fresh devices (race between mount and `shouldShowInitialUploadWizard` resolving) | Gate mount on resolved promise — render `null` until the evaluation completes, using a `useState<boolean \| null>` sentinel. |
| Progress stalls at N-1/N forever (e.g., one queue entry in `dead-letter`) | `useInitialUploadProgress` polls all-statuses count too; if `pending === 0 && status === 'synced'`, force `done = true` even if `processed < total`. |
| LinkDataDialog → wizard race enqueues rows after snapshot | Snapshot is captured on wizard open (post-onResolved), not pre-link-dialog. Documented in Unit 2 approach. |
| User skips and closes tab before sync completes → data loss risk | Not a regression — current behavior without the wizard is identical. Background sync continues; next session resumes. |
| Multiple accounts on same device cross-contaminate flags | Keys are scoped by userId. Tested in Unit 4 sign-out case. |
| 500ms poll causes UI jank on low-end devices | Dexie `count()` on indexed column is O(log N). If measurable, reduce to 1s or switch to a subscription using Dexie `liveQuery`. |

## Documentation / Operational Notes

- No new docs required — story file at `docs/implementation-artifacts/stories/E97-S03-initial-upload-wizard.md` captures user-facing behavior.
- No telemetry/monitoring changes — wizard mount/complete logged via `console.info` only.
- No feature flag — wizard ships behind the `shouldShowInitialUploadWizard` gate which is itself the feature flag (empty state → no wizard).

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e97-s03-initial-upload-wizard-requirements.md](../brainstorms/2026-04-19-e97-s03-initial-upload-wizard-requirements.md)
- **Story file:** [docs/implementation-artifacts/stories/E97-S03-initial-upload-wizard.md](../implementation-artifacts/stories/E97-S03-initial-upload-wizard.md)
- Related code: `src/app/hooks/useAuthLifecycle.ts`, `src/app/components/sync/LinkDataDialog.tsx`, `src/app/stores/useSyncStatusStore.ts`, `src/lib/sync/syncEngine.ts`, `src/lib/sync/hasUnlinkedRecords.ts`
- Sibling E97 plans: `docs/plans/2026-04-19-021-feat-e97-s01-sync-status-indicator-header-plan.md`, `docs/plans/2026-04-19-023-feat-e97-s02-sync-settings-panel-plan.md`
