---
id: fix-search-command-palette
title: "Fix Search Command Palette: ID Leak, Slug Names, Empty Sections, Scrollbar, Placeholder"
status: active
created: 2026-05-06
epic: platform-polish
depth: lightweight
---

# Plan: Fix Search Command Palette Issues

## Problem Frame

The SearchCommandPalette component (`src/app/components/figma/SearchCommandPalette.tsx`) has six distinct rendering issues reported after shipping the base implementation. None affect search logic — all are display/data-surface problems.

## Issues

| # | Issue | Root Cause | File:Line |
|---|-------|------------|-----------|
| 1 | Internal lesson UUID shown as title in "Recently opened" | `row.filename || row.id` — when `filename` is undefined, the raw Dexie ID renders | `SearchCommandPalette.tsx:826` |
| 2 | Slugs instead of formatted names (e.g., `demo-pdf-2`) | `row.filename` is the upload filename, not a human-readable label | `SearchCommandPalette.tsx:826` |
| 3 | Empty "Pages" section heading renders when query yields no page matches | `showPages` does not check `staticPagesFiltered.length > 0` | `SearchCommandPalette.tsx:798` |
| 4 | Scrollbar always visible in CommandList | `max-h-[300px]` with `overflow-y: auto` keeps the scrollbar visible whenever content fills that height | `command.tsx:94` |
| 5 | Scope chip × clear button crowds the search input text | The clear button (`px-0.5 h-5`) sits flush against the badge and input text with minimal gap | `SearchCommandPalette.tsx:909` |
| 6 | Placeholder truncated at "note" instead of "notes" | Long placeholder string clipped by input `text-overflow: ellipsis` on constrained width | `SearchCommandPalette.tsx:893` |

## Implementation Units

### IU-1: Derive human-readable lesson labels (fixes #1 and #2)

**Problem:** Both the search index (`unifiedSearch.ts:243`) and the recent-label resolution (`SearchCommandPalette.tsx:826`) use `row.filename || row.id` as the lesson display title. The filename is a raw upload slug (e.g., `demo-pdf-2.mp4`) and the ID is an opaque UUID.

**Solution:** Add a shared utility function `normalizeFilename(filename: string): string` that strips the file extension, replaces separators (`-`, `_`) with spaces, and title-cases each word. Use it in both locations:
- `unifiedSearch.ts:243` — `const title = normalizeFilename(video.filename) || video.youtubeVideoId || 'Untitled Lesson'`
- `SearchCommandPalette.tsx:826` — `{ title: normalizeFilename(row.filename) || row.youtubeVideoId || 'Untitled Lesson' }`

**File to create:**
- `src/lib/searchLabelUtils.ts` — single function, pure, no imports from project modules

**Files to modify:**
- `src/lib/unifiedSearch.ts:243` — use `normalizeFilename` in `toSearchableLesson`
- `src/app/components/figma/SearchCommandPalette.tsx:826` — update lesson label resolution

**Tests:**
- `src/lib/__tests__/searchLabelUtils.test.ts` — `normalizeFilename` unit tests
  - `demo-pdf-2.mp4` → `Demo Pdf 2`
  - `Introduction_to_Calculus_Lesson_1.mov` → `Introduction To Calculus Lesson 1`
  - `a-b-c.mp4` → `A B C`
  - `lesson` → `Lesson`
  - `''` → `''` (edge: empty string returns empty so the `||` chain can fall through to `youtubeVideoId` or `'Untitled Lesson'`)
  - _(call site behavior, covered by unifiedSearch tests)_ video with `youtubeVideoId` and no `filename` → the `||` chain resolves to `youtubeVideoId`

### IU-2: Gate empty Pages section (fixes #3)

**Problem:** `showPages` (line 798) only checks `!showWelcomeCopy && !scope`. When a typed query yields zero matching pages, the "Pages" group heading still renders with no items beneath it.

**Solution:** Gate the Pages group on `staticPagesFiltered.length > 0`:

```tsx
const showPages = !showWelcomeCopy && !scope && staticPagesFiltered.length > 0
```

**File to modify:**
- `src/app/components/figma/SearchCommandPalette.tsx:798` — add `&& staticPagesFiltered.length > 0`

