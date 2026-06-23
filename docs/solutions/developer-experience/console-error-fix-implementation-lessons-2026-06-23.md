---
title: Implementation Lessons from Fixing Five Production Console Error Categories
date: 2026-06-23
category: docs/solutions/developer-experience/
module: cross-cutting
problem_type: developer_experience
component: development_workflow
severity: medium
applies_when:
  - Modifying sync table registry entries for insert-only tables
  - Modifying CSP directives, especially script-src hashes
  - Modifying PWA meta tags for cross-browser compatibility
  - Adding or modifying Radix UI Dialog components
  - Modifying embedding worker lifecycle (visibilitychange, termination)
  - Changing behavior covered by guardrail or snapshot tests
related_components:
  - tooling
  - testing_framework
tags:
  - review-process
  - csp
  - sync-registry
  - pwa
  - accessibility
  - aria-describedby
  - dialog
  - embedding-worker
  - console-errors
  - implementation-lessons
---

# Implementation Lessons from Fixing Five Production Console Error Categories

## Context

A single PR ([#615](https://github.com/PedroLages/knowlune/pull/615)) fixed 5 distinct categories of production console errors and warnings observed in the Cloudflare Pages deployment. The fixes spanned the sync engine (insert-only table registry entries), Content Security Policy configuration (inline script hash allowlisting), PWA meta tags (deprecation migration), Radix UI accessibility compliance (missing DialogDescription), and embedding worker lifecycle management (tab-hide termination). While each individual fix was narrow in scope, the review process surfaced cross-cutting lessons about review agent effectiveness, CSP configuration edge cases, and the importance of multi-reviewer consensus for correctness-sensitive changes.

The guiding plan is at `docs/plans/2026-06-23-001-fix-console-errors-and-warnings-plan.md`.

## Guidance

### 1. Sync registry: insert-only tables need cursorField AND stripFields

Insert-only tables (no `updated_at` column in Supabase) require two registry entries in `src/lib/sync/tableRegistry.ts`:

- **`cursorField: 'created_at'`** -- Without this, the download engine queries `updated_at > last_sync_at` which silently returns zero rows for tables that lack an `updated_at` column.
- **`stripFields: ['updatedAt']`** -- Without this, `syncableWrite` stamps an `updatedAt` field into upload payloads for tables without that column, causing PostgREST 400 errors.

Follow the `audioBookmarks` entry (lines 286-295) as the reference pattern:

```typescript
cursorField: 'created_at',
stripFields: ['updatedAt'],
```

Always pair these when adding a new insert-only table to the registry. Also add a database index on `(user_id, created_at)` to support the cursor-based download query.

### 2. CSP hashes only cover inline scripts, not external script tags

When adding a CSP `script-src` hash:

- The hash (`'sha256-...'`) only permits the exact inline script content that produced the CSP violation error. It does NOT apply to external `<script src="...">` tags -- those are already covered by `'self'` (same-origin) or explicit `https://` origins.
- A dynamically-generated inline script from a library runtime (e.g., framer-motion `motion/react` on the track detail page) is the typical source. Capture the hash from the browser's CSP violation error message, not from computing a hash of an external JS file.
- If the library version changes, the hash may change. Verify it after deploys that update the library.

**Lesson**: The initial plan listed `public/reduce-motion-init.js` as a candidate for hashing, but the plan-critic correctly identified that CSP hashes only cover inline scripts, not same-origin external scripts (`<script src="...">`). Always verify CSP hash applicability against the specific violation error message.

### 3. iOS PWA requires both apple-mobile-web-app-capable AND mobile-web-app-capable

Do NOT replace `apple-mobile-web-app-capable` with `mobile-web-app-capable`. Both meta tags must be present:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
```

The `apple-mobile-web-app-capable` tag produces a deprecation warning in non-Apple browsers but is still required for iOS Safari standalone mode. Removing it breaks PWA behavior on iOS. Relying solely on the PWA manifest's `display: 'standalone'` is insufficient -- iOS Safari does not honor the manifest `display` property the same way.

**Lesson**: The adversarial reviewer caught that the plan's approach (replacing one with the other) would break iOS Safari standalone mode. Both tags must coexist.

### 4. DialogDescription must be imported and rendered in every Radix Dialog

Radix UI `DialogContent` emits a "Missing Description or aria-describedby" accessibility warning unless a `DialogDescription` child is present. The fix requires three things:

1. **Import** `DialogDescription` from `@/app/components/ui/dialog` in the destructured import. It is NOT auto-included.
2. **Render** `<DialogDescription className="sr-only">` with contextual text inside `<DialogContent>`.
3. The `className="sr-only"` keeps the description visually hidden (use brief but descriptive text).

Passing `aria-describedby={undefined}` does NOT work -- React normalizes `undefined` props and treats them as not passed at all. The `DialogDescription` element is the only reliable fix.

**Lesson**: The plan correctly identified the fix, but code review discovered that `DialogDescription` was not imported in any of the three files. Each file had a `Dialog, DialogContent, DialogHeader, DialogTitle` import but no `DialogDescription`. Always verify imports when adding usage of an existing component.

### 5. Embedding worker tab-hide: reject pending, don't terminate

When the browser tab is hidden, do NOT call `coordinator.terminate()`. This kills all workers and forces a full model re-download on return. Instead, only reject pending requests while keeping workers alive with the model in memory:

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    coordinator.rejectPendingRequests()
  }
})
```

The `rejectPendingRequests()` method MUST mirror `rejectPendingRequest()` (singular) by calling `decrementActiveRequests()` for each rejected request:

```typescript
rejectPendingRequests(): void {
  this.pendingRequests.forEach(pending => {
    clearTimeout(pending.timeout)
    pending.reject(new Error('Tab hidden -- retry when visible'))
    this.decrementActiveRequests(pending.workerId)  // REQUIRED: prevents worker memory leak
  })
  this.pendingRequests.clear()
}
```

Without this call, the worker's active request counter remains permanently inflated, preventing idle termination from ever firing and leaking the worker in memory until the page is unloaded.

**Lesson**: 4 independent reviewers (code review, adversarial review, exploratory QA, and manual inspection) all caught the missing `decrementActiveRequests()` call. When a method mirrors another, verify every non-trivial side effect is replicated.

### 6. Stale tests must be updated when behavior changes

When fixing production errors, check for related tests that may need updating:

- Acceptance criteria tests for the affected features
- Guardrail tests (e.g., tableRegistry snapshot tests)
- Any integration tests that assert the old (broken) behavior

In this PR, three tests would have failed: the AC3 test for one of the fixes, a tableRegistry guardrail test, and a tableRegistry snapshot test. Snapshot tests in particular are sensitive to registry entry changes.

**Lesson**: When changing sync registry entries, CSP directives, or worker lifecycle, run the full test suite to catch stale expectations.

## Why This Matters

Each of these lessons represents a gap that multiple review passes caught before production impact was wider:

1. **CSP hash scope** -- The plan-critic saved wasted effort and prevented a misleading CSP entry that could confuse future debugging.
2. **Active request counter maintenance** -- This was the single most-reviewed safety issue in the PR. Four reviewers independently identified it, giving high confidence through cross-model consensus.
3. **iOS PWA compatibility** -- The adversarial reviewer caught an iOS-specific regression that would have broken PWA for the entire iOS user base.
4. **Import verification** -- A process gap (assuming imports are already present) that would have caused build failures at best and runtime errors at worst.
5. **Test staleness** -- Three test failures would have occurred post-merge, eroding trust in the test suite. Updating tests alongside fixes maintains test reliability as a safety net.

**Pattern**: Multi-reviewer consensus catches correctness-critical details that any single reviewer might miss. For correctness-sensitive changes (lifecycle management, async state, counter maintenance), multiple review passes provide significant safety margins.

## When to Apply

- When adding a new insert-only table to the sync table registry in `src/lib/sync/tableRegistry.ts`
- When modifying the CSP meta tag in `index.html` -- especially `script-src` hashes
- When modifying PWA meta tags -- especially `apple-mobile-web-app-capable` and related tags
- When adding or modifying Radix UI Dialog components
- When modifying the embedding worker coordinator lifecycle (`visibilitychange`, `beforeunload`, worker termination)
- When changing behavior that has guardrail tests or snapshot tests
- When implementing a fix where multiple reviewers independently flag the same issue

## Examples

**Before (embedding worker tab-hide -- wrong):**
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    coordinator.terminate()
  }
})
```

**After (embedding worker tab-hide -- correct):**
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    coordinator.rejectPendingRequests()
  }
})
```

