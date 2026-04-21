---
title: Post-E97 Cleanup — Testability Prop Design and Overlay Ref Latching Patterns
date: 2026-04-21
module: sync-ux
component: NewDeviceDownloadOverlay, CredentialSetupBanner, CredentialSyncStatusBadge
problem_type: best_practice
category: best-practices
tags:
  - testability
  - react-hooks
  - overlay-components
  - ref-latching
  - nullish-coalescing
  - e2e-testing
  - waitforfunction
  - playwright
  - useCallback
  - stale-closure
track: knowledge
status: resolved
source_pr: https://github.com/PedroLages/knowlune/pull/396
source_plan: docs/plans/2026-04-21-001-fix-post-e97-cleanup-plan.md
source_branch: feature/post-e97-cleanup-test-gaps-quality
---

# Post-E97 Cleanup — Testability Prop Design and Overlay Ref Latching Patterns

## Context

E97 shipped five stories building the sync-UX surface (banner, header status
pill, settings panel, wizard, new-device download overlay, credential
deep-link focus). The post-epic deep review enumerated 15 follow-ups; ten
were small enough to bundle into a single cleanup PR (#396) off `main`.

The cleanup itself was mechanical, but four of the items surfaced
non-obvious lessons about **how to design React components and E2E tests
for long-term testability**:

1. Overlay components with timed side effects need internal ref latching
   to decouple effect lifetime from parent prop stability.
2. Testability props that swap a constant for a parameter must use `??`,
   not `||`, to preserve the "0 is a valid sentinel" contract.
3. Playwright `page.waitForTimeout` replacements need pre-enumerated
   candidate predicates, not implementer discretion, to avoid flake.
4. E2E `test(...)` blocks that mutate the URL need explicit per-test
   resets — Playwright's browser-context isolation does NOT reset the
   in-memory page URL across blocks sharing a file-level `beforeEach`.

These are the lessons worth compounding; the actual diffs were small.

## Guidance

### 1. Latch mutable callbacks in a ref inside overlay components

When an overlay component runs a timed effect (auto-close, watchdog,
debounced action) whose dep array would otherwise include a parent-supplied
callback, **capture the callback in an internal ref and remove it from the
effect's deps** — do not rely on the call site to remember `useCallback`.

**Why:** Ownership lives with the component that has the timer, not the
caller. Every future caller gets stability for free.

```tsx
// Before — timer resets on every parent re-render that changes onClose identity
useEffect(() => {
  if (storeStatus === 'complete') {
    const t = setTimeout(() => onClose(), 250)
    return () => clearTimeout(t)
  }
}, [open, storeStatus, progress.done, progress.total, progress.processed, onClose])

// After — onClose latched in a ref; effect only re-runs on real state changes
const onCloseRef = useRef(onClose)
useEffect(() => { onCloseRef.current = onClose }, [onClose])

useEffect(() => {
  if (storeStatus === 'complete') {
    const t = setTimeout(() => onCloseRef.current(), 250)
    return () => clearTimeout(t)
  }
}, [open, storeStatus, progress.done, progress.total, progress.processed])
```

**Regression guard test (mandatory):** Render the component, trigger the
timed path, rerender with an unrelated prop change mid-window, then assert
the callback fired exactly once.

### 2. Use `??` not `||` for testability props with numeric defaults

When you hoist a constant to an optional prop so tests can override it,
the override operator must be `??`:

```tsx
// Before
const WATCHDOG_MS = 60_000
setTimeout(fire, WATCHDOG_MS)

// After — correct
setTimeout(fire, watchdogMs ?? WATCHDOG_MS)

// After — WRONG: `0` collapses to 60s, silently breaking future callers
setTimeout(fire, watchdogMs || WATCHDOG_MS)
```

**Why:** `||` coerces `0`, `''`, `NaN`, and `false` to the default. For a
numeric "delay/timeout/threshold" prop, `0` is a semantically valid value
("no delay" or "never fire"). If `watchdogMs={0}` is ever used as a
sentinel — or even just accidentally passed — `||` fires the timer
immediately in production. This is a silent production footgun.

**Regression guard test (mandatory):** Mount with `watchdogMs={0}`,
advance timers past 100 ms, assert the watchdog has NOT fired. This
test fails if the implementation regresses to `||`.

### 3. Pre-enumerate candidate predicates when replacing `waitForTimeout`

Replacing `page.waitForTimeout(500)` with a deterministic wait is only
robust if the replacement predicate is **chosen before the work starts**,
not during implementation. Otherwise implementers reach for the nearest
comment-justified escape hatch and flake persists.

**Pattern:** For each `waitForTimeout` call site, the plan enumerates:

- **Candidate A (preferred):** the specific DOM element / attribute that
  appears when the thing we're waiting for has actually happened
  (`page.getByTestId('x').waitFor({ state: 'attached' })`,
  `page.waitForFunction(() => document.querySelector('...') !== null)`)
- **Candidate B (fallback):** a secondary observable signal
  (localStorage sentinel, `document.readyState`, known-stable post-
  hydration element)
- **Justification-comment escape hatch:** only permitted if BOTH A and B
  were attempted locally and produced unstable signals; the commit
  message names which two predicates failed and why.

**Why:** "Add a comment and move on" is the path of least resistance.
Forcing two attempts before allowing the escape hatch kills that
shortcut while still leaving a pressure-release valve for genuinely
unobservable waits (animations with no DOM signal).

### 4. Reset URL explicitly in Playwright blocks that navigate with query params

Playwright's browser-context isolation clears cookies, `localStorage`,
and `sessionStorage` between `test(...)` blocks — **but not the in-memory
URL of the page object** when blocks share a file-level `beforeEach`
fixture. A test that navigates to `/library?focus=opds:abc` leaks that
search param into the next test.

```ts
test.describe('deep-link edge flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library')            // reset URL/search params
    await page.evaluate(() => sessionStorage.clear()) // if flows write dismissal flags
  })
  // ...blocks that call page.goto('/library?focus=opds:<id>') safely
})
```

**Why:** Silent contamination. Flow A exercises the deep-link focus
chain correctly, then Flow B inherits `?focus=...` and accidentally
exercises the same chain while asserting on something else. Tests
pass; the new coverage is a lie.

## Why This Matters

- **Overlay ref latching (Guidance 1):** Without this pattern, every
  consumer of `NewDeviceDownloadOverlay` — and every future overlay
  component with a timed effect — silently depends on the caller
  wrapping its handler in `useCallback`. That's a cross-file invariant
  the type system cannot enforce. Internal latching makes the component
  self-sufficient.

- **`??` vs `||` (Guidance 2):** The `0` edge case is the tell. If a
  reviewer catches `watchdogMs || WATCHDOG_MS`, the real question isn't
  just "does `0` work today?" — it's "does the author understand that
  numeric props with sensible defaults have a semantically valid `0`?"
  The `??` choice signals awareness of the whole coercion trap.

- **Candidate enumeration (Guidance 3):** The anti-pattern this
  prevents is subtle — tests that pass reliably but wait on the wrong
  thing. A `waitForTimeout(500)` that happens to be long enough for
  the real operation will be green in CI forever, then flake once on a
  slow machine. Pre-enumerating predicates forces engagement with what
  is actually being awaited.

- **URL reset (Guidance 4):** The failure mode is "coverage that isn't
  coverage." The test passes its assertion for the wrong reason because
  it inherited state from the previous block. This bug is invisible
  until something changes the order of blocks or someone adds a new
  flow that depends on a clean URL.

## When to Apply

**Apply Guidance 1 (ref latching)** when:
- Building any overlay, toast, drawer, or dialog with a timed effect.
- The effect's dep array includes a callback prop (`onClose`, `onDismiss`,
  `onConfirm`, `onTimeout`).
