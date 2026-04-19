---
title: Unified Search Index — seven non-obvious invariants the implementation relies on
date: 2026-04-18
category: best-practices
module: search
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - Building or modifying the unified search index (courses, authors, lessons)
  - Touching the cmdk-based search palette or its a11y affordances
  - Wiring a MiniSearch-style index to Dexie-backed stores
  - Debugging "missing results", "stale results", or "results flicker" in search
related_components:
  - database
  - testing_framework
tags:
  - search
  - minisearch
  - cmdk
  - indexeddb
  - dexie
  - accessibility
  - react
---

# Unified Search Index — seven non-obvious invariants the implementation relies on

## Context

E117-S01 shipped the first slice of the unified search index (PR #350, merged to `main`) —
a cmdk-powered palette backed by an incremental MiniSearch index that hydrates from Dexie
and stays in sync with store writes. The implementation is deceptively small, but it rests
on seven decisions that look like stylistic choices and are actually load-bearing. Each
one was validated during the run; reverting any of them reintroduces a bug class we
already fixed. Capturing them here so the next person who touches this code — including
future Claude sessions — does not silently regress them.

Plan: [docs/plans/2026-04-18-009-feat-unified-search-index-story-1-plan.md](../../plans/2026-04-18-009-feat-unified-search-index-story-1-plan.md)
PR: https://github.com/PedroLages/knowlune/pull/350

## Guidance

Seven invariants. Each is non-obvious — the "clean" refactor in every case is wrong.

### 1. `useMemo` is used for its synchronous-during-render side effect, not for memoization

The index-sync layer uses `useMemo` to update refs **before** `useEffect` reads them on the
same render. A `useEffect` that sets the refs runs after commit and is too late — the
consumer effect has already observed stale refs. Do not "fix" this by switching to
`useEffect`, and do not remove the `useMemo` because the dependency array looks redundant.
The memoization is incidental; the render-phase write is the point.

```ts
// CORRECT — ref is fresh by the time dependent effects run
useMemo(() => {
  snapRef.current = nextSnap;
  return nextSnap;
}, [nextSnap]);
```

### 2. `getIndexedIds()` seeds first-mount snap refs

`deferInit` does a bulk load on first mount. Without seeding the snap refs from
`getIndexedIds()`, the diffing layer then sees every already-indexed doc as "new" and
re-indexes the full corpus on the next tick. The seeding call is a one-shot on mount
and **must** precede the first diff.

### 3. Never array-destructure `Promise.allSettled` results

```ts
// CORRECT
const results = await Promise.allSettled([...]);
const items = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

// WRONG — silently drops errors, and TS won't save you because the
// destructured value's type includes `rejected`
const [a, b, c] = await Promise.allSettled([...]);
```

`allSettled` returns `PromiseSettledResult<T>[]`. Any code that accesses `.value` without
first narrowing on `status === 'fulfilled'` is a latent bug. Use `flatMap` with the guard.

### 4. cmdk 1.1.1: `shouldFilter={false}` is the supported API, not `filter={() => 1}`

On cmdk 1.1.1, passing a custom `filter` prop that always returns `1` mostly works but
produces subtle ordering artifacts and breaks keyboard navigation in edge cases.
`shouldFilter={false}` is the intended escape hatch when you're supplying externally
ranked results (MiniSearch scores in our case). Use it.

### 5. `getMergedAuthors()` is the authors corpus source — not raw `db.authors`

The authors page renders from `getMergedAuthors()`, which joins Dexie data with the
merged/fallback author projection. Indexing raw `db.authors` produces results that
resolve to routes or display names that don't match what the user sees on the page —
classic "I searched for this author and clicked it but it's not the same author."
The indexer must consume the same projection the page renders from.

### 6. Home/End in cmdk needs a manual `onKeyDown` handler

cmdk 1.1.1 does not natively jump the active item to first/last on `Home`/`End`. The
working pattern: on `keydown`, find the first or last `[cmdk-item]` in the list and
dispatch a synthetic `mousemove` at its coordinates. cmdk's internal pointer tracker
then promotes it to active. No other trick (focus(), setAttribute, scrollIntoView)
produces the correct state.

```ts
function handleKeyDown(e: React.KeyboardEvent) {
  if (e.key !== 'Home' && e.key !== 'End') return;
  const items = listRef.current?.querySelectorAll('[cmdk-item]');
  if (!items?.length) return;
  const target = e.key === 'Home' ? items[0] : items[items.length - 1];
  const rect = (target as HTMLElement).getBoundingClientRect();
  target.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    clientX: rect.left + 1,
    clientY: rect.top + 1,
  }));
  e.preventDefault();
}
```

### 7. `aria-live` announcements need a separate settle delay from the search debounce

The search debounce is 150ms (perceived responsiveness). The `aria-live="polite"` region
uses a separate **400ms** settle delay. If you reuse the 150ms debounce for the live
region, screen readers cut off announcements mid-sentence as results continue arriving,
and users hear "1 result… 3 results… 5 results" for a single keystroke. The two delays
serve different consumers and must remain independent.

## Why This Matters

Each invariant above is a bug that was found and fixed during E117-S01. Every one of them
looks like something a well-intentioned refactor would "clean up":

- (1) "Why is there a `useMemo` that just assigns a ref? Move it to `useEffect`." — reintroduces
  the stale-ref race.
- (2) "The diff layer handles empty state, we don't need to seed." — re-indexes the
  corpus every mount.
- (3) "`allSettled` returns values, just destructure them." — silently drops errors.
- (4) "`filter={() => 1}` already works, why change the API?" — keyboard navigation
  regressions.
- (5) "`db.authors` is the source of truth." — search results don't match rendered pages.
- (6) "cmdk handles keyboard nav, we don't need a handler." — `Home`/`End` don't work.
- (7) "One debounce for the whole feature." — screen reader announcements get clipped.

The common thread: the "correct" version of the code is not the shortest or most
idiomatic version. Each line exists because a simpler alternative was tried and
broke something specific.

## When to Apply

- Modifying any file under `src/lib/search/` or the unified search palette component
- Adding a new corpus (e.g., lessons, notes) to the index — apply the `getMergedAuthors`
  pattern: index the same projection the page renders from
- Upgrading cmdk — re-validate invariants 4 and 6 against the new version
- Reviewing PRs that touch the index-sync layer — watch for refactors that violate 1, 2, or 3

## Examples

The canonical implementation is the state of the repo at merge of PR #350. Key files:

- `src/lib/search/` — index, corpus, diffing layer
- `src/app/components/search/` — cmdk palette, keyboard handlers, aria-live region

When in doubt, read the committed code and the plan in
`docs/plans/2026-04-18-009-feat-unified-search-index-story-1-plan.md` before
"simplifying."

## Related

- [docs/plans/2026-04-18-009-feat-unified-search-index-story-1-plan.md](../../plans/2026-04-18-009-feat-unified-search-index-story-1-plan.md)
- PR #350 — https://github.com/PedroLages/knowlune/pull/350
- `docs/engineering-patterns.md` — broader accessibility + async patterns
