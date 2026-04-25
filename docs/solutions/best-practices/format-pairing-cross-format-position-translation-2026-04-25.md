---
title: Format Pairing — Cross-Format Position Translation Invariants
date: 2026-04-25
category: best-practices
module: library/format-pairing
problem_type: best_practice
component: service_object
severity: medium
applies_when:
  - Translating reading position between paired EPUB and audiobook formats
  - Adding new surfaces that re-scan or repair format chapter metadata
  - Touching ABS chapter sync, library hydration, or paired-format handoff logic
tags:
  - format-pairing
  - audiobook
  - epub
  - abs
  - position-translation
  - chapter-mapping
  - lazy-fetch
  - invariants
---

# Format Pairing — Cross-Format Position Translation Invariants

Implementation lessons from the EPUB↔Audio paired-format release (PR #456,
branch `feature/ce-2026-04-25-link-formats-really-merry-eich`). The plan is
captured at `/Users/pedro/.claude/plans/the-link-formats-really-merry-eich.md`.

## Context

Knowlune lets a user pair an EPUB book with its matching audiobook so that
switching formats resumes at the equivalent reading position. The naive
implementations of this feature (word-count alignment, eager ABS chapter
fetch on every sync, symmetric bias) are all wrong in non-obvious ways.
This document captures the validated design decisions and the invariants
the implementation depends on, so the next person touching paired-format
code does not regress them.

## Guidance

### 1. Use time-percentage proportional intra-chapter math, not word-count

When mapping an offset inside an EPUB chapter to a timestamp inside the
matching audio chapter (or vice versa), use the **fractional position
within the chapter** rather than trying to align words to seconds.

```ts
// ✅ Time-percentage proportional (used in production)
const chapterFraction = (epubOffset - chapterStart) / chapterLength;
const audioMs = audioChapterStartMs + chapterFraction * audioChapterDurationMs;

// ❌ Word-count alignment — needs data we don't have on the EPUB side
const wordIndex = countWordsBefore(epubOffset);
const wordsPerSecond = totalWords / totalDurationSeconds;
```

Both renderers (EPUB reader and audio player) already expose
chapter-relative progress, so the proportional approach uses
already-live data. Research validated that ±1–2 paragraph accuracy is
sufficient for the resume-on-format-switch use case; users do not notice
sub-paragraph drift, and tightening it with a word-level index would
require parsing every EPUB on import.

### 2. Lazy per-item ABS chapter fetch — never on library sync

ABS exposes chapter metadata only via per-item endpoints. Fetching them
during library sync would create an N+1 against every audiobook on
every sync.

The pattern that ships:

- Library sync stores **only the lightweight item summary**.
- `Book.chapters` is fetched **on demand**, the first time a user
  initiates a pairing (or runs `rescanBookChapters`).
- The result is **cached back into the `Book` row** so subsequent
  pairings, re-scans, and resume operations read locally.

**Invariant:** No code path under library sync, scheduled refresh, or
cold app boot may call the ABS chapter endpoint. If you find yourself
needing chapters in those paths, fetch them lazily inside the pairing
flow instead.

### 3. EPUB→Audio direction has a 3 s lead-in bias; Audio→EPUB does not

Translation is **asymmetric by design**:

- **EPUB → Audio**: subtract 3 seconds from the computed timestamp
  before seeking. This avoids landing in the middle of the spoken
  word that corresponds to the EPUB cursor.
- **Audio → EPUB**: no bias. Mid-paragraph landings are visually
  fine and easy to scan back from.

```ts
// EPUB → Audio
const seekMs = Math.max(0, computedAudioMs - 3000);

// Audio → EPUB
const targetOffset = computedEpubOffset; // no bias
```

Do **not** "fix" this to be symmetric — the asymmetry is the point.

### 4. Refuse to link single-track audiobooks instead of falling back to percentage

When an audiobook has only one track (no chapter metadata), the UI
**refuses to link** rather than silently degrading to a whole-book
percentage map.

Reasons:

- A whole-book percentage map produces dramatically worse landings
  (entire-book drift instead of within-chapter drift).
- Users cannot distinguish "this pairing is approximate" from
  "this pairing is exact" once linked, so silent fallback erodes
  trust in the feature.
- The refuse-to-link path is simpler: one error toast, no probabilistic
  branches in the seek code.

A follow-up issue is filed with a clear trigger condition (when a
percentage-fallback resume mode is in scope) so the option is
deferred, not lost.

### 5. Extract `rescanBookChapters` as a shared helper on the second consumer

The first surface that re-scans a book's chapters was the library
context menu. When the pairing dialog needed the same operation, the
logic was lifted out into `rescanBookChapters.ts` rather than
duplicated. Future surfaces (settings page, sync-conflict resolver,
etc.) reuse the same helper.