- Parent re-renders could plausibly produce a new callback identity.

**Apply Guidance 2 (`??` over `||`)** when:
- Hoisting a numeric constant to an optional prop for testability.
- The prop represents a delay, timeout, threshold, count, or any value
  where `0` is semantically distinct from "not set."
- Any time you're about to write `someProp || DEFAULT` for a non-boolean
  prop — stop and consider whether falsy-but-valid values exist.

**Apply Guidance 3 (candidate predicates)** when:
- Replacing `page.waitForTimeout` in any Playwright spec.
- Writing a new spec that needs to wait for an async state transition
  without a single-step observable signal.

**Apply Guidance 4 (URL reset)** when:
- Any `test(...)` block in a Playwright file calls `page.goto` with a
  query string.
- Multiple blocks in the same file share a file-level `beforeEach` and
  could run in any order.
- You introduce a new "edge flow" nested `describe` that shares fixtures
  with existing flows.

## Examples

### Ref latching — stable watchdog/auto-close pattern

See `src/app/components/sync/NewDeviceDownloadOverlay.tsx` (post-#396)
and the sibling pattern in `src/app/hooks/useDownloadEngineWatcher.ts`
(`firstSyncingSeenRef`). Both use `const xRef = useRef(x); useEffect(() => { xRef.current = x }, [x])`
and read `xRef.current` from the timed effect body.

### Testability prop with `??`

```tsx
interface NewDeviceDownloadOverlayProps {
  // ...
  /** Test-only override. Production callers should omit. Default 60_000. */
  watchdogMs?: number
}

const WATCHDOG_MS = 60_000

// Inside the component:
const timeoutId = setTimeout(fireWatchdog, watchdogMs ?? WATCHDOG_MS)
```

With the matching regression test:

```tsx
it('treats watchdogMs={0} as "not set" (uses default 60s)', async () => {
  render(<NewDeviceDownloadOverlay {...baseProps} watchdogMs={0} />)
  await vi.advanceTimersByTimeAsync(100)
  expect(onWatchdogFire).not.toHaveBeenCalled()
})
```

### Candidate-predicate enumeration in a plan

From the E97 cleanup plan, Unit 2:

> **`tests/e2e/story-97-03.spec.ts:187`** — the test is awaiting the
> one-shot wizard evaluation after `setFakeAuthUser(page)` so it can
> branch on `wizard.count() > 0`. The evaluation writes one of two
> observable signals:
> - **Candidate A (preferred):** the wizard mounts —
>   `page.getByTestId('initial-upload-wizard').waitFor(...)`
> - **Candidate B (fallback):** poll the completion flag —
>   `page.waitForFunction(() => localStorage.getItem('sync:wizard:complete:test-user') !== null)`

Implementers pick A; if A flakes locally, they try B; only if both flake
does the justification-comment fallback become available.

### URL reset in a nested describe

```ts
test.describe('E97-S05 deep-link edge flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library')
  })

  test('deep-link focuses password input when dialog pre-open', async ({ page }) => {
    await openOpdsDialog(page)
    await page.goto('/library?focus=opds:catalog-1')
    await expect(page.getByLabel('Password')).toBeFocused()
  })

  test('badge popover shows "Why?" body copy', async ({ page }) => {
    // starts at clean /library, not /library?focus=... from previous block
    await page.getByTestId('credential-sync-badge').hover()
    await expect(page.getByText(/why\?/i)).toBeVisible()
  })
})
```

## Related

- Precedent plan: [docs/plans/2026-04-19-001-fix-post-e93-cleanup-plan.md](../../plans/2026-04-19-001-fix-post-e93-cleanup-plan.md)
- Origin review: [docs/reviews/code/E97-deep-report-2026-04-21.md](../../reviews/code/E97-deep-report-2026-04-21.md)
- Test patterns rule: [.claude/rules/testing/test-patterns.md](../../../.claude/rules/testing/test-patterns.md)
- PR: https://github.com/PedroLages/knowlune/pull/396
