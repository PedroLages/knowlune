---
module: search
tags: [command-palette, prefix-filters, scope, frecency, cmdk, react-context]
problem_type: best-practice
---

# Search Prefix Scope — Non-Obvious Invariants

**Context:** E117-S03 — Power-User Prefix Filters & Per-Page Search Consolidation.

## Invariants

### 1. Prefix detection is position-0 only

The prefix parser (`/^([cblahn]):(.*)$/`) matches only when the colon appears at position 0 of the raw input. A leading space (e.g., `" c:foo"`) must **not** activate scope — this is the intentional escape hatch for users who want to search for strings containing colons.

### 2. Scope activates on a minimum prefix length of 2 chars (`"c:"`)

A bare `"c"` with no colon never enters scoped mode. The colon is the trigger character, not the letter alone.

### 3. Backspace on empty search-within-scope clears scope (not query)

When `scope !== null && searchQuery === ''`, Backspace must exit scope entirely. If the user types `c:` then presses Backspace, the chip disappears and the full palette unscoped list is shown — the query does not become `"c"`.

### 4. `shouldFilter={false}` invariant on `<Command>`

The cmdk `<Command shouldFilter={false}>` is a load-bearing setting that cannot be removed. All filtering is done by the application (MiniSearch + frecency). Removing `shouldFilter` causes cmdk's internal fuzzy filter to double-filter results unpredictably.

### 5. Empty scoped query shows frecency-ordered top-50, not empty state

When `scope !== null && searchQuery === ''`, render the frecency top list for that entity type — **not** a "no results" empty state and **not** the full unscoped palette. This is AC 23's key requirement and differs from what a user might expect.

### 6. `initialScope` is one-shot; reset on palette close

`<SearchCommandPalette initialScope={...}>` applies the scope only once: in a `useEffect` that fires when `open && initialScope`. When the palette closes, the parent must reset `initialScope` to `null` (in `onOpenChange`) so the next `Cmd+K` open does not re-apply the old scope.

### 7. Hint row appears only when: `isEmptyQuery && !scope && !hintDismissed && !showWelcomeCopy`

All four conditions must hold. If the user is already in scoped mode, the hint is hidden (not needed). If welcome copy is shown (new user with no content), the hint is also hidden (too much information at once).

### 8. Hint dismissal key: `knowlune.searchPrefixHintDismissed.v1`

Uses the `knowlune.` namespace prefix. Reads on mount via lazy `useState` initializer. Writes synchronously on dismiss click. Both read and write are wrapped in try/catch (silent-catch-ok) for quota/disabled-storage robustness.

## Context Architecture

`PaletteControllerContext` holds `{ open(scope?) }` and is provided by `Layout.tsx`. Page components (Courses, Authors) call `usePaletteController().open('course')` — they never directly read or write palette state. This keeps palette state co-located with the component that owns it while enabling any descendant to trigger a pre-scoped open without prop drilling.

## Test Gotchas

- Unit tests for Courses/Authors must mock `HeaderSearchButton` to avoid the `usePaletteController` context requirement.
- E2E tests must seed a real course/author record before opening the scoped palette — empty frecency with empty IDB results in the zero-results branch, not the frecency list branch.
- The `HINT_DISMISS_KEY` localStorage entry must be explicitly removed before hint-row tests, since the test context may inherit a previous test's localStorage state.
