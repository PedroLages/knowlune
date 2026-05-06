---
title: ABS Ebook Sync Format Detection Patterns — Heuristic, Bearer Auth, Format Preservation
date: 2026-05-05
module: abs-sync
component: service_object
tags: [abs, sync, format-detection, epub, audiobook, bearer-auth, mapAbsItemToBook]
problem_type: best_practice
category: sync
track: knowledge
applies_when:
  - Implementing or modifying the ABS-to-local-book mapping pipeline
  - Adding Bearer auth support to a fetch-based content service that previously only handled Basic auth
  - Handling re-sync of items whose format could change between sync cycles
  - Widening a discriminated union type for forward compatibility with a (string & {}) fallback
plan: docs/plans/2026-05-05-001-feat-abs-ebook-sync-format-detection-plan.md
pr: https://github.com/PedroLages/knowlune/pull/520
branch: feature/ce-2026-05-05-abs-ebook-sync-format-detection
---

# ABS Ebook Sync Format Detection Patterns

## Context

Audiobookshelf (ABS) sync hardcoded `format: 'audiobook'` for every synced item in `mapAbsItemToBook()` (inside the `useAudiobookshelfSync` hook). The app's routing (`getBookDestinationPath`) and reader dispatch (`BookReader`) both key off `book.format`, so ABS ebooks were routed to `AudiobookRenderer` instead of `EpubRenderer`. Two downstream blockers prevented EPUB rendering even after format was fixed: the `source.url` pointed to the server root rather than an EPUB download endpoint, and `BookContentService.fetchRemoteEpub()` only handled Basic Auth, not the Bearer tokens that ABS uses.

The work spanned three units: (1) format detection and ebook wiring in `mapAbsItemToBook`, (2) Bearer auth in `BookContentService`, and (3) type widening for `AbsLibrary.mediaType`. The review loop went three rounds (R3), surfacing four key findings that shaped the final implementation.

## Guidance

### 1. Format Detection Heuristic — Conservative: Narrators + Duration Required

Detect format from item-level media metadata rather than library-type lookups (which require an extra API call). The rule: an item is an audiobook only if it has **both** non-empty narrators **and** a positive duration. Everything else defaults to `'epub'`.

```typescript
export function detectFormat(absItem: AbsLibraryItem): BookFormat {
  const narratorNames = resolveNarratorNames(absItem)
  const duration = absItem.media.metadata.duration || absItem.media.duration
  const isAudiobook = narratorNames.length > 0 && (duration ?? 0) > 0
  return isAudiobook ? 'audiobook' : 'epub'
}
```

This is intentionally conservative. A misclassified audiobook (no narrator metadata in ABS) opens in the EPUB reader rather than playing audio, which is less confusing than the reverse.

**Known limitation (R6 tension):** Audiobooks lacking narrator metadata in ABS cannot be distinguished from ebooks by this heuristic. Mitigated by format preservation on re-sync (see Pattern 7) and a deferred manual format override task.

### 2. Narrator Resolution — Handle Both Shape Variants

ABS can return narrators as `string[]`, as `{ name: string }[]`, or as a comma-separated `narratorName` string fallback on the list endpoint. Extract a shared helper rather than duplicating the normalization:

```typescript
export function resolveNarratorNames(absItem: AbsLibraryItem): string[] {
  const rawNarrators = (absItem.media.metadata.narrators ?? []) as Array<
    string | { name: string }
  >
  return rawNarrators.length > 0
    ? rawNarrators.map(n => (typeof n === 'string' ? n : n.name))
    : (((absItem.media.metadata as Record<string, unknown>).narratorName as string)
        ?.split(', ')
        .filter(Boolean) ?? [])
}
```

This was extracted during the review loop (R1 finding: duplicated narrator resolution logic) and is shared by both `detectFormat` and `mapAbsItemToBook`.

### 3. Sync Loop Filter — Widen to Accept 'ebook' Items

The original sync loop at line 288 of `useAudiobookshelfSync.ts` filtered with `absItem.mediaType !== 'book'`, which silently dropped all items with `mediaType: 'ebook'` (returned by newer ABS versions). Extract an exported predicate:

```typescript
export function isValidSyncItem(absItem: AbsLibraryItem): boolean {
  return !absItem.mediaType || absItem.mediaType === 'book' || absItem.mediaType === 'ebook'
}
```

The guard `!absItem.mediaType` preserves legacy behavior for items with no mediaType field. Podcast items (`mediaType: 'podcast'`) are correctly rejected.

### 4. Format-Aware Ebook Mapping — Different URL, No Dummy Chapters