**Before (sync registry insert-only -- missing fields):**
```typescript
const quizAttempts: TableRegistryEntry = {
  insertOnly: true,
  // Missing cursorField -- download engine uses updated_at which doesn't exist
  // Missing stripFields -- syncableWrite stamps updatedAt into upload payloads
}
```

**After (sync registry insert-only -- correct):**
```typescript
const quizAttempts: TableRegistryEntry = {
  insertOnly: true,
  cursorField: 'created_at',
  stripFields: ['updatedAt'],
}
```

**Before (PWA meta tag -- wrong, replacing instead of adding):**
```html
<meta name="mobile-web-app-capable" content="yes">
<!-- apple-mobile-web-app-capable was removed -- breaks iOS -->
```

**After (PWA meta tag -- correct, both present):**
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
```

## Related

- Sync patterns: `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md` (Pattern 3 -- insert-only tables)
- Sync patterns: `docs/solutions/sync/e96-closeout-sync-patterns-2026-04-19.md` (Pattern 1 -- cursor index)
- Worker fallbacks: `docs/solutions/runtime-errors/note-qa-embedding-fallback-2026-04-28.md`
- Dialog accessibility: `docs/solutions/ui-bugs/search-command-palette-rendering-fixes-2026-05-06.md` (incidental DialogDescription mention)
- PWA lessons: `docs/solutions/e120-pwa-polish-lessons.md` (CSP bypass pattern for MediaMetadata artwork)
- Review process: `docs/solutions/workflow-issues/ce-orchestrator-inline-review-bypass-quality-gap-2026-05-07.md` (the importance of structured review gates)
- Implementation plan: `docs/plans/2026-06-23-001-fix-console-errors-and-warnings-plan.md`
- Reference pattern for insert-only tables: `src/lib/sync/tableRegistry.ts` lines 286-295 (`audioBookmarks`)
