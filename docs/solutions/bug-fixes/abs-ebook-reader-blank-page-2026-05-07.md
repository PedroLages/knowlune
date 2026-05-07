---
module: library
tags: [abs, audiobookshelf, ebook, format, content-validation]
problem_type: bug
fix_type: code
root_cause: format-preservation_merge_rule + missing_content_validation
severity: high
affected_components:
  - src/stores/useBookStore.ts
  - src/services/BookContentService.ts
fix_commit: afadee68
pr_number: 534
---

# ABS Ebook Reader Blank Page

## Symptoms
Opening an ABS-synced ebook from the library showed a blank page. The reader
rendered the audiobook player instead of the EPUB reader.

## Root Cause

Two independent bugs combined to produce the symptom:

### R1: Format-preservation merge rule
`bulkUpsertAbsBooks` in `useBookStore.ts` preserved `existing.format` during
merge. ABS items synced before format detection had `format: 'audiobook'` as a
default. Re-sync preserved this stale value, permanently locking these books
to `'audiobook'` format. The reader routed them to `AudiobookRenderer` instead
of the EPUB reader.

### R2: Missing content validation
`fetchRemoteEpub` in `BookContentService.ts` passed any response body directly
to epub.js without validation. Servers returning PDFs or HTML error pages
caused epub.js to silently fail — a blank screen with no error feedback.

## Fix
1. **Drop format preservation**: Removed `format: existing.format` from the
   merge object. Format now comes from the ABS server (source of truth).
   User-data fields (status, progress, position) remain preserved.
2. **Add EPUB content validation**: After fetching the response, validate
   ZIP magic bytes (`PK` at offset 0) and check for empty body (0 bytes).
   Non-EPUB content throws `RemoteEpubError` with code `'unsupported-format'`.

## Why This Happened
The format-preservation rule was added to prevent format overrides for local
books. It incorrectly applied to ABS books, where the server is the source
of truth for format. The content validation gap was a missing safeguard —
other content sources (OPDS, OPFS) don't need it because they serve known
file types, but ABS servers can return arbitrary content.

## Prevention
- Add integration tests for format field behavior during re-sync
- Validate content at service boundaries before passing to consumers
- When merging remote data, distinguish between user-data (preserve) and
  server-data (overwrite)
