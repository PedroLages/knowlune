## External Code Review: E101-S05 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E101-S05

### Findings

#### Blockers

- **src/app/components/audiobook/BookmarkButton.tsx:56 (confidence: 92)**: `onBookmarkCreated?.()` is called *before* the `try` block — so it fires even when `db.audioBookmarks.add()` throws. This means the badge counter increments even when no bookmark is persisted, and the post-session panel opens for bookmarks that don't exist. Fix: Move `onBookmarkCreated?.()` to after the successful `await db.audioBookmarks.add(...)` call (line ~50), so it only fires on confirmed persistence.

#### High Priority

- **src/app/components/audiobook/AudiobookRenderer.tsx:73 (confidence: 95)**: `sessionBookmarkCount` is never reset. Once incremented, it persists for the lifetime of the component, so the badge never clears and the post-session sheet keeps triggering on every subsequent pause. Fix: Reset `sessionBookmarkCount` to `0` when `postSessionOpen` transitions to `true` (or when playback resumes), and/or expose a `resetSession` callback.

- **src/app/components/audiobook/PostSessionBookmarkReview.tsx:63 (confidence: 88)**: `handleNoteSave` captures `editingNotes` from the outer closure, but the `onBlur` handler fires asynchronously. If the user edits another bookmark's note before blur completes, `editingNotes` inside the callback may be stale, potentially overwriting an in-flight edit with stale text. Fix: Use a ref to hold the latest `editingNotes`, or pass the note value directly as a parameter to `handleNoteSave` instead of reading from closure state.

#### Medium

- **src/app/components/audiobook/PostSessionBookmarkReview.tsx:55 (confidence: 85)**: `handleNoteChange` creates a new object on every keystroke (`{ ...prev, [id]: value }`) for the entire `editingNotes` map. When there are many bookmarks, this causes re-renders that re-render every `<textarea>` and row. This is a performance concern but not a bug. Fix: Consider debouncing or memoizing individual row components with `React.memo` to avoid cascading re-renders.

#### Nits

- **src/app/components/audiobook/AudiobookRenderer.tsx:65-71 (confidence: 75)**: The transition-detection `useEffect` fires on every `isPlaying` change, including the initial render. If `isPlaying` is `true` on mount (e.g., resuming a session from persisted state) and the component re-mounts, `prevIsPlayingRef.current` is `false`, so no false trigger occurs. However, if the component mounts with `isPlaying = true` and then the user pauses, `prevIsPlayingRef.current` will have been set to `true` from the first effect run, which is correct. No action required — just noting the initial-render behavior is safe.

---
Issues found: 4 | Blockers: 1 | High: 2 | Medium: 1 | Nits: 1
