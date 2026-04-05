## External Code Review: e88-s04 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-05
**Story**: e88-s04

### Findings

#### Blockers

- **[src/app/components/library/AudiobookImportFlow.tsx:353-362] (confidence: 90)**: **`crypto.randomUUID()` is called twice for the same M4B book** — once in `processM4bFile` (line ~170) and again in `handleImportM4b` (line 353). The `bookId` from the first call is embedded in chapter IDs and `m4bParsed.chapters`, but the second call creates a *different* `bookId`. Then at line 360, `handleImportM4b` overwrites `ch.bookId` on each chapter to the new ID. This works accidentally, but if any code path depends on the original chapter `id` containing the correct book association (e.g., chapter `id` was generated during the first `parseM4bFile` call with the stale `bookId`), there's a semantic mismatch. More critically, the first `crypto.randomUUID()` in `processM4bFile` is completely wasted work and the variable is never used — dead code that signals the author intended to use it but forgot. If someone later relies on `m4bParsed.chapters[].bookId` matching the final book, it will break.
  Fix: Remove the `bookId` generation from `processM4bFile` (it's unused). In `parseM4bFile`, either accept `bookId` as optional (defaulting to a placeholder) or defer chapter ID generation to `handleImportM4b` where the real `bookId` is known.

#### High Priority

- **[src/app/hooks/useAudioPlayer.ts:149-151] (confidence: 85)**: **`handleEnded` closure captures a stale `book` reference.** The `useEffect` for the audio `ended` event has `[]` dependency (intentionally run-once per comment), but the `handleEnded` callback reads `book?.chapters` from the closure. When the user navigates to a different book, `book` changes but the event listener still references the *original* book from when the effect first ran. This means auto-advance to next chapter on `ended` would use the wrong chapter list.
  Fix: Use a ref to track the current `book`, or re-attach the listener when `book` changes, or read from a store instead of the closure.

- **[src/app/hooks/useAudioPlayer.ts:198-226] (confidence: 80)**: **Single-file chapter tracking interval doesn't update when `book` changes.** The `useEffect` depends on `[singleFile, book, setCurrentChapterIndex]`, but if the user switches between audiobooks (both single-file), `book` object identity changes on every render (it's passed as a prop), causing the interval to be recreated on every render. This is because `book` is a plain object and `singleFile` is derived from it — there's no memoization. In practice this means the interval is cleared and reset on every render, which causes a 500ms blind spot each time.
  Fix: Depend on `book?.id` instead of `book` to avoid re-creating the interval on every render.

- **[src/services/M4bParserService.ts:87-93] (confidence: 75)**: **iTunes chapter tag extraction is unreliable — filtering by `tag.id.toLowerCase().includes('chap')` may match unrelated tags.** The iTunes native tag format from `music-metadata` uses `id` fields like `stik`, `rate`, etc. Chapter atoms in MP4 are stored in a separate box structure (`chpl` or `chap`), not as flat tags with 'chap' in their ID. This fallback will likely either match zero tags or match incorrect tags, silently producing chapters with `startTime: 0` for all of them.
  Fix: Check `music-metadata`'s actual chapter parsing — in v11, chapters should already be on `metadata.chapters` if the format supports it. The iTunes native fallback may be unnecessary or needs to target the actual `chpl` box format.

- **[src/app/hooks/useAudioPlayer.ts:255-315] (confidence: 70)**: **`loadChapterInternal` re-loads the entire M4B file on every chapter switch for single-file mode.** The check `if (_loadedBookId !== book.id)` protects against re-loading when staying on the same book, but `_loadedBookId` is a module-level variable that is never reset when the audio element's source is changed by other code paths (e.g., switching to an EPUB then back). Additionally, if the audio element is garbage collected or its `src` is cleared elsewhere, `_loadedBookId` still matches, causing the seek to fail silently on a stale audio source.
  Fix: Reset `_loadedBookId = null` whenever `audio.src` is set to anything outside of the single-file path, and verify `audio.src` is still valid before skipping the load.

#### Medium

- **[src/app/components/library/BookImportDialog.tsx:99-101] (confidence: 85)**: **When a file is dropped/selected via `initialFile` and it's an M4B, `processFile` sets `importMode` to `'audiobook'` and returns without passing the file to `AudiobookImportFlow`.** The `initialFile` is only processed once on mount via `useEffect`. After switching to audiobook mode, the file is lost — the user must re-select it manually inside `AudiobookImportFlow`.
  Fix: Pass the `initialFile` through to `AudiobookImportFlow` when the mode switches, or auto-trigger the file input with the stored file reference.

- **[src/app/components/library/AudiobookImportFlow.tsx:205-213] (confidence: 75)**: **`processFiles` is called with `files` that may contain both M4B and MP3 files, but only the first M4B is processed and all MP3s are silently ignored.** If a user selects `book.m4b` along with some MP3s, the MP3s are discarded without any warning.
  Fix: If both M4B and MP3 files are selected, show a toast warning that M4B takes priority, or reject the mixed selection with a clear error message.

- **[src/app/hooks/useAudioPlayer.ts:425-430] (confidence: 70)**: **Single-file `skipForward` caps at `audio.duration` but doesn't trigger end-of-book behavior (pause, update state).** In multi-file mode, `ended` event fires naturally. In single-file mode, seeking to the very end of the file may not fire `ended` (since `ended` only fires when playback reaches the end, not when seeking). The user can end up in a paused-at-end state with no chapter completion.
  Fix: After seeking near the end in single-file mode, check if the new time is within a small threshold of `audio.duration` and trigger end-of-book logic.

#### Nits

- **[src/services/M4bParserService.ts:62-66] (confidence: 60)**: The `as Record<string, unknown>` casts to access `metadata.chapters` are fragile and bypass TypeScript's type safety. If `music-metadata`'s types evolve, this will silently break. Consider using a type guard or asserting a more specific interface.

---
Issues found: 8 | Blockers: 1 | High: 4 | Medium: 3 | Nits: 1
