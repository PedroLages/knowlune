## External Code Review: E88-S02 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-05
**Story**: E88-S02

### Findings

#### Blockers
(None)

#### High Priority
(None)

#### Medium
- **src/app/components/library/OpdsBrowser.tsx:87-93 (confidence: 85)**: `isAlreadyInLibrary` matches by title+author across *all* books, including local ones. If a user has a local EPUB of "Dune" by "Frank Herbert", the OPDS entry for the same book will be marked "already in library" — but it's a different source. The first check (`b.source.type === 'remote'` + URL match) is correct; the title+author fallback should also scope to `b.source.type === 'remote'` to avoid false positives against local books. Fix: Change the fallback condition to `b.source.type === 'remote' && b.title.toLowerCase() === entry.title.toLowerCase() && b.author.toLowerCase() === entry.author.toLowerCase()`, or remove the fallback entirely and rely solely on URL matching.

- **src/app/components/library/OpdsBrowser.tsx:414-429 (confidence: 80)**: Stale closure in `handleAddToLibrary` — it reads `books` from the outer closure via `useCallback` deps, but `books` is a Zustand selector that returns the array reference. If a user adds two books rapidly, the second invocation's `books` may not yet include the first (depending on React batching). The `isAlreadyInLibrary` check at line 417 could pass for both, creating duplicates. The `addingIds` guard doesn't help since each entry has a different `id`. Fix: Move the duplicate check into the `importBook` store action itself (single source of truth), or use a local `Set<string>` of URLs being processed to serialize additions.

- **src/services/OpdsService.ts:358-373 (confidence: 75)**: Navigation entry detection uses heuristics that can misclassify book entries as navigation. An entry with `rel="subsection"` is treated as navigation even if it also has acquisition links — the code finds the first matching nav-link pattern and skips the entry entirely. OPDS spec allows entries to have both navigation and acquisition links. If a catalog uses `rel="subsection"` alongside acquisition rels, the book will be invisible (not displayed as a book, and the navigation link won't offer "Add to Library"). Fix: Check for acquisition links first — if an entry has any `http://opds-spec.org/acquisition` link, treat it as a book entry regardless of nav-link patterns.

- **src/app/components/library/OpdsBrowser.tsx:306 (confidence: 70)**: The `useEffect` that fetches the root feed depends on `selectedCatalogId` and `catalogs` but runs on every `catalogs` change. If the user is browsing a nested feed (breadcrumbs exist) and `catalogs` is re-fetched (e.g., due to an unrelated catalog edit), the effect will reset breadcrumbs and navigate back to the root feed, losing the user's place. The `catalogs` dep was added to handle credential changes, but it causes this side effect. Fix: Either track a "catalog version" to only refetch on actual changes to the selected catalog's record, or skip the effect if breadcrumbs are non-empty (user is navigating a sub-feed).

- **src/app/components/library/OpdsBrowser.tsx:75-82 (confidence: 70)**: `getBookFormat` returns `'pdf'` as default when no recognized MIME type is found in acquisition links. This is semantically wrong — a book with only MOBI links would be labeled `'pdf'` in the `Book.format` field, which could cause issues downstream if format determines which reader/renderer to use. Fix: Return `'epub'` as default (most common OPDS format), or add an explicit MOBI check (already done in `getFormatLabel` but not here), or return a union type that includes `'unknown'` and handle it downstream.

#### Nits
- **src/app/components/library/OpdsBrowser.tsx:236 (confidence: 50)**: `BreadcrumbTrail` uses `index` as React key for breadcrumb items. Since breadcrumbs are append-only and never reordered within a session, this is functionally safe, but if the same feed title appears at multiple levels, React may mis-identify components during reconciliation. Using `crumb.url` as key would be more robust.

---
Issues found: 6 | Blockers: 0 | High: 0 | Medium: 5 | Nits: 1
