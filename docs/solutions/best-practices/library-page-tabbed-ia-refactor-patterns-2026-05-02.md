---
title: Library Page Tabbed IA Refactor: Patterns and Learnings
date: 2026-05-02
category: best-practices
module: library
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Restructuring a monolithic React page into a tabbed/multi-view IA
  - Adding tab persistence with URL params and localStorage
  - Creating data-testid attributes on paired trigger/content elements
  - Computing aggregate stats over arrays in render paths
  - Adding CSS transitions to interactive elements
tags:
  - library
  - tabbed-ia
  - data-testid
  - url-sync
  - tab-persistence
  - code-refactoring
  - shelf-integration
  - e2e-testing
---

# Library Page Tabbed IA Refactor: Patterns and Learnings

## Context

The Library page (`src/app/pages/Library.tsx`) grew to 1156 lines as features accumulated — shelf rows, hero section, smart grouped collections, format tabs, reading queue, and daily highlights. The page lacked a clear default action for returning users, mixing too many entry points without an obvious "what should I do next?" landing view. An ideation session in April 2026 proposed a tabbed IA with four views: **Continue | Browse | Collections | History**.

Prior sessions established the foundation: `LibraryShelfRow`, `LibraryShelfHeading`, and `ShelfSeeAllLink` primitives were extracted across E116-S01/S02, and shelf data wiring landed in E116-S03. Stitch was evaluated as a full-page redesign tool but rejected for this page — it fights existing component architecture on dense pages (session history). The approach instead was to compose new shadcn/ui-based tab components atop the existing primitive layer.

Seven distinct patterns emerged during this refactor that generalize to any React page being restructured into a multi-tab layout.

## Guidance

### 1. Tab persistence: URL param > localStorage > default, with bidirectional sync

Initialize tab state from the URL first (supports deep links and browser back/forward), fall back to localStorage (survives page reloads without URL param), then default to the landing tab. Sync changes back to both sources so the URL stays in sync and the preference persists.

```typescript
// --- Source of truth for valid values (Set prevents typo bugs) ---
export const VALID_LIBRARY_TABS: ReadonlySet<string> = new Set([
  'continue', 'browse', 'collections', 'history',
])
export type LibraryTab = 'continue' | 'browse' | 'collections' | 'history'

// --- Initialize: URL param > localStorage > default ---
const [libraryTab, setLibraryTab] = useState<LibraryTab>(() => {
  const urlTab = searchParams.get('tab')
  if (urlTab && VALID_LIBRARY_TABS.has(urlTab)) return urlTab as LibraryTab
  const stored = localStorage.getItem('knowlune-library-tab')
  if (stored && VALID_LIBRARY_TABS.has(stored)) return stored as LibraryTab
  return 'continue'
})

// --- Sync: update both URL (pushState replace) and localStorage ---
const handleTabChange = useCallback((tab: LibraryTab) => {
  setLibraryTab(tab)
  try { localStorage.setItem('knowlune-library-tab', tab) } catch { /* quota-exceeded */ }
  setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    next.set('tab', tab)
    return next
  }, { replace: true })
}, [setSearchParams])
```

Using `{ replace: true }` avoids polluting the browser history stack — every tab switch doesn't add an entry, but the URL still reflects the current tab for deep linking.

### 2. Validate runtime string values with a Set, not inline comparison

URL params and localStorage values are strings from external sources — they can be anything. Validate with a `Set.has()` check to avoid duplicated inline comparisons and to guarantee type safety across the module boundary.

```typescript
// Exported from the tab bar component for reuse in the page:
export const VALID_LIBRARY_TABS: ReadonlySet<string> = new Set([
  'continue', 'browse', 'collections', 'history',
])
```

This replaces the pattern of inlining `=== 'continue'` checks in multiple places.

### 3. Disambiguate testid attributes for paired trigger/content elements

When a tab trigger button and its content panel both need `data-testid`, they **must** use different suffixes. Playwright's `getByTestId` throws a **strict mode violation** if the same testid matches two elements.

```typescript
// Tab button (trigger element in LibraryTabBar):
<button data-testid={`library-tab-${tab.id}`} ... />

// Content panel (rendered in Library.tsx):
<section data-testid={`library-tab-panel-${tab.id}`} ... />
```

This produces `library-tab-continue` (the button) and `library-tab-panel-continue` (the content area) — distinct, grep-friendly, and unambiguous.

### 4. Use the single-key setter when changing one filter dimension

The library's filter store exposes two APIs: `setFilter(key, value)` to change one dimension, and `setFilters(object)` to replace all dimensions. Calling `setFilters({ source: 'audiobookshelf' })` resets format, status, and any other active filters to defaults — destructive.

```typescript
// ✅ CORRECT — changes only 'source', preserves 'format' and 'status'
setFilter('source', 'audiobookshelf')

// ❌ WRONG — replaces ALL filters with just { source: 'audiobookshelf' }
setFilters({ source: 'audiobookshelf' })
```

### 5. Wrap localStorage writes in try/catch

`localStorage.setItem()` throws `QuotaExceededError` in private browsing or when storage is full and the origin has exceeded its quota. A failed write should never crash the tab-change handler, since the tab state survives in React component state for the current session.