When `detectFormat` returns `'epub'`, three things must change in the mapped Book:

- **Source URL**: Ebooks use `{serverUrl}/api/items/{itemId}/ebook` (no embedded credentials — auth via Bearer header). Audiobooks use the server root (chapters fetched separately on demand).
- **Chapters**: Skip dummy audio chapter synthesis — ebooks get an empty chapters array.
- **Total duration**: Ebooks have `totalDuration: undefined` (no audio to track).

```typescript
const baseUrl = server.url.replace(/\/+$/, '')
const sourceUrl = isEbook
  ? `${baseUrl}/api/items/${encodeURIComponent(absItem.id)}/ebook`
  : baseUrl

const chapters: BookChapter[] = isEbook
  ? []
  : /* existing ABS chapter mapping with dummy fallback */

return {
  // ...
  format: VALID_FORMATS.includes(format) ? format : 'audiobook',
  chapters,
  source: { type: 'remote', url: sourceUrl, auth: apiKey ? { bearer: apiKey } : undefined },
  totalDuration: isEbook ? undefined : duration,
}
```

Use `VALID_FORMATS` as a gate: `['epub', 'audiobook']` with an allow-list check before returning the Book record.

### 5. Bearer Auth in BookContentService — Additive, Non-Breaking

The `RemoteAuth` discriminated union already supports both `{ bearer: string }` and `{ username: string; password?: string }` variants. Add Bearer as the first branch before the existing Basic auth check. The `fetch()` API can set Authorization headers directly (unlike `<img>` tags which require query-parameter tokens for cover images).

```typescript
const headers: Record<string, string> = {}
if (source.auth && 'bearer' in source.auth) {
  headers['Authorization'] = `Bearer ${source.auth.bearer}`
} else if (source.auth && 'username' in source.auth && source.auth.password) {
  headers['Authorization'] = `Basic ${btoa(`${source.auth.username}:${source.auth.password}`)}`
  if (/^http:\/\//i.test(source.url)) {
    console.warn('Credentials sent over plain HTTP (RFC 7617 security)')
  }
}
```

Key detail: check `'bearer' in source.auth` before `'username' in source.auth`. Since these are a discriminated union, only one branch matches per type variant. The existing Basic path is preserved unchanged.

### 6. Type Widening with Forward Compatibility

The `AbsLibrary.mediaType` field was typed as `string` with a `// 'book' | 'podcast'` comment. Widen to an exhaustive union with a `(string & {})` fallback that preserves autocomplete for known values while accepting any future value:

```typescript
export interface AbsLibrary {
  id: string
  name: string
  mediaType: 'book' | 'podcast' | 'ebook' | (string & {})
}
```

The `(string & {})` pattern prevents TypeScript from widening the union to just `string`, which would lose autocomplete hinting for the known values. Apply the same change to `AbsLibraryItem.mediaType`.

### 7. Format Preservation on Re-Sync — Per-Field Guard in bulkUpsertAbsBooks

Without guardrails, a re-sync would replace `format` with the freshly-detected value. Since the detection heuristic may reclassify audiobooks lacking narrator metadata as `'epub'` (R6 tension), the merge in `bulkUpsertAbsBooks` must preserve the existing format:

```typescript
// Inside the merge in bulkUpsertAbsBooks:
{
  ...book,            // new catalog data (title, author, etc.)
  id: existing.id,   // keep existing book ID
  format: existing.format, // KEEP existing format — prevent re-sync reclassification
  status: existing.status,
  progress: existing.progress,
  currentPosition: existing.currentPosition,
}
```

This solves R6 more completely than the plan originally described. Title and author metadata still update from the catalog — only `format`, `status`, `progress`, and position are preserved from the existing record. This pattern mirrors the existing per-row read-before-write approach documented in `docs/solutions/sync/e96-closeout-sync-patterns-2026-04-19.md` (Monotonic Field Hydration Guard).

## Why This Matters

