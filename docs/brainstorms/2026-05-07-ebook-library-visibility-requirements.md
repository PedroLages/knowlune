# Ebook Library Visibility — Requirements Brief

**Status:** draft
**Created:** 2026-05-07
**Source:** User request — "I already gave access to manage ebooks in Audiobookshelf but in Knowlune I still can't access ebooks"

## Problem

When a user has both audiobooks AND ebooks synced from Audiobookshelf, the Library page auto-filters to audiobooks only. Ebooks are invisible until the user explicitly clicks the "Ebooks" format tab — which they may not realize exists. The auto-filter effect in `Library.tsx` (lines 429-435) checks `books.some(b => b.format === 'audiobook')` and immediately applies `['audiobook']` filter, hiding ebook content.

Three independent defaults all converge on audiobooks:
1. `Library.tsx` auto-filter effect → `setFilter('format', ['audiobook'])`
2. `LibraryMediaShelfColumn.getActiveMode()` → returns `'audiobooks'` when no filter set
3. `LibraryFormatModeTabs.getActiveMode()` → returns `'audiobooks'` when no filter set

## What Already Works

- ABS sync correctly fetches ebooks (`mediaType === 'ebook'` accepted in `isValidSyncItem`)
- Ebooks stored in Dexie via `bulkUpsertAbsBooks`
- Ebooks ARE visible when user clicks the "Ebooks" tab
- Format tabs show correct ebook counts
- All ebook shelves exist: Continue Reading, Recently Added, Recent Series, Discover, Read Again
- Full EPUB reader (epub.js) works for ABS-sourced ebooks

## Requirements

### R1: Show all formats by default when both exist
When the library contains both audiobooks AND ebooks, do not auto-apply a format filter. Render both audiobook and ebook shelves so users see all their content on first load.

### R2: Preserve single-format default when only one format exists
When the library contains ONLY audiobooks or ONLY ebooks, keep the current auto-filter behavior.

### R3: Format tabs remain functional
The Audiobooks/Ebooks tabs must still work for manual filtering. When both formats are showing by default, neither tab should appear selected.

## Out of Scope

- Adding an "All" tab (R3 handles the unfiltered state by showing both tabs unselected)
- Changing `detectFormat()` heuristics for narrator-less audiobooks
- ABS API changes
- Ebook reader changes
