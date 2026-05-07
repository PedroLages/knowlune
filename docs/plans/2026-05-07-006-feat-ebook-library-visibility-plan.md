# Plan: Ebook Library Visibility Fix

**Plan date:** 2026-05-07
**Requirements:** [2026-05-07-ebook-library-visibility-requirements.md](../../brainstorms/2026-05-07-ebook-library-visibility-requirements.md)
**Scope:** 3 files, ~30 lines changed

## Summary

When both audiobooks and ebooks exist in the library, the auto-filter effect hides ebooks by default. Fix: don't auto-filter when both formats exist, and render both shelf sets.

## Changes

### 1. `src/app/pages/Library.tsx` (lines 429-435)

**Current:**
```typescript
const hasAudiobooks = books.some(b => b.format === 'audiobook')
if (hasAudiobooks) {
  setFilter('format', ['audiobook'])
} else if (books.some(b => b.format === 'epub' || b.format === 'pdf')) {
  setFilter('format', ['epub', 'pdf'])
}
```

**New:** Only auto-filter when exclusively one format exists. When both exist, leave format unfiltered.

### 2. `src/app/components/library/LibraryMediaShelfColumn.tsx`

- Extend `Mode` type to `'audiobooks' | 'ebooks' | 'all'`
- `getActiveMode()`: return `'all'` when format filter is unset or empty
- `getModeBooks()`: return all books (no format filter) when mode is `'all'`
- `shelves` computation: for `'all'` mode, compute both audiobook and ebook shelves and merge them (both continue rails, both recently added, etc.)
- Adjust render: when mode is `'all'`, the continue rail shows both audiobook "Continue Listening" and ebook "Continue Reading" sections

### 3. `src/app/components/library/LibraryFormatModeTabs.tsx`

- `getActiveMode()`: return `'all'` when no format filter is set
- Visual state: when mode is `'all'`, neither tab is selected (both show as `bg-muted`)

## Edge Cases

- **Only audiobooks**: Auto-filter still applies → audiobook mode (unchanged)
- **Only ebooks**: Auto-filter still applies → ebook mode (unchanged)
- **Both formats, user clears filter**: Shows all shelves (new behavior)
- **Both formats, user clicks Audiobooks tab**: Filters to audiobooks (unchanged)
- **Both formats, user clicks Ebooks tab**: Filters to ebooks (unchanged)
- **Empty library**: No filter applied, no shelves rendered (unchanged)

## Test Plan

- Update existing Library page tests to verify both shelf sets render when both formats present
- Verify format tabs still filter correctly
- Verify single-format auto-filter still works