This follows the project's documented "extract on second consumer"
pattern (see `extract-shared-primitive-on-second-consumer-2026-04-18.md`).

### 6. `switchingRef` is intentionally never reset — the component unmounts

In `PairedFormatSwitcher`, a `switchingRef` boolean guards against
double-fires of the format-switch handler. It is set to `true` on
switch start and **never reset to `false`**.

This looks like a bug. It is not.

- The component unmounts as part of the navigation triggered by the
  switch (we navigate from the EPUB reader to the audio player or
  vice versa).
- Unmount drops the ref's owning instance; the next mount gets a
  fresh `switchingRef.current === false`.
- Resetting the ref inside the handler would re-open the
  double-fire window during the unmount animation.

**Invariant:** Do not add a `switchingRef.current = false` reset.
If a future change keeps the component mounted across format
switches, the guard needs to be redesigned (e.g., a debounce
window or a state machine), not naively reset.

### 7. Review-fixer correctly rejected F8 — preserve documented invariants

During review the F8 advisory finding suggested resetting
`switchingRef` (see #6). The review-fixer agent rejected the fix
because the surrounding code documents the unmount-driven self-clean
invariant.

This is the correct behavior and worth reinforcing: **a review finding
that contradicts a documented invariant should be rejected with a
pointer to the documentation, not silently applied.** "An advisory
reviewer flagged it" is not sufficient justification to override an
explicit design decision.

If you receive a similar finding in the future, either:

1. Reject it and reference the invariant comment / this doc, or
2. If the invariant itself is wrong, change the invariant
   deliberately and update both the code comment and this doc.

## Why This Matters

Each of these decisions has a tempting wrong answer that looks like a
small simplification:

| Decision | Tempting wrong answer | What it actually breaks |
|---|---|---|
| Time-percentage math | "Use word counts, more accurate" | Requires data we don't have; complexity for no perceivable user benefit |
| Lazy chapter fetch | "Prefetch on sync, faster pairing" | N+1 against ABS on every sync, breaks large libraries |
| Asymmetric 3 s bias | "Symmetric is cleaner" | Half of all format switches land mid-word |
| Refuse single-track | "Fallback to percentage" | Silent quality cliff; users cannot tell good pairings from bad |
| Inline rescan | "Just duplicate, it's small" | Drift between surfaces as the rescan logic evolves |
| Reset switchingRef | "Refs should always be cleaned up" | Re-opens double-fire window during navigation |
| Apply F8 anyway | "Reviewer flagged it, just fix it" | Documented invariant erodes; next reviewer flags it again |

Most of these only fail under conditions that are awkward to test
(large libraries, mid-word audio landings, single-track edge cases,
unmount races). Without this doc, each one will be "fixed" by the
next contributor and re-introduced as a regression.

## When to Apply

- Touching any code under `src/lib/format-pairing/` or the
  `rescanBookChapters` helper.
- Adding a new surface that initiates pairing or re-scans chapters.
- Reviewing PRs in this area — use the table above as a checklist
  for tempting-wrong-answer regressions.
- Triaging the deferred percentage-fallback follow-up; the
  refuse-to-link decision is the baseline to argue against.

## Examples

### Lazy fetch, cached into Book

```ts
// src/lib/format-pairing/rescanBookChapters.ts
export async function rescanBookChapters(book: Book): Promise<Chapter[]> {
  if (book.chapters?.length) return book.chapters;          // local cache hit
  const chapters = await abs.fetchItemChapters(book.absId); // lazy, scoped to pairing
  await db.books.update(book.id, { chapters });             // cache for next time
  return chapters;
}
```

This is called from the pairing dialog and the context-menu rescan
action; it is **not** called from `syncLibrary()`.

### Asymmetric translation

```ts
function translateEpubToAudio(epubPos, mapping) {
  const ms = proportionalAudioMs(epubPos, mapping);
  return Math.max(0, ms - 3000); // 3 s lead-in
}

function translateAudioToEpub(audioPos, mapping) {
  return proportionalEpubOffset(audioPos, mapping); // no bias
}
```

### Refuse to link

```ts
if (audiobook.tracks.length === 1 && !audiobook.chapters?.length) {
  toast.error('This audiobook has no chapter metadata; pairing is unavailable.');
  return; // do not silently fall back to percentage mapping
}
```

## Related

- Plan: `/Users/pedro/.claude/plans/the-link-formats-really-merry-eich.md`
- PR: https://github.com/PedroLages/knowlune/pull/456
- Branch: `feature/ce-2026-04-25-link-formats-really-merry-eich`
- Pattern: `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`
- Pattern: `docs/solutions/best-practices/audiobook-prefs-hydration-allow-list-pattern-2026-04-25.md`
