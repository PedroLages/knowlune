# Plan: E107-S01 — Fix Cover Image Display

## Context

Epic 107 was created from a manual audit of the Books/Library feature (E83-E104). Story E107-S01 fixes cover image display bugs — covers from EPUBs and audiobooks should render correctly in Library grid/list views, book detail pages, reader, and mini-player. No detailed ACs exist in an epics file; this plan derives them from codebase analysis.

## Key Files

| File | Role |
|------|------|
| `src/services/EpubMetadataService.ts` | Extracts cover from EPUB via epub.js |
| `src/services/M4bParserService.ts` | Extracts cover from M4B/MP3 via music-metadata |
| `src/services/OpfsStorageService.ts` | Stores covers in OPFS / IndexedDB fallback |
| `src/services/OpenLibraryService.ts` | Fallback cover fetch from Open Library API |
| `src/app/components/library/BookCard.tsx` | Grid view cover display |
| `src/app/components/library/BookListItem.tsx` | List view cover display |
| `src/app/components/audiobook/AudiobookRenderer.tsx` | Audiobook player cover art |
| `src/app/components/library/BookImportDialog.tsx` | Import flow cover handling |
| `src/db/index.ts` | Dexie schema (bookFiles table for covers) |

## Diagnostic Phase (Required)

Since no explicit bug report documents the cover image issues, implementation starts with a **diagnostic pass**:

1. Run the dev server and import an EPUB with an embedded cover
2. Check if cover appears in: Library grid, Library list, Reader sidebar, Mini-player
3. Import an M4B audiobook and verify cover display
4. Import an EPUB without embedded cover — verify Open Library fallback works
5. Test with a book in IndexedDB fallback mode (Safari)

**Document each finding** with: what's broken, where, and root cause (extraction failure, storage failure, or display failure).

## Suspected Issues (from code analysis)

1. **Silent cover extraction failures** — `EpubMetadataService.ts` has a try-catch that silently swallows cover extraction errors, resulting in `undefined` coverBlob
2. **OPFS cover URL not resolved to objectURL** — covers stored in OPFS return a path string (`/knowlune/books/{id}/cover.jpg`) but components may need a blob URL via `URL.createObjectURL()`
3. **Cover URL lifecycle** — object URLs created during import may be revoked prematurely or not persisted correctly in the book record
4. **IndexedDB fallback covers** — when OPFS unavailable, cover storage returns `'indexeddb'` string instead of a usable URL

## Implementation Steps

### Step 1: Diagnose actual cover issues
- Run app with test EPUBs and audiobooks
- Document which views show broken covers
- Identify root cause chain (extraction → storage → display)

### Step 2: Fix cover extraction reliability
- Improve error handling in `EpubMetadataService.ts` cover extraction
- Add logging for cover extraction failures
- Verify `M4bParserService.ts` cover extraction handles all picture formats

### Step 3: Fix cover URL persistence
- Ensure `coverUrl` in book record is a usable URL at display time
- If OPFS path is stored, add URL resolution when reading book data
- If objectURL is stored, ensure it's recreated on page load (objectURLs don't persist across sessions)
- Handle IndexedDB fallback path correctly

### Step 4: Fix cover display in all views
- Verify `BookCard.tsx` renders cover correctly for both EPUB and audiobook formats
- Verify `BookListItem.tsx` renders cover thumbnail
- Verify `AudiobookRenderer.tsx` displays cover art
- Ensure fallback icon shows when no cover available

### Step 5: Add unit tests for cover handling
- Test `EpubMetadataService` cover extraction (success and failure cases)
- Test `OpfsStorageService.storeCoverFile` and cover retrieval
- Test cover URL resolution logic

## Verification

1. Import EPUB with embedded cover → verify cover shows in all views
2. Import EPUB without cover → verify Open Library fallback or placeholder icon
3. Import M4B audiobook with cover art → verify cover shows
4. Refresh page → covers persist (not lost on session end)
5. Run `npm run build` — no regressions
6. Run `npm run test:unit` — all tests pass