```typescript
try {
  localStorage.setItem('knowlune-library-tab', tab)
} catch {
  // Non-critical — tab state lives in React state for this session
}
```

### 6. Prefer a single-pass for loop over cascading filter().reduce()

When computing multiple aggregates from the same array, a single `for` loop avoids three passes through the data. On a library with thousands of books this measurably reduces interaction latency.

```typescript
// ✅ Single pass:
let finishedThisYear = 0
let totalPages = 0
let totalSeconds = 0
for (const b of books) {
  if (b.status !== 'finished' || !b.finishedAt?.startsWith(currentYear)) continue
  finishedThisYear++
  totalPages += b.totalPages ?? 0
  if (b.format === 'audiobook') totalSeconds += b.totalDuration ?? 0
}

// ❌ Three passes (before):
// const f = books.filter(b => ...).reduce(...)
// const p = books.filter(b => ...).reduce(...)
// const s = books.filter(b => ...).reduce(...)
```

### 7. Prefix transition utilities with `motion-safe:` for reduced-motion compliance

WCAG 2.1 requires that motion animations respect the user's `prefers-reduced-motion` system setting. Tailwind CSS v4 provides the `motion-safe:` variant for this.

```tsx
className={cn(
  'rounded-full px-4 py-1.5 text-sm font-medium',
  'motion-safe:transition-all motion-safe:duration-200',
  // ...
)}
```

### 8. E2E: Continue shelf requires lastOpenedAt on book data

The `getContinueReadingShelf()` selector requires both `book.lastOpenedAt` (truthy) and `isInProgress(book)` to include a book. Test seed data that omits `lastOpenedAt` will produce an empty Continue shelf, causing assertion failures that look like rendering bugs.

```typescript
await seedBooks(page, [
  {
    lastOpenedAt: FIXED_DATE,  // REQUIRED for Continue shelf
    progress: 45,               // isInProgress needs progress > 0
    status: 'reading',
  },
])
```

## Why This Matters

| Pattern | Failure mode without it |
|---------|----------------------|
| URL param persistence | Browser back/forward breaks tab state; E2E tests can't directly navigate to a tab |
| localStorage persistence | Tab preference lost on page reload |
| Set-based validation | Invalid tab value from URL or localStorage silently produces a blank page |
| Distinct testid patterns | Playwright `strict mode violation` — entire test suite for the page breaks |
| `setFilter` vs `setFilters` | Clicking one filter silently clears all others; user loses their search/filter context |
| try/catch localStorage | `QuotaExceededError` crashes the tab-change handler mid-switch |
| Single-pass for loop | O(3n) on large libraries adds visible latency in stats rendering |
| `motion-safe:` transition | Users with vestibular disorders experience jarring, unstoppable animations |
| `lastOpenedAt` in seed data | Continue shelf is empty in tests; looks like a rendering bug, wastes investigation time |

## When to Apply

- Adding a tabbed IA to any React page with URL-routable views
- Creating `data-testid` attributes on paired trigger and content elements (tabs, accordions, dialogs)
- Calling a batch setter API (`setFilters`-like) when only one dimension needs changing
- Writing to localStorage from any component in the render/effect path
- Computing aggregate stats over an array in a render function or `useMemo`
- Adding CSS `transition-*` utilities to any interactive element
- Seeding test data for shelf-like selectors with timestamp-based filtering

## Examples

**Full tab persistence cycle (initialization + sync):**

```typescript
// Initialize
const [libraryTab, setLibraryTab] = useState<LibraryTab>(() => {
  const urlTab = searchParams.get('tab')
  if (urlTab && VALID_LIBRARY_TABS.has(urlTab)) return urlTab as LibraryTab
  const stored = localStorage.getItem('knowlune-library-tab')
  if (stored && VALID_LIBRARY_TABS.has(stored)) return stored as LibraryTab
  return 'continue'
})

// Sync
const handleTabChange = useCallback((tab: LibraryTab) => {
  setLibraryTab(tab)
  try { localStorage.setItem('knowlune-library-tab', tab) } catch { /* ok */ }
  setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    next.set('tab', tab)
    return next
  }, { replace: true })
}, [setSearchParams])
```

**E2E testid selectors for tab tests:**

```typescript
// Tab button selector:
page.locator('[role="tab"][data-testid="library-tab-continue"]')

// Content panel selector:
page.locator('[data-testid="library-tab-panel-continue"]')

// Combined in one locator:
const TAB_BUTTON = (id: string) => `[role="tab"][data-testid="library-tab-${id}"]`
const TAB_PANEL = (id: string) => `[data-testid="library-tab-panel-${id}"]`
```

## Related

- [Extract Shared Primitive on Second Consumer](../best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md) — the extraction pattern that produced the shelf primitives consumed by the tabbed IA
- [Unified Course Card Shared Shell Pattern](../best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md) — card composition pattern used alongside shelf cards
- PR [#483](https://github.com/PedroLages/knowlune/pull/483) — the merged PR containing the full tabbed IA implementation (21 files, 853 insertions)