- **Conservative detection prevents the worst failure mode**: An audiobook misclassified as epub opens a blank reader (the user quickly learns to fix ABS metadata). An ebook misclassified as audiobook plays silence and shows a progress bar that doesn't advance — far more confusing.
- **Shared narrator resolution prevents drift**: Duplicated inline normalization (original code) diverges when one call site is updated and the other is missed. The extracted `resolveNarratorNames` helper is the single source of truth for ABS narrator handling.
- **Sync loop filter widening is an invariant change**: Previously, `mediaType !== 'book'` was a safe rejection filter. After this change, the filter explicitly accepts `'book'` and `'ebook'`. Any future `mediaType` value (e.g., `'comic'`, `'pdf'`) will be rejected by default — no accidental inclusion.
- **Bearer auth via discriminated union keeps the auth model clean**: Adding a new auth variant as a branch in the discriminated union (`{ bearer: string }`) avoids the maintenance burden of a separate auth middleware, and the TypeScript compiler flags any unhandled variants.
- **Format preservation prevents silent reclassification on every re-sync**: Without this guard, every sync cycle re-detects format. Users who manually correct a misclassification would have it overwritten on the next sync, creating a losing battle against the sync loop.

## When to Apply

- **Format detection on external data**: Use metadata heuristics with allow-list gating. Conservative defaults (fail toward the less harmful UX failure).
- **Shape normalization from external APIs**: Extract and export a helper — the same datum may need normalization in multiple call sites (detection + mapping).
- **Sync loop filters that gate on API strings**: Extract and test the filter predicate independently. A simple `!== 'book'` check invisibly blocks new valid types from reaching the mapper.
- **fetch-based auth for external APIs**: Use the discriminated union pattern for auth variants. Check bearer before basic to maintain the natural precedence order.
- **Re-sync merging of externally-detected fields**: Preserve fields that user interaction or heuristic detection may have set. Only overwrite fields that come authoritatively from the source (title, author, metadata).
- **Type widening of API response interfaces**: Use `Known | (string & {})` to get forward compatibility without losing autocomplete.

## Examples

### Before: mapAbsItemToBook (inside hook, hardcoded format)

```typescript
// Inside useAudiobookshelfSync, as useCallback:
const mapAbsItemToBook = useCallback((absItem, server, apiKey) => {
  // ...narrator normalization inlined...
  return {
    format: 'audiobook', // always!
    source: { url: server.url.replace(/\/+$/, ''), auth: { bearer: apiKey } },
    chapters: /* always synthesizes dummy chapter if ABS has none */,
    totalDuration: duration,
  }
}, [])
```

### After: mapAbsItemToBook (exported, format-aware)

```typescript
export function mapAbsItemToBook(absItem: AbsLibraryItem, server: AudiobookshelfServer, apiKey: string): Book {
  const format = detectFormat(absItem)
  const isEbook = format === 'epub'
  const narratorNames = resolveNarratorNames(absItem)
  const chapters = isEbook ? [] : mapChapters(absItem.media.chapters, bookId)
  const sourceUrl = isEbook
    ? `${server.url.replace(/\/+$/, '')}/api/items/${encodeURIComponent(absItem.id)}/ebook`
    : server.url.replace(/\/+$/, '')
  return {
    format: VALID_FORMATS.includes(format) ? format : 'audiobook',
    chapters,
    source: { type: 'remote', url: sourceUrl, auth: apiKey ? { bearer: apiKey } : undefined },
    totalDuration: isEbook ? undefined : duration,
    // ...title, author, etc.
  }
}
```

### Before: fetchRemoteEpub auth (Basic only)

```typescript
if (source.auth && 'username' in source.auth && source.auth.password) {
  headers['Authorization'] = `Basic ${btoa(`${source.auth.username}:${source.auth.password}`)}`
}
```

### After: fetchRemoteEpub auth (Bearer + Basic)

```typescript
if (source.auth && 'bearer' in source.auth) {
  headers['Authorization'] = `Bearer ${source.auth.bearer}`
} else if (source.auth && 'username' in source.auth && source.auth.password) {
  headers['Authorization'] = `Basic ${btoa(`${source.auth.username}:${source.auth.password}`)}`
}
```

## Related

- Plan: `docs/plans/2026-05-05-001-feat-abs-ebook-sync-format-detection-plan.md`
- PR: https://github.com/PedroLages/knowlune/pull/520
- Branch: `feature/ce-2026-05-05-abs-ebook-sync-format-detection` (merged)
- `docs/solutions/sync/abs-sync-qa-fix-patterns-2026-04-24.md` — Deadlock guard, auth guard, throttle patterns for ABS sync
- `docs/solutions/sync/e96-closeout-sync-patterns-2026-04-19.md` — Per-row read-before-write pattern (Monotonic Field Hydration Guard), which the format preservation guard extends
- `docs/solutions/best-practices/format-pairing-cross-format-position-translation-2026-04-25.md` — Cross-format position translation invariants (related format-handling domain)
- `docs/solutions/best-practices/audiobook-prefs-hydration-allow-list-pattern-2026-04-25.md` — Allow-list pattern for external format values
