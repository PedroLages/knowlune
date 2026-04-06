## External Code Review: E101-S06 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E101-S06

### Findings

#### Blockers

*(None)*

#### High Priority

- **[src/app/components/audiobook/AudiobookRenderer.tsx:119 (confidence: 90)]**: **Stale `totalDuration` in periodic save creates a closure trap.** `savePosition` depends on `book.totalDuration`, and the new 5-second interval effect also depends on `savePosition`. If `totalDuration` changes (e.g., book metadata update, or the component re-renders with updated book data), `savePosition` identity changes every time `totalDuration` changes, causing the interval to tear down and restart. More critically, because `totalDuration` is captured in the `useCallback` closure, if the interval fires with a stale `totalDuration` while a re-render is pending, an incorrect progress percentage is persisted to Dexie. Fix: Read `totalDuration` from the Zustand store inside `savePosition` via `useBookStore.getState()` (or from a ref) rather than from the `book` prop, and remove `book.totalDuration` from the dependency array. This also stabilizes the interval effect.

- **[src/app/components/library/BookCard.tsx:126-145 (confidence: 85)]`: **Nested IIFE with incorrect early-return semantics.** The IIFE uses `return book.chapters.find(...)` but the `find` callback contains an IIFE at line 137 (`(() => { ... })()`) that returns a boolean. However, the `find` predicate evaluates `_ch.position.type === 'time'` for the current chapter but only guards the *next* chapter's position with a nested check. If any chapter has `position.type !== 'time'` (e.g., `'page'` or `'cfi'`), `_ch.position.seconds` is accessed without a type guard on line 131, causing a TypeScript error or runtime `undefined` behavior. The `pos.seconds >= (_ch.position.type === 'time' ? _ch.position.seconds : 0)` handles the current chapter, but the overall logic silently misclassifies chapters with non-time positions. Fix: Filter or coerce non-time chapter positions explicitly, or add a type guard before accessing `.seconds` on the current chapter's position in the comparison.

#### Medium

- **[src/app/components/library/BookCard.tsx:148-151 (confidence: 75)]**: **Negative time remaining displayed when `currentPosition.seconds > totalDuration`.** The calculation `Math.max(0, book.totalDuration - book.currentPosition.seconds)` produces `0` in the UI, which displays as `"0s left"` or similar via `formatDuration`. This is technically correct due to `Math.max(0, ...)`, but if `formatDuration(0)` produces an unexpected string (e.g., `"0m left"` or an empty string), the display is confusing for a completed book. More importantly, there's no "completed" state handling — a book at 100% still shows time remaining. Fix: Add an explicit check: if progress is 100 or position >= totalDuration, display "Completed" or similar instead of "0s left".

- **[tests/e2e/audiobookshelf/streaming.spec.ts:150-156 (confidence: 80)]**: **Comment that was previously on its own line is now appended to the previous statement without a semicolon.** The reformatting at line 155 moved `// Mirror to global so tests can poll deterministically` from its own line to after `srcDescriptor.set.call(this, value)` without a semicolon. Due to ASI, this is technically fine, but the comment now visually appears to be part of the `if` block body rather than describing the next statement. The next line `(window as Window & { __TEST_AUDIO_SRC__?: string }).__TEST_AUDIO_SRC__ = value` executes unconditionally (correct), but a reader could misinterpret the indentation. Fix: Restore the comment to its own line or add a semicolon and newline for clarity.

#### Nits

*(None)*

---
Issues found: 4 | Blockers: 0 | High: 2 | Medium: 2 | Nits: 0
