---
title: Library 'all' mode unreachable because activeModeLabel string comparisons blocked format-independent logic
date: 2026-05-07
category: ui-bugs
module: library
problem_type: ui_bug
component: frontend_stimulus
severity: medium
symptoms:
  - 'Continue tab showed "No items in this view yet" when both formats existed and no format filter was set'
  - 'Empty-state switch-format button toggled to the wrong format in all-mode'
  - 'Connect Audiobookshelf button only appeared in audiobook-only mode, not in all-mode'
  - 'LibraryMediaHero type union did not include "Books" -- prop type mismatch'
  - 'Hero CTA button read "Explore items" instead of "Explore book" when no format was selected'
root_cause: logic_error
resolution_type: code_fix
tags:
  - library
  - format-filter
  - active-modelabel
  - enum-comparisons
  - react
  - refactoring
  - stringly-typed
related_components:
  - LibraryMediaHero
---

# Library 'all' mode unreachable because activeModeLabel string comparisons blocked format-independent logic

## Problem

After the initial format-defaulting fix (see related docs), `Library.tsx` still had three code paths that prevented `'all'` mode from working correctly in the Continue tab. The root cause was a pattern of using `activeModeLabel` (a display string) for conditional logic instead of `activeFormatTab` (a format enum). This made the logic fragile to label changes and required updating three separate switch-format comparison sites plus the downstream component's type union.

## Symptoms

- Continue tab empty state showed "No items in this view yet" with "Switch to" button toggling the wrong format.
- The Connect Audiobookshelf button was hidden in `'all'` mode because the gate compared against the display label `'Audiobooks'` instead of the format tab value `'audiobooks'`.
- If `LibraryMediaHero` received `'Books'` as a label (the intended new value), TypeScript would error because the type union was `'Audiobooks' | 'Ebooks' | 'Items'`.

## What Didn't Work

- **Simply changing `'Items'` to `'Books'` in `activeModeLabel` without also fixing the comparison sites.** The label change alone would have broken the empty-state logic and the Connect ABS gate because they relied on `activeModeLabel === 'Audiobooks'` for decision-making. When the unset-format case returned `'Books'` instead of `'Items'`, all three `=== 'Audiobooks'` comparisons still worked for single-format cases but the `=== 'Items'` checks would never match.
- **Fixing only one of the two `'Items'` return sites in `activeModeLabel`.** The function had two code paths returning `'Items'`: the early-return guard and the fallthrough. Either one left unmasked could surface the wrong string.
- **Treating the Connect ABS gate as a simple find-and-replace.** The old condition `activeModeLabel === 'Audiobooks'` was not equivalent to `activeFormatTab === 'audiobooks'` because the old condition also covered `'all'` mode (via the `'Items'` return). The correct replacement was `activeFormatTab !== 'ebooks'`, which covers both `'all'` and `'audiobooks'` modes.

## Solution

The fix involved four coordinated changes:

### 1. Update `activeModeLabel` to return `'Books'` instead of `'Items'`

Both return sites in the `useMemo` had to change:

```typescript
// Before: both paths returned 'Items'
const activeModeLabel = useMemo(() => {
  const f = filters.format
  if (!f || f.length === 0) return 'Items' as const   // <-- was 'Items'
  if (f.length === 1 && f[0] === 'audiobook') return 'Audiobooks' as const
  if (f.every(v => v === 'epub' || v === 'pdf')) return 'Ebooks' as const
  return 'Items' as const                              // <-- was 'Items'
}, [filters.format])

// After: both return 'Books'
const activeModeLabel = useMemo(() => {
  const f = filters.format
  if (!f || f.length === 0) return 'Books' as const    // <-- now 'Books'
  if (f.length === 1 && f[0] === 'audiobook') return 'Audiobooks' as const
  if (f.every(v => v === 'epub' || v === 'pdf')) return 'Ebooks' as const
  return 'Books' as const                              // <-- now 'Books'
}, [filters.format])
```

### 2. Switch comparison sites from `activeModeLabel` to `activeFormatTab`

Three sites used `activeModeLabel` for format decision-making:

| Site | Old condition | New condition |
|------|--------------|---------------|
| Empty-state heading/description | `activeModeLabel === 'Items'` | `activeFormatTab === 'all'` |
| Switch-format button setFilter | `activeModeLabel === 'Audiobooks'` | `activeFormatTab === 'audiobooks'` |
| Switch-format button text | `activeModeLabel === 'Audiobooks'` | `activeFormatTab === 'audiobooks'` |
| Connect ABS gate | `activeModeLabel === 'Audiobooks'` | `activeFormatTab !== 'ebooks'` |

Note the Connect ABS gate used a **different** expression (`!== 'ebooks'` instead of `=== 'audiobooks'`) because it needed to be visible in both `'all'` and `'audiobooks'` modes.

### 3. Update `LibraryMediaHero` type union and CTA logic

```typescript
// Before
modeLabel: 'Audiobooks' | 'Ebooks' | 'Items'
// After
modeLabel: 'Audiobooks' | 'Ebooks' | 'Books'
```

And the CTA text comparison:

```typescript
// Before
: modeLabel === 'Items'
  ? 'Explore book'
  : `Explore ${modeLabel.toLowerCase()}`
// After
: modeLabel === 'Books'
  ? 'Explore book'
  : `Explore ${modeLabel.toLowerCase()}`
```

### 4. Add E2E tests for single-format auto-filter behavior

The existing E2E suite only covered mixed-format scenarios. New tests verified:
- Audiobooks-only library auto-selects the Audiobooks tab
- Ebooks-only library auto-selects the Ebooks tab
- Mixed-format library shows 'Books' badge in all-mode

New seed helpers were added: `tabSeedsAudiobooksOnly()` and `tabSeedsEbooksOnly()`.

## Why This Works

The core insight is that `activeModeLabel` is a **display string** -- it exists to render user-facing text like "Audiobooks" or "Books". Using it for conditional logic creates a fragile coupling: changing any label value silently breaks all comparisons against that value. By switching to `activeFormatTab` (an enum with stable values `'audiobooks'`, `'ebooks'`, `'all'`), the logic becomes independent of whatever display string is chosen.

The `'Items'` label was originally chosen as a neutral default for unset/mixed format, but it was confusing to users -- "Items" is a generic term that doesn't communicate "library books." Changing to `'Books'` communicates the content more clearly. The switch-format comparisons didn't need the full `activeModeLabel` context; they only needed to know which format tab is active.

## Prevention

- **Never use display labels for conditional logic.** Prefer enum-based separators (`activeFormatTab`, `activeTabId`, etc.) over string comparison against `activeModeLabel` or similar display-derived values. The display label should only be used for rendering -- all branching decisions should use a stable format or mode identifier.
- **When adding a new enum value to a display label union, audit all comparison sites.** `activeModeLabel` had two return sites for `'Items'` and three comparison sites. When changing the value, all five need updating. TypeScript catches prop type mismatches at the component boundary but cannot catch string comparisons against the old value.
- **When replacing a string comparison with an enum comparison, verify the semantics match.** Not all replacements are simple find-and-replace -- the Connect ABS gate needed `!== 'ebooks'` instead of `=== 'audiobooks'` because the old logic included `'all'` mode (via the `'Items'` return).
- **Add E2E tests for single-format defaulting.** The auto-filter effect is critical for users with only one format type. Without dedicated E2E tests, a regression could silently force audiobooks-only filtering on ebook-only libraries or vice versa. Test both formats independently.

## Related

- Existing doc (partial overlap, auto-filter and `'Items'` baseline): [library-mixed-format-default-and-unread-badge-2026-05-07.md](library-mixed-format-default-and-unread-badge-2026-05-07.md) -- note that doc recommends `'Items'` as the neutral label, which this fix superseded with `'Books'`.
- Plan: `docs/plans/2026-05-07-008-fix-ebook-library-visibility-plan.md`
- PR: [#535](https://github.com/PedroLages/knowlune/pull/535)
- Branch: `feature/ce-2026-05-07-fix-ebook-library-visibility`
- Key files: `src/app/pages/Library.tsx`, `src/app/components/library/LibraryMediaHero.tsx`, `tests/e2e/library-tabs.spec.ts`, `tests/support/helpers/library-tab-seed.ts`
