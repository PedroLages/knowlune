---
title: Search Command Palette rendering fixes — UUID leak, slug names, empty section, scrollbar, padding, placeholder
date: 2026-05-06
category: ui-bugs
module: SearchCommandPalette
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Raw Dexie database IDs displayed as lesson titles in search results"
  - "Upload slugs (e.g., demo-pdf-2) shown instead of human-readable labels"
  - "Empty Pages section heading rendered when no pages matched the query"
  - "CommandList scrollbar always visible due to insufficient max-height"
  - "Scope chip clear button cramped against badge and input text"
  - "Search placeholder truncated mid-word (note instead of notes)"
root_cause: missing_tooling
resolution_type: code_fix
severity: medium
tags:
  - search-palette
  - uuid-leakage
  - filename-normalization
  - ui-rendering
  - command-palette
---

# Search Command Palette rendering fixes

## Problem

The SearchCommandPalette component had six display-level rendering bugs — all cosmetic, none affecting search logic. Raw UUIDs and upload slugs appeared as lesson titles, an empty group heading rendered when no pages matched, the scrollbar was always visible, the clear button was cramped, and the placeholder truncated mid-word. These made the palette feel broken on first use.

## Symptoms

1. **UUID leak**: "Recently opened" section showed opaque Dexie IDs (e.g., `a1b2c3d4-e5f6-...`) instead of lesson titles.
2. **Slug names**: Upload filenames like `demo-pdf-2` appeared verbatim — no extension stripping, no formatting.
3. **Empty Pages heading**: When a typed query matched zero static navigation pages, the "Pages" group heading still rendered with no items.
4. **Scrollbar always visible**: `max-h-[300px]` on CommandList was consistently exceeded by content.
5. **Cramped clear button**: The scope chip's × button (`px-0.5`) sat flush against the badge.
6. **Truncated placeholder**: The 63-character placeholder clipped "notes" → "note..." mid-word.

## What Didn't Work

- **`row.filename || row.id`** as the lesson display title — when filename was undefined, the raw Dexie ID rendered; when filename was present, it was an upload slug.
- **`!showWelcomeCopy && !scope`** for the Pages gate — didn't account for `staticPagesFiltered` being empty.
- **Fixed `max-h-[300px]`** — content routinely exceeded this, always triggering the scrollbar.
- **`px-0.5`** on the clear button — insufficient separation between × glyph, badge, and input text.
- **63-character placeholder** — too long for the constrained input width, despite correct `text-overflow: ellipsis`.

## Solution

### IU-1: `normalizeFilename` utility (fixes UUIDs and raw slugs)

Created a pure utility function in `src/lib/searchLabelUtils.ts`:

```typescript
export function normalizeFilename(filename: string): string {
  if (!filename) return ''
  const withoutExt = filename.replace(/\.[^/.]+$/, '')
  return withoutExt
    .split(/[-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
```

Key design choice: returns `''` for empty input so the `||` chain at call sites works correctly:

- **`unifiedSearch.ts:244`**: `normalizeFilename(video.filename) || video.youtubeVideoId || video.id`
- **`SearchCommandPalette.tsx:828`**: `normalizeFilename(row.filename) || row.youtubeVideoId || row.id`

Both call sites preserve the full fallback chain — the utility only handles format transformation, not default-value logic.

### IU-2: Gate empty Pages section

```typescript
// Before: empty heading when no pages matched
const showPages = !showWelcomeCopy && !scope

// After: only show when pages exist
const showPages = !showWelcomeCopy && !scope && staticPagesFiltered.length > 0
```

### IU-3: Responsive CommandList max-height

```typescript
// Before: always 300px
'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto'

// After: viewport-aware, bounded
'max-h-[min(60vh,400px)] scroll-py-1 overflow-x-hidden overflow-y-auto'
```

### IU-4: Clear button padding

```typescript
// Before: px-0.5 (2px per side)
`h-5 px-0.5 rounded-l-none ...`

// After: px-1.5 (6px per side)
`h-5 px-1.5 rounded-l-none ...`
```

### IU-5: Shorten placeholder

```typescript
// Before: truncated mid-word
placeholder='Search pages, courses, books, lessons, notes, highlights...'

// After: fits within constrained width
placeholder='Search pages, courses, books, lessons...'
```

The `CommandDialog` description retains the full type list for screen readers.

## Why This Works

- **`normalizeFilename`** is pure, dependency-free, and returns `''` for empty input — the `||` chain cleanly falls through to `youtubeVideoId` or the raw `id` as last resort. Using it in both the index builder and the display layer ensures consistency even for items resolved from localStorage (never re-indexed).
- **The Pages gate** follows the existing guard pattern — one additive `&&` condition on a boolean that was already computed.
- **`min(60vh, 400px)`** gives the palette breathing room on large screens without risking overflow on small ones. The existing `scrollbar-width: thin` keeps the scrollbar unobtrusive when it does appear.
- **`px-1.5`** provides 12px horizontal padding — noticeably better tap target and visual breathing room.
- **Shorter placeholder** eliminates mid-word truncation with zero CSS risk. Full type list is preserved in `DialogDescription` for screen readers and in the prefix-hint row for new users.
- **All IUs are independent** — no sequencing risk, no shared state changes.

## Prevention

1. **Never render `row.id` as a display string** without exhausting known human-readable fields first. The `normalizeFilename || youtubeVideoId || id` chain is the canonical fallback for lesson labels.
2. **Every filtered group heading** must check its data source is non-empty before rendering. A conditional like `showPages` that doesn't guard on the filtered array is an open bug.
3. **Use viewport-relative sizing bounded by `min()`** for overflow containers rather than fixed pixel values — this prevents scrollbar-on by default on large screens.
4. **Budget placeholder length** to fit within ~40 characters in constrained inputs. Keep full descriptions in `aria-describedby` or `DialogDescription`.

## Related

- [Search palette library UX regressions](search-palette-library-ux-regressions-2026-05-03.md) — same component, earlier UUID fix for book navigation
- [QA Chat Panel UUID leakage](qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md) — same UUID-leakage + scrollbar pattern in a different component
- [Search prefix scope invariants](search-prefix-scope-invariants-2026-04-18.md) — load-bearing cmdk invariants for the palette
- [Unified search index invariants](unified-search-index-non-obvious-invariants-2026-04-18.md) — search index design decisions that touch the same files