**Tests:** No new tests needed — existing snapshot/palette test covers the rendered output.

### IU-3: Conditionally suppress CommandList scrollbar (fixes #4)

**Problem:** `CommandList` has `max-h-[300px]` with `overflow-y: auto`. In most palette states (Continue Learning + Recently Opened + Pages), content fills or exceeds 300px, keeping the scrollbar permanently visible. The thin (6px) scrollbar is visual noise when the content list fits within the overflow container.

**Solution:** Increase `max-h-[300px]` to `max-h-[min(60vh,400px)]` in `command.tsx:94`. This reduces how often content fills the box enough to trigger the scrollbar, while the `min()` clamp keeps it bounded on small viewports. The existing `scrollbar-width: thin` keeps it unobtrusive when it does appear. (Note: CommandList is shared with 5 other consumers — SettingsSearch, ProviderModelPicker, OllamaModelPicker, TagEditor. All either use a dialog with overflow-hidden or have a max-height already set via their own override. No regression expected.)

**File to modify:**
- `src/app/components/ui/command.tsx:94` — `max-h-[300px]` → `max-h-[min(60vh,400px)]`

### IU-4: Increase scope chip clear button spacing (fixes #5)

**Problem:** The scope chip's × clear button (line 909) uses `h-5 px-0.5` and sits directly adjacent to the badge with `rounded-l-none`. The text/× are cramped against each other and the input text that follows.

**Solution:** Increase the clear button to `h-5 px-1.5` for better tap target and visual spacing. The button already has `opacity-70 hover:opacity-100` for visual hierarchy.

**File to modify:**
- `src/app/components/figma/SearchCommandPalette.tsx:909` — `px-0.5` → `px-1.5`

### IU-5: Shorten search placeholder (fixes #6)

**Problem:** The placeholder `'Search pages, courses, books, lessons, notes, highlights...'` is 63 characters. When the CommandInput is constrained by the dialog width (especially with the search icon occupying space), the input's default `text-overflow: ellipsis` clips it. The user sees `Search pages, courses, books, lessons, note...` — truncated mid-word at "note" because "s" of "notes" doesn't fit.

**Solution:** Shorten the placeholder to `'Search pages, courses, books, lessons...'` — removes the last two items ("notes, highlights") and the trailing ellipsis. At ~40 characters, this fits within the constrained input width. The `CommandDialog` description already has the full list for screen readers.

**File to modify:**
- `src/app/components/figma/SearchCommandPalette.tsx:893` — update placeholder string

**Why this approach (vs. CSS fixes):** Increasing input width or removing `text-overflow: ellipsis` would require changes to the cmdk input styling that could have wider layout implications. Shortening the text is a zero-risk fix that also improves readability at a glance.

## Dependencies and Sequencing

All IUs are independent and can be implemented in any order. No shared state changes.

## Risks

- **IU-1** `normalizeFilename` could produce unexpected results for non-English filenames or filenames without clear separators (e.g., `lesson1final.mp4` → `Lesson1Final`). Low risk — the output is still more readable than a UUID.
- **IU-3** `max-h` increase: on very small viewports, `60vh` could make the dialog exceed the viewport. The `min()` with `400px` caps the absolute value, and the mobile full-screen override in `contentClassName` already handles <640px.
- **IU-5** Shorter placeholder means less discoverability of non-obvious searchable types (notes, highlights). Acceptable because `CommandDialog` `description` carries the full type list for SR, and the prefix-hint row (`c:`, `b:`, `l:`) introduces scoped search on first launch.

## Notes

- **No results state (cmdk default):** When `filteredLessons.length === 0 && staticPagesFiltered.length === 0` (no lesson matches and no page matches), the `CommandList` will naturally show nothing — cmdk's built-in `cmd-empty` state renders a "No results found." message. No change needed, but implementers should verify this behavior is not broken.
- **Loading/error state:** The recently-opened lessons query from Dexie uses the existing `useEffect` + React state pattern. If the Dexie query errors, the section gracefully renders nothing (already handled by the `||` fallback). No change to loading/error UX is required.
- **Focus management:** `CommandDialog` from cmdk handles focus-on-open and focus-return-on-close automatically per WCAG 2.4.3. The existing `shouldFilter={false}` preserves default cmdk behavior. No change needed.
