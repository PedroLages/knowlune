---
title: Post-E97 Cleanup — Test Gaps & Low-Effort Code Quality
type: fix
status: active
date: 2026-04-21
origin: docs/reviews/code/E97-deep-report-2026-04-21.md
---

# Post-E97 Cleanup — Test Gaps & Low-Effort Code Quality

## Overview

Ship a single cleanup PR that closes the Priority 1 (test coverage gaps) and
Priority 2 (low-effort code quality) follow-ups from the E97 deep report,
before E98 touches adjacent code. Shape mirrors the precedent
[post-E93 cleanup](2026-04-19-001-fix-post-e93-cleanup-plan.md): one branch off
`main`, focused commits per item, no feature changes.

Priority 3 (architectural extraction of `<SyncUXShell>`, pre-existing lint
debt, `useDeepLinkFocus` `enabled` guard) and Priority 4 (future-epic
candidates) are explicitly out of scope — they require dedicated design work
and should each be a separate plan.

## Problem Frame

E97 shipped cleanly (PRs #381–#385, all merged), but the deep report
[docs/reviews/code/E97-deep-report-2026-04-21.md](../reviews/code/E97-deep-report-2026-04-21.md)
enumerated 15 open follow-ups. Ten of them are small, self-contained, and
carry no architectural risk:

- 3 test coverage gaps (R1-M1, R1-M2, R1-M3, plus KI-E97-S03-L03 which
  overlaps R1-M2 in scope) that should land before E98 ships anything
  on top of E97 surfaces.
- 5 low-effort code quality fixes (R1-L1, R1-L3, KI-E97-S02-L01,
  KI-E97-S04-L01, KI-E97-S04-L02) that close obvious drift without
  reshaping behavior.

Leaving these open risks (a) silent regressions in AC6 banner re-appear,
credential deep-link focus chain, and engine-watcher phase guard, and (b)
small drift accumulating before E98 lands new sync-UX work. Fixing them as
one bundled cleanup keeps the E97 retrospective clean and matches the
established post-epic cleanup cadence.

See origin: [docs/reviews/code/E97-deep-report-2026-04-21.md](../reviews/code/E97-deep-report-2026-04-21.md).

## Requirements Trace

- R1 (Origin P1.1 / R1-M1). `CredentialSetupBanner` has a unit test asserting
  that transitioning `missing` from `[]` to `[entry]` clears the
  `sessionStorage` dismissal flag (AC6 re-appear).
- R2 (Origin P1.2 / R1-M2 + KI-E97-S03-L03). The two `page.waitForTimeout(500)`
  calls in `tests/e2e/story-97-03.spec.ts` and
  `tests/e2e/story-e97-s05-credential-sync-ux.spec.ts` are replaced with
  deterministic waits (`waitForFunction` / `waitForSelector`) or carry a
  justification comment that satisfies `test-patterns/no-hard-waits`.
- R3 (Origin P1.3 / R1-M3). The E97-S05 E2E spec covers three edge flows:
  (a) `?focus=opds:<id>` deep-link focus chain when the dialog is already
  open, (b) "Why?" popover content rendered from the badge, (c) the
  `CustomEvent('open-opds-settings')` dispatch chain from banner through
  `Library.tsx` to dialog open.
- R4 (Origin P2.4 / R1-L1). `src/app/components/library/CatalogForm.tsx` no
  longer allocates the unused `internalPasswordRef`; the forwarded
  `passwordInputRef` drives focus directly.
- R5 (Origin P2.5 / R1-L3). `src/app/components/sync/CredentialSyncStatusBadge.tsx`
  drops the redundant `role="img"` when `showLabel === true`; the role (or an
  equivalent `aria-label`) is retained when `showLabel === false`.
- R6 (Origin P2.6 / KI-E97-S02-L01). `handleSyncNow` in
  `src/app/components/settings/sections/SyncSection.tsx` either includes
  `user.id` in its `useCallback` deps or carries an
  `// eslint-disable-next-line` comment with a one-line justification.
- R7 (Origin P2.7 / KI-E97-S04-L01). The auto-close effect in
  `NewDeviceDownloadOverlay.tsx` no longer resets its 250 ms timer on every
  parent re-render (stabilize `onClose` at the call site or via an internal
  ref).
- R8 (Origin P2.8 / KI-E97-S04-L02). `NewDeviceDownloadOverlay` accepts an
  optional `watchdogMs?: number` prop (default `60_000`) so tests can
  exercise the watchdog without expensive fake-timer advances.
- R9 (No-regression). `npm run lint`, `npm run test:unit`, and the E97 E2E
  suite (all five `story-*97*.spec.ts` files) pass.

## Scope Boundaries

- No behavior changes to any E97 component — every fix is either a test
  addition or a ref/dep hygiene correction.
- No new sync UX surfaces, no new Zustand stores, no new hooks.
- No changes to the `CustomEvent('open-opds-settings')` dispatch chain (just
  more test coverage for it).
- No changes to `aggregateCredentialStatus`, `useMissingCredentials`, or any
  other E97-S05 core module.
- No visual/design changes (R5 is an accessibility attribute removal that
  does not alter visible output).

### Deferred to Separate Tasks

- **Architectural extraction of `<SyncUXShell>`** (Origin P3.9): requires its
  own refactor plan; reshapes `App.tsx` mount structure and needs design
  review.
- **Pre-existing lint debt** (Origin P3.10): 10 `no-undef` errors in
  `src/lib/icalFeedGenerator.js` + `src/lib/ssrfProtection.js`, plus 3
  silent-catch warnings in `src/app/hooks/useSyncLifecycle.ts`
  (KI-E97-S01-L03). Needs its own maintenance chore — different domain,
  different test strategy.
- **`useDeepLinkFocus` `enabled` prop** (Origin P3.11 / R1-M4): design
  decision about hook API shape; better handled alongside the `CustomEvent`
  collapse discussion raised in Architectural Concern #3.
- **Other low-severity KI entries** (KI-E97-S01-L01 live-region recovery
  announce, KI-E97-S01-L02 reduced-motion assertion tightening,
  KI-E97-S02-L02 `__syncEngine__` shim guard, KI-E97-S02-L03 signed-out
  nav entry, KI-E97-S02-L04 `computeTotalSyncedItems` debounce,
  KI-E97-S03-L01 `suppressErrorUntilSyncingRef` `finally`, KI-E97-S03-L02
  Dexie `userId` index, KI-E97-S04-L03 engine-watcher phase guard,
  KI-E97-S04-L04 per-table HEAD shim, KI-E97-S04-L05 `observedHydrate`
  idempotent re-throw, R1-L4 eslint-disable style). Each is either deeper
  than a quick fix, or was already triaged `schedule-future` in
  `docs/known-issues.yaml` and should stay there.
- **All Priority 4 items** (Origin P4.12–P4.15): `BroadcastChannel`,
  promote-to-Vault, `liveQuery`, `autoSyncEnabled` Supabase sync — each is a
  separate user-visible feature and belongs in a future epic.

## Context & Research

### Relevant Code and Patterns

- **Banner re-appear logic (R1):**
  `src/app/components/sync/CredentialSetupBanner.tsx` holds a
  `sessionStorage` key `knowlune:credential-banner-dismissed:<userId>`.
  The existing test file
  `src/app/components/sync/__tests__/CredentialSetupBanner.test.tsx` (if
  present — else create) already uses RTL + `vi.mock` for Supabase. Follow
  its mount-and-rerender pattern.
- **E2E hard-wait replacements (R2):**
  `tests/e2e/story-97-03.spec.ts:187` —
  `await page.waitForTimeout(500) // silent-catch-ok — waiting for the one-shot evaluation to resolve`
  already has a comment but the comment does not follow the project's
  justification convention. `tests/e2e/story-e97-s05-credential-sync-ux.spec.ts:80`
  has no comment. Replace both with `page.waitForFunction(...)` or
  `page.waitForSelector(...)` keyed to a concrete DOM signal.
- **Deep-link focus chain (R3):** `src/app/hooks/useDeepLinkFocus.ts`
  consumes `?focus=opds:<id>`. Dispatch chain: banner →
  `CustomEvent('open-opds-settings')` → `src/app/pages/Library.tsx`
  listener → sets URL search param → dialog mounts `useDeepLinkFocus`. The
  existing `tests/e2e/story-e97-s05-credential-sync-ux.spec.ts` has the
  setup scaffolding; append three new `test(...)` blocks.
- **Unused ref (R4):** `src/app/components/library/CatalogForm.tsx:63–64`:
  ```
  const internalPasswordRef = useRef<HTMLInputElement>(null)
  const resolvedPasswordRef = passwordInputRef ?? internalPasswordRef
  ```
  `resolvedPasswordRef` is passed to the password `<Input>`. If
  `passwordInputRef` is always provided by the only caller, the fallback
  is dead. Verify the caller (search for `<CatalogForm`) to confirm before
  deleting.
- **Badge role (R5):** `src/app/components/sync/CredentialSyncStatusBadge.tsx:100`
  sets `role="img"` unconditionally on the wrapping `<span>`. When
  `showLabel === true` (line 112), the child `<span>` renders `{label}` as
  text, so the wrapper's implicit role is sufficient.
- **SyncSection deps (R6):** `src/app/components/settings/sections/SyncSection.tsx:198–217`
  closes over `user` (via `runFullSync` and `computeTotalSyncedItems`) but
  only lists `[busy]` in the `useCallback` deps. Dep array should include
  `user?.id` (preferred) with a short inline comment explaining why `user`
  itself is not included (reference stability).
- **Overlay effect (R7):** `src/app/components/sync/NewDeviceDownloadOverlay.tsx:135`
  — effect deps are
  `[open, storeStatus, progress.done, progress.total, progress.processed, onClose]`.
  Call site in `src/app/App.tsx` passes an inline `() => {...}`. Either
  wrap the call-site handler with `useCallback`, or stash `onClose` in a
  ref inside the overlay and read it from the ref within the effect.
- **Watchdog prop (R8):** `src/app/components/sync/NewDeviceDownloadOverlay.tsx:39`
  — `const WATCHDOG_MS = 60_000`. Hoist to an optional prop on
  `NewDeviceDownloadOverlayProps` with `watchdogMs?: number` defaulting to
  `60_000`. Tests pass a small value (e.g., `50`) and no longer need
  `vi.useFakeTimers()` + `vi.advanceTimersByTime(60_000)`.

### Institutional Learnings

- **Precedent — post-E93 cleanup** (`docs/plans/2026-04-19-001-fix-post-e93-cleanup-plan.md`):
  established the "one PR, focused commits, test changes only where
  possible" shape for post-epic cleanups. Follow that structure.
- **Test patterns** (`.claude/rules/testing/test-patterns.md`): the ESLint
  rule `test-patterns/no-hard-waits` warns on `waitForTimeout` without a
  justification comment. Preferred replacement is `waitForFunction` or
  `waitForSelector`.
- **Design tokens**: No styling changes in this cleanup, so
  `design-tokens/no-hardcoded-colors` is not exercised.

### External References

Not used — all fixes are local pattern corrections.

## Key Technical Decisions

- **One PR, eight focused commits, one per requirement.** Matches post-E93
  precedent; keeps each revert atomic.
- **R7 via internal `onCloseRef`, not a call-site `useCallback`.** Owning
  stability inside the overlay is more robust than relying on every caller
  to remember. Lower blast radius than changing `App.tsx`.
- **R8 default preserved at `60_000`.** Production behavior unchanged; only
  tests pass a smaller value.
- **R3 appended to existing spec, not a new file.** The three flows share
  setup scaffolding with the existing spec; splitting would duplicate 50+
  lines of fixtures.
- **R2 prefers `waitForFunction` over a justification comment.** Comments
  are a last resort — the tests are genuinely waiting for observable DOM
  state and `waitForFunction` expresses that directly.
- **R6 prefers `user?.id` in deps over an eslint-disable.** Smaller risk
  surface; `user?.id` is already a primitive and is stable between renders.
- **R2 enumerates candidate predicates per call site, not per-implementer
  discretion.** Unit 2 lists Candidate A + Candidate B for each of the
  two `waitForTimeout(500)` occurrences; a justification-comment fallback
  is only permitted if both candidates have been attempted and documented
  as unstable. This prevents the "add a comment and move on" anti-pattern
  from perpetuating flake.
- **R3 mandates per-test URL reset to prevent `?focus=` bleed-through.**
  Unit 3's three new flows share the file-level `beforeEach` fixture, and
  Flow A's `/library?focus=opds:<id>` navigation would leak into Flow B /
  Flow C without an explicit `page.goto('/library')` reset at the top of
  each new block (or inside a scoped `beforeEach`).
- **R8 uses `??` (nullish coalescing), not `||`.** Unit 8 mandates
  `watchdogMs ?? WATCHDOG_MS` so that `watchdogMs={0}` is treated as
  "no prop" rather than "fire immediately"; a regression test locks in
  this behavior.

## Open Questions

### Resolved During Planning

- **Does `CredentialSetupBanner.test.tsx` already exist?** — Verified in
  the E97-S05 R1 findings: the file exists; only the AC6 re-appear case is
  missing. Add one `it(...)` block; do not recreate the file.
- **Is the `internalPasswordRef` reachable via any caller?** — Deferred
  verification to Unit 4 (grep `<CatalogForm`). If any caller omits
  `passwordInputRef`, keep the fallback but add a comment; otherwise delete.
- **Should the `watchdogMs` prop be exported from the module?** — No; it
  is an internal testability lever. Types-only export is sufficient.

### Deferred to Implementation

- **Exact replacement condition for `story-97-03.spec.ts:187`** — depends
  on which DOM signal is observable at that point; the implementer reads
  the surrounding test body to pick `waitForFunction(() => document.querySelector('[data-phase="uploading"]') !== null)`
  or a more appropriate predicate.
- **Whether R5's badge test needs a new assertion** — if the existing
  badge test already checks `aria-label`, no new assertion; otherwise add
  one for the `showLabel=false` variant.

## Implementation Units

- [ ] **Unit 1: Banner AC6 re-appear unit test (R1-M1)**

**Goal:** Assert that `CredentialSetupBanner` clears the `sessionStorage`
dismissal flag when `missing` transitions from `[]` to a non-empty array.

**Requirements:** R1.

**Dependencies:** None.

**Files:**
- Modify: `src/app/components/sync/__tests__/CredentialSetupBanner.test.tsx`

**Approach:**
- Render the banner with `missing=[]` and a mocked `userId`.
- Pre-seed `sessionStorage` with the dismissal key
  `knowlune:credential-banner-dismissed:<userId>`.
- Rerender with `missing=[entry]`.
- Assert `sessionStorage.getItem(key) === null`.

**Execution note:** Test-first — write the assertion before reading the
component's effect to confirm coverage is accurate.

**Patterns to follow:**
- Existing mount-and-rerender pattern in the same file.
- `sessionStorage` cleanup via `beforeEach(() => sessionStorage.clear())`.

**Test scenarios:**
- Happy path: `missing=[]` → `missing=[entry]` clears the flag.
- Edge case: `missing=[entry]` → `missing=[entry]` (no 0→N transition)
  leaves the flag intact.
- Edge case: userId absent/unknown — effect does not throw, flag untouched.

**Verification:**
- `npm run test:unit -- CredentialSetupBanner` passes.
- Failing an intentional temporary edit (e.g., removing the clear call in
  the component) causes this test to fail — proves the test is wired.

---

- [ ] **Unit 2: Replace hard-wait timeouts in E97 E2E specs (R1-M2 + KI-E97-S03-L03)**

**Goal:** Replace the two `page.waitForTimeout(500)` calls with deterministic
waits, or (only if no observable signal exists) add a justification comment
that satisfies `test-patterns/no-hard-waits`.

**Requirements:** R2.

**Dependencies:** None.

**Files:**
- Modify: `tests/e2e/story-97-03.spec.ts` (line ~187)
- Modify: `tests/e2e/story-e97-s05-credential-sync-ux.spec.ts` (line ~80)

**Approach:**

Enumerate the DOM signal per call site — do NOT defer the predicate choice
to implementer discretion. Each call site has a specific observable state
that the current `waitForTimeout(500)` is masking:

- **`tests/e2e/story-97-03.spec.ts:187`** — the test is awaiting the
  one-shot wizard evaluation after `setFakeAuthUser(page)` so it can branch
  on `wizard.count() > 0`. The evaluation writes one of two observable
  signals:
  - **Candidate A (preferred):** the wizard mounts —
    `await page.getByTestId('initial-upload-wizard').waitFor({ state: 'attached', timeout: 2000 }).catch(() => {})`
    followed by `wizard.count()` to branch, OR use
    `page.waitForFunction(() => {
       const el = document.querySelector('[data-testid=\"initial-upload-wizard\"]');
       return el !== null || localStorage.getItem('sync:wizard:complete:test-user') !== null;
     }, { timeout: 2000 })`.
  - **Candidate B (fallback):** poll the completion flag directly —
    `page.waitForFunction(() => localStorage.getItem('sync:wizard:complete:test-user') !== null || document.querySelector('[data-testid="initial-upload-wizard"]') !== null)`.

- **`tests/e2e/story-e97-s05-credential-sync-ux.spec.ts:80`** — the test
  is awaiting the banner evaluation pass so it can assert that no console
  errors fired. The observable signals:
  - **Candidate A (preferred):** wait for the post-evaluation DOM state —
    `await expect(page.getByTestId('credential-setup-banner')).toHaveCount(0)`
    (the evaluation has completed when the banner is definitively absent,
    since `useMissingCredentials` has resolved to `[]`).
  - **Candidate B (fallback):** `page.waitForFunction(() => document.readyState === 'complete' && !document.querySelector('[data-loading="credentials"]'))`
    keyed on whatever loading sentinel the hook exposes, OR assert a
    known-stable post-hydration element (e.g., the header status pill) is
    visible before sampling console errors.

**Justification-comment escape hatch (tightened):** A justification
comment fallback (`// Intentional: waiting for <animation name> — no
observable DOM signal`) is permitted ONLY IF **both** Candidate A and
Candidate B above have been attempted in the implementer's local run and
produced a flaky or unstable signal. The commit message (or a PR-thread
note) must name which two predicates were tried and why each failed.
Deferring to a comment without this dual-attempt evidence is rejected at
review.

**Patterns to follow:**
- Existing `page.waitForFunction` usages in other E97 specs
  (`story-97-04.spec.ts` has examples).

**Test scenarios:**
- Happy path: The spec still passes after replacement.
- Flake guard: Running the spec 10× (burn-in) does not flake from the
  replacement condition being too strict.

**Verification:**
- Both specs pass on first run.
- `npm run lint` no longer emits `test-patterns/no-hard-waits` warnings
  for these two lines.

---

- [ ] **Unit 3: Add three E97-S05 E2E edge-flow assertions (R1-M3)**

**Goal:** Cover the three edge flows the E97-S05 R1 review flagged as
under-tested.

**Requirements:** R3.

**Dependencies:** Unit 2 (to avoid merging new hard-waits).

**Files:**
- Modify: `tests/e2e/story-e97-s05-credential-sync-ux.spec.ts`

**Approach:**
- Append three new `test(...)` blocks reusing the existing fixture.
- **Each new `test(...)` block MUST begin with an explicit URL reset** to
  prevent `?focus=` query-string bleed-through between Flow A, B, and C.
  Use either an inline reset at the top of each block:
  `await page.goto('/library')` (clears any lingering `?focus=` from the
  previous block's navigation), OR add a scoped `beforeEach` inside a new
  nested `describe` covering the three new flows:
  ```ts
  test.describe('E97-S05 deep-link edge flows', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/library') // reset URL/search params between flows
    })
    // ...three test(...) blocks
  })
  ```
- Flow A: Navigate to `/library?focus=opds:<id>` with the OPDS edit dialog
  already open — assert the password input receives focus.
- Flow B: Open the badge popover (hover or click) — assert `"Why?"`
  content text is present.
- Flow C: Dispatch the banner's "Re-enter" action — assert the URL gains
  `?focus=opds:<id>` and the dialog opens.

**Test isolation:**
Playwright's browser-context isolation clears cookies, localStorage, and
sessionStorage between tests, but it does NOT reset the in-memory URL of
the page object across `test(...)` blocks that share the file-level
`beforeEach` fixture. Flow A navigates to `/library?focus=opds:<id>`, so
without an explicit reset Flow B / Flow C would inherit that search param
and silently exercise the deep-link focus chain on the wrong flow. The
`await page.goto('/library')` reset (or scoped `beforeEach`) is mandatory;
additionally, if any flow writes to sessionStorage (e.g.,
`knowlune:credential-banner-dismissed:<userId>`), the reset should include
`await page.evaluate(() => sessionStorage.clear())` before the
`page.goto` to prevent Flow A → Flow B dismissal-flag bleed-through.

**Patterns to follow:**
- Existing scenario structure in `story-e97-s05-credential-sync-ux.spec.ts`.
- Deterministic auth seeding via the shared E97 E2E fixture (see
  `story-97-02-sync-settings.spec.ts` for the pattern).

**Test scenarios:**
- Happy path A: Deep-link focus chain works when dialog is pre-open.
- Happy path B: "Why?" popover shows expected body copy.
- Integration C: Full three-hop dispatch chain (banner → Library →
  dialog) completes end-to-end.
- Error path C: Dispatching without a matching catalog id no-ops (dialog
  stays closed). Optional, only if the current code path guards it.

**Verification:**
- New tests pass on first run.
- Burn-in 10× stable.

---

- [ ] **Unit 4: Remove unused `internalPasswordRef` (R1-L1)**

**Goal:** Delete `internalPasswordRef` in `CatalogForm.tsx` if every caller
provides `passwordInputRef`; otherwise document why the fallback exists.

**Requirements:** R4.

**Dependencies:** None.

**Files:**
- Modify: `src/app/components/library/CatalogForm.tsx`

**Approach:**
- Grep `<CatalogForm` across the repo. Confirm every caller passes
  `passwordInputRef`.
- If all callers pass it: delete the `internalPasswordRef` line and the
  `resolvedPasswordRef` fallback; use `passwordInputRef` directly.
- If any caller omits it: keep the fallback but mark it with
  `// Intentional fallback: <caller path> does not forward a ref`.

**Patterns to follow:**
- Existing ref forwarding patterns in other library components.

**Test scenarios:**
- Test expectation: none — the ref was never observable in tests. A
  manual check that the existing CatalogForm tests still pass is
  sufficient.

**Verification:**
- `npm run test:unit -- CatalogForm` passes.
- Typecheck clean.

---

- [ ] **Unit 5: Drop redundant `role="img"` on labeled badge (R1-L3)**

**Goal:** Only emit `role="img"` on the badge wrapper when the wrapper has
no visible text label (i.e., `showLabel === false`).

**Requirements:** R5.

**Dependencies:** None.

**Files:**
- Modify: `src/app/components/sync/CredentialSyncStatusBadge.tsx`
- Modify (if needed): `src/app/components/sync/__tests__/CredentialSyncStatusBadge.test.tsx`

**Approach:**
- Change line ~100 from `role="img"` (unconditional) to conditional:
  `role={showLabel ? undefined : 'img'}`.
- Keep `aria-label={label}` unconditionally — it remains useful for the
  icon-only case and is ignored by AT when the element has a visible
  accessible name.
- Verify the existing badge test covers both variants; add one
  assertion if `showLabel=false` is not already asserted to carry
  `role="img"`.

**Patterns to follow:**
- Other badge components in `src/app/components/ui/` for the
  "role only on icon-only variant" pattern.

**Test scenarios:**
- Happy path: `showLabel=true` — wrapper has no `role="img"` (uses
  implicit role).
- Happy path: `showLabel=false` — wrapper has `role="img"` and
  `aria-label`.

**Verification:**
- `npm run test:unit -- CredentialSyncStatusBadge` passes.
- No axe/design-review regression on the badge.

---

- [ ] **Unit 6: Stabilize `handleSyncNow` useCallback deps (KI-E97-S02-L01)**

**Goal:** Eliminate the stale-closure risk in `handleSyncNow` by adding
`user?.id` to the `useCallback` deps array.

**Requirements:** R6.

**Dependencies:** None.

**Files:**
- Modify: `src/app/components/settings/sections/SyncSection.tsx`

**Approach:**
- Change `}, [busy])` to `}, [busy, user?.id])` on the `handleSyncNow`
  `useCallback`.
- Add a one-line comment if `runFullSync` or `computeTotalSyncedItems`
  closes over any other non-primitive from `user`.

**Patterns to follow:**
- Sibling `handleToggle` (line 174) and `handleConfirmReset` (line 219)
  already include relevant deps — mirror that style.

**Test scenarios:**
- Test expectation: none — no observable behavior change. Existing
  SyncSection tests must continue to pass.

**Verification:**
- `npm run lint` no longer emits react-hooks/exhaustive-deps warnings
  for `handleSyncNow`.
- `npm run test:unit -- SyncSection` passes.

---

- [ ] **Unit 7: Stabilize overlay auto-close via internal `onCloseRef` (KI-E97-S04-L01)**

**Goal:** Prevent the 250 ms auto-close timer from resetting on every
parent re-render by capturing `onClose` in a ref inside
`NewDeviceDownloadOverlay`.

**Requirements:** R7.

**Dependencies:** None.

**Files:**
- Modify: `src/app/components/sync/NewDeviceDownloadOverlay.tsx`

**Approach:**
- Introduce `const onCloseRef = useRef(onClose)`.
- Sync it with `useEffect(() => { onCloseRef.current = onClose }, [onClose])`.
- Replace the direct `onClose()` call inside the auto-close effect body
  with `onCloseRef.current()`.
- Remove `onClose` from the auto-close effect's dep array.

**Patterns to follow:**
- Existing `firstSyncingSeenRef` pattern in
  `src/app/hooks/useDownloadEngineWatcher.ts` — same latched-ref shape.

**Test scenarios:**
- Happy path: Auto-close fires once exactly 250 ms after the `complete`
  transition.
- Edge case: Parent re-renders (e.g., prop change on an unrelated prop)
  during the 250 ms window do not cancel or reset the timer. Add a unit
  test that rerenders the component mid-window and asserts
  `onClose` is still called exactly once.
- Edge case: Unmounting during the window cancels the timer (existing
  cleanup behavior — regression guard).

**Verification:**
- `npm run test:unit -- NewDeviceDownloadOverlay` passes.
- Manual: open a new-device session and confirm the overlay still
  auto-closes in ~250 ms after completion.

---

- [ ] **Unit 8: Watchdog as an optional prop (KI-E97-S04-L02)**

**Goal:** Make the 60 s watchdog testable without fake timers by exposing
`watchdogMs?: number` on `NewDeviceDownloadOverlayProps`.

**Requirements:** R8.

**Dependencies:** Unit 7 (both touch the overlay; land 7 first to keep
diffs small).

**Files:**
- Modify: `src/app/components/sync/NewDeviceDownloadOverlay.tsx`
- Modify: `src/app/components/sync/__tests__/NewDeviceDownloadOverlay.test.tsx`

**Approach:**
- Add `watchdogMs?: number` to `NewDeviceDownloadOverlayProps`.
- Replace `setTimeout(..., WATCHDOG_MS)` with
  `setTimeout(..., watchdogMs ?? WATCHDOG_MS)` — **use the nullish
  coalescing operator (`??`), NOT logical OR (`||`)**. The `??` form
  treats only `null` and `undefined` as "no prop"; `||` would also
  coerce `0` to the default, which silently breaks the `watchdogMs={0}`
  contract (see edge case below).
- Keep the `WATCHDOG_MS = 60_000` constant as the default.
- In tests, pass `watchdogMs={50}` to exercise the watchdog path without
  `vi.useFakeTimers()`.

**Patterns to follow:**
- Other components that accept testability props with sensible defaults
  (search for `Props = {.*?: number` in `src/app/components/`).

**Test scenarios:**
- Happy path: Default — no prop — uses 60 s (verified by reading the
  constant in a snapshot-style assertion, or by ensuring existing
  behavioral tests still pass).
- Happy path: `watchdogMs={50}` — watchdog fires within ~100 ms when no
  transition occurs.
- Edge case (required): `watchdogMs={0}` is explicitly treated the same
  as no prop via the `??` operator — DO NOT use `||` which would fire
  the watchdog immediately (0 ms timeout) and create a silent
  production-footgun if any future caller ever passes `0`. Add a unit
  test that mounts the overlay with `watchdogMs={0}`, advances time by
  100 ms, and asserts the watchdog has NOT fired (i.e., the default
  60_000 ms path is still in effect). This test must fail if the
  implementation is changed to `|| WATCHDOG_MS`.

**Verification:**
- `npm run test:unit -- NewDeviceDownloadOverlay` passes.
- Existing watchdog-related tests simplified (fake timers removed where
  possible).

---

- [ ] **Unit 9: No-regression sweep**

**Goal:** Confirm the cleanup lands cleanly on top of `main` without
breaking any E97 surface.

**Requirements:** R9.

**Dependencies:** Units 1–8.

**Files:**
- No code changes.

**Approach:**
- `npm run lint`
- `npm run test:unit`
- Run the five E97 specs: `npx playwright test story-97-01 story-97-02
  story-97-03 story-97-04 story-e97-s05 --project=chromium`
- Burn-in the new tests from Unit 3 with
  `scripts/burn-in.sh tests/e2e/story-e97-s05-credential-sync-ux.spec.ts`
  (10×) to catch flakiness.
- Smoke-run the full sync E2E suite (`npx playwright test --grep sync`)
  to catch cross-story regressions.

**Test scenarios:**
- Test expectation: all pre-existing tests pass; new tests from Units 1
  and 3 pass; burn-in 10/10 stable.

**Verification:**
- Green CI locally before opening the PR.

## System-Wide Impact

- **Interaction graph:** Unit 7 changes the effect wiring inside
  `NewDeviceDownloadOverlay` but not its external contract. `App.tsx` is
  unchanged.
- **Error propagation:** No change. No error-path code is touched.
- **State lifecycle risks:** None. All changes are either test-only, ref
  hygiene, or dep-array corrections.
- **API surface parity:** Unit 8 adds one optional prop with a default —
  non-breaking for every current caller.
- **Integration coverage:** Unit 3 adds explicit coverage for the
  banner → Library → dialog `CustomEvent` dispatch chain (Architectural
  Concern #3 in the origin report). Does not refactor the chain — that is
  deferred.
- **Unchanged invariants:** All E97 public behavior (header status,
  settings panel controls, wizard flow, download overlay lifecycle,
  credential banner evaluation cadence) is explicitly not changed. The
  cleanup is test-first or hygiene-only.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Unit 2's `waitForFunction` predicates too strict → new flakes | Burn-in 10× in Unit 9; revert to a justified `waitForTimeout` with a proper comment if a signal genuinely isn't observable. |
| Unit 4 deletes a ref that has a non-obvious caller | Grep-first approach; keep fallback with a justification comment if any caller omits `passwordInputRef`. |
| Unit 7's ref latching masks a legitimate re-subscription case | Add the explicit "rerender mid-window" test (scenario 2) as a regression guard; run the E97-S04 E2E to catch real-user behavior. |
| Unit 8's new prop accidentally used in production call sites | Lint/review pass — the prop is only set in tests; a grep confirms no `watchdogMs=` in `src/app/` non-test files before merge. |
| Overlap with E98 work in progress | Scope boundaries explicitly exclude architectural extraction; review Units 7–8 against any E98 branch touching the overlay. |

## Documentation / Operational Notes

- Update `docs/known-issues.yaml`:
  - KI-E97-S02-L01 → `status: resolved` (commit sha in resolution note).
  - KI-E97-S03-L03 → `status: resolved`.
  - KI-E97-S04-L01 → `status: resolved`.
  - KI-E97-S04-L02 → `status: resolved`.
- Add resolution notes for R1-M1, R1-M2, R1-M3, R1-L1, R1-L3 in the E97-S05
  story file under a "Post-merge follow-up" section.
- No runbook changes; no user-facing behavior changes; no rollout notes.

## Sources & References

- **Origin document:** [docs/reviews/code/E97-deep-report-2026-04-21.md](../reviews/code/E97-deep-report-2026-04-21.md)
- Precedent plan: [docs/plans/2026-04-19-001-fix-post-e93-cleanup-plan.md](2026-04-19-001-fix-post-e93-cleanup-plan.md)
- Known issues: [docs/known-issues.yaml](../known-issues.yaml)
- E97-S05 plan: [docs/plans/2026-04-19-026-feat-e97-s05-credential-sync-ux-plan.md](2026-04-19-026-feat-e97-s05-credential-sync-ux-plan.md)
- Related PRs: #381, #382, #383, #385 (all merged)
- Test patterns rule: `.claude/rules/testing/test-patterns.md`
