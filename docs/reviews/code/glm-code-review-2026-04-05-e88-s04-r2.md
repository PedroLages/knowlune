## External Code Review: E88-S04 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-05
**Story**: E88-S04

### Findings

#### Blockers

- **[src/app/hooks/useAudioPlayer.ts:445] (confidence: 92)**: **NaN seek in single-file `skipForward`.** When `audio.duration` is `NaN` (common before metadata loads or with certain M4B files), `Math.min(audio.currentTime + seconds, audio.duration || 0)` evaluates as `Math.min(currentTime + 30, 0)`, returning `0`. This silently seeks the user back to the beginning of the audiobook every time they press skip-forward. Fix: Guard with `const maxTime = isFinite(audio.duration) ? audio.duration : Infinity; const newTime = Math.min(audio.currentTime + seconds, maxTime);`

- **[src/app/hooks/useAudioPlayer.ts:243-319] (confidence: 88)**: **`loadChapterInternal` closes over stale `book` object.** The `useCallback` dependency array includes `book`, but `book` is a plain object whose identity changes on every parent render. This means `loadChapterInternal` is recreated on every render, causing all downstream callbacks (`skipForward`, `skipBack`, `loadChapter`) to also recreate — defeating the `loadChapterInternalRef` pattern meant to prevent stale closures. More critically, the single-file path inside `loadChapterInternal` reads `book.chapters`, `book.id`, `book.source` — if a render batch hasn't completed, these could be from a stale book. Fix: Use refs (`bookRef`) for values read inside the callback body, or depend on `book?.id` plus a ref for the full object.

#### High Priority

- **[src/app/hooks/useAudioPlayer.ts:172-179] (confidence: 90)**: **`handleEnded` in the singleton effect uses `bookRef.current` but doesn't call `loadChapterInternalRef.current` — it calls the bare `loadChapterInternal` directly.** Line 179 reads `loadChapterInternalRef.current(nextIndex, true)` but the ref is correctly used there. However, the effect also captures `stopRafLoop`, `setIsPlaying` which are stable — this is fine. Wait, actually re-reading: the effect at line ~155 uses `loadChapterInternalRef.current` correctly. No issue here on closer inspection. Withdrawing.

- **[src/app/hooks/useAudioPlayer.ts:343-345] (confidence: 85)**: **Module-level `_loadedBookId` is never reset when switching away from an M4B audiobook.** If a user plays an M4B book (sets `_loadedBookId = 'book-1'`), then navigates to an EPUB and back to the same M4B book, the guard `if (_loadedBookId !== book.id)` skips re-loading the file. But the shared audio element's `src` may have been changed by the multi-file MP3 path (line 359 sets `audio.src = url` and `_loadedBookId = null`). However, if the user navigates away without playing any audio (e.g., reads an EPUB), `_loadedBookId` still matches and `audio.src` still points to the old object URL which was revoked (line 295: `revokeSharedObjectUrl()`). This causes a silent playback failure — audio.src is a revoked blob URL. Fix: Reset `_loadedBookId = null` whenever `revokeSharedObjectUrl()` is called unconditionally, or whenever the component unmounts/switches books.

- **[src/app/components/library/BookImportDialog.tsx:98-105] (confidence: 82)**: **Race condition: `processFile` sets `importMode` and `file` in separate state updates, but the component may render between them.** `setImportMode('audiobook')` triggers a render that swaps `BookImportFlow` out for `AudiobookImportFlow`, but `setFile(selectedFile)` is batched in the same call (React 18+ batches these), so this is actually fine in React 18+. However, `AudiobookImportFlow` receives `initialFile` based on the `file` state, and the `useEffect([], [])` in `AudiobookImportFlow` runs once on mount — but by the time it runs, `file` state should be set. The real issue is: if the dialog is already in audiobook mode and the user drops another M4B, `initialFile` changes but the `useEffect([], [])` won't re-fire. Fix: Add `initialFile` as an optional dependency or use a separate mechanism to handle subsequent file drops.

- **[src/app/hooks/useAudioPlayer.ts:293-295] (confidence: 80)**: **Object URL revoked before new one is confirmed working.** In the single-file load path (line ~293), `revokeSharedObjectUrl()` is called *before* `audio.load()` succeeds. If `audio.load()` fails (line 304-311 rejects), the old URL is already revoked and the new one was never valid — the audio element is in a broken state with no recoverable URL. Fix: Revoke the old URL only after the new one has loaded successfully (inside the `onLoaded` callback).

#### Medium

- **[src/services/M4bParserService.ts:49] (confidence: 88)**: **Zero-byte M4B file passes through without validation.** `parseBlob()` on a 0-byte file will throw or return undefined metadata, but the error message will be unhelpful ("Failed to parse M4B file"). More importantly, `file.size === 0` means `totalDuration` will be 0, and the single-chapter fallback creates a chapter with `seconds: 0`. Downstream, `Math.floor(0 / 60)` displays "0 min" and a 0-duration audiobook is imported into the library. Fix: Add `if (file.size === 0) throw new Error('File is empty')` before calling `parseBlob`.

- **[src/app/hooks/useAudioPlayer.ts:199-241] (confidence: 75)**: **Chapter tracking interval only runs when `book` is truthy — but doesn't handle the book being swapped.** When switching from one M4B book to another, the cleanup runs and a new interval starts. But the interval closure captures `book.chapters` from the render where it was created. The dependency on `book?.id` is correct for knowing *when* to recreate, but `book` in the closure body is the stale render's `book`. In practice, `book?.id` changing triggers a new effect, but there's a brief window where the old interval fires with the old chapters. Fix: Use a ref for `book` inside the interval callback (`bookRef.current`), which is already kept fresh on every render.

- **[src/app/hooks/useAudioPlayer.ts:394] (confidence: 70)**: **`preservesPitch` assignment only in single-file path, removed from multi-file path.** The original code at the multi-file path (now line ~394) had `(audio as any).preservesPitch = true` which was removed in the diff. Multi-file MP3 playback no longer sets `preservesPitch`, so users who change playback rate on MP3 audiobooks will hear pitch-shifted audio. Fix: Add `(audio as any).preservesPitch = true` back to the multi-file path, or extract it to a shared helper called from both paths.

#### Nits

- **[src/app/components/library/AudiobookImportFlow.tsx:244] (confidence: 50)**: The `processFilesRef` pattern for the `useEffect([], [])` initialFile processing is clever but unconventional. A simpler approach would be to track `initialFile` in a ref and process it in a regular effect with `[initialFile]` dependency, using a "processed" flag ref to prevent re-processing.

---
Issues found: 8 | Blockers: 2 | High: 3 | Medium: 3 | Nits: 1
