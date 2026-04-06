## External Code Review: E104-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E104-S01

### Findings

#### Blockers

#### High Priority

- **[src/app/components/library/LinkFormatsDialog.tsx:158](https://github.com/knowlune/knowl/blob/src/app/components/library/LinkFormatsDialog.tsx#L158) (confidence: 85)**: **Stale closure bug — `handleSave` silently drops chapter mappings.** `handleSave` reads `selectedBook` from a `useCallback` closure (dependency line 213). When `ChapterMappingEditor` calls `onSave(editedMappings)`, `selectedBook` in the closure may be `null` if the component re-rendered between editor initialization and save, causing the guard `if (!selectedBook) return` to silently discard user-edited mappings with no error feedback. The same applies to `handlePairPressed` which captures `book` and `selectedBook`. Fix: Move `selectedBook`/`book` reads inside the callback via `useBookStore.getState().books.find(...)`, or restructure so the required IDs are captured as primitives (already partially done for `book.id` but not `selectedBook` — capture `selectedBook.id` as a primitive and look up inside the callback). Alternatively, remove the guard and show a `toast.error` so the user isn't left wondering why nothing happened.

- **[src/app/components/library/LinkFormatsDialog.tsx:211](https://github.com/knowlune/knowl/blob/src/app/components/library/LinkFormatsDialog.tsx#L211) (confidence: 90)**: **`linkBooks` error is swallowed — `handleSave` has no catch block.** The `try/finally` in `handleSave` (line 205–213) calls `await linkBooks(...)` but has no `catch`. If `linkBooks` rejects (Dexie write failure, etc.), the error is silently swallowed: `finally` resets `saving` to `false`, the dialog stays open, but no error toast is shown to the user and the rejection propagates as an unhandled promise rejection. Fix: Add a `catch` block that logs the error and surfaces it via `toast.error('Failed to link books')`, matching the pattern used in `unlinkBooks` in the store.

#### Medium

- **[src/app/components/library/LinkFormatsDialog.tsx:169](https://github.com/knowlune/knowl/blob/src/app/components/library/LinkFormatsDialog.tsx#L169) (confidence: 80)**: **`handleUnlink` error is swallowed with no user feedback.** Same pattern as `handleSave` — `try/finally` without `catch`. If `unlinkBooks` rejects, `saving` resets but the user sees no error toast. The store action *does* show a toast, but any non-store error (e.g., subsequent `onOpenChange(false)` failure) would be lost. More importantly, if the dialog closes on error due to `onOpenChange(false)` in `finally` (wait — `onOpenChange(false)` is only in `try`, so on error the dialog stays open but no feedback is given). Fix: Add a `catch` block with `toast.error('Failed to unlink formats')` for defense-in-depth.

- **[src/app/components/library/LinkFormatsDialog.tsx:132-136](https://github.com/knowlune/knowl/blob/src/app/components/library/LinkFormatsDialog.tsx#L132) (confidence: 75)**: **`setTimeout` state reset can conflict with rapid open/close cycles.** `handleOpenChange` uses `setTimeout(() => setView('select'), 300)` when closing. If the dialog is re-opened within 300ms (e.g., double-click), the timeout fires after the dialog re-opens, resetting `view` to `'select'` even if the user had already navigated to a different view. Fix: Store the timeout ID in a ref and clear it on unmount and on re-open, or use a ref counter to gate the timeout.

- **[src/app/components/library/LinkFormatsDialog.tsx:143](https://github.com/knowlune/knowl/blob/src/app/components/library/LinkFormatsDialog.tsx#L143) (confidence: 70)**: **`selectedBook` can become stale when the books array updates.** `selectedBook` is computed from `books.find(b => b.id === selectedId)`, but `selectedId` is local state. If the selected book is deleted or modified externally while the dialog is open, `selectedBook` becomes stale or `null`. This isn't guarded in `handlePairPressed` beyond the early return, but the user gets no feedback that their selection became invalid. Fix: Add a `useEffect` that clears `selectedId` when the corresponding book disappears from `candidates`, and show a toast if the selection was auto-cleared.

- **[src/stores/useBookStore.ts:322-323](https://github.com/knowlune/knowl/blob/src/stores/useBookStore.ts#L322) (confidence: 65)**: **`unlinkBooks` Dexie update uses `undefined` as a value, which may not delete the field.** In Dexie, `{ linkedBookId: undefined }` via `db.books.update()` may store `undefined` rather than deleting the key, depending on the Dexie version. The correct way to remove a field is `{ linkedBookId: undefined }` with Dexie's `update` (which does handle this), but this behavior varies. If `linkedBookId` persists as `undefined` rather than being absent, `!!book.linkedBookId` checks elsewhere would still return `false` (correct), but any code checking `'linkedBookId' in book` would see it as present. Fix: Use `db.books.update(id, { linkedBookId: undefined as undefined })` (already done) — verify Dexie behavior in tests, or use `delete` via `db.books.where('id').equals(id).modify(b => { delete b.linkedBookId })` for explicit field removal.

#### Nits

- **[src/app/components/library/LinkFormatsDialog.tsx:378-395](https://github.com/knowlune/knowl/blob/src/app/components/library/LinkFormatsDialog.tsx#L378) (confidence: 60)**: **IIFE inside JSX for `ChapterMappingEditor` rendering reduces readability and makes it harder to extract logic for testing.** The inline `(() => { ... })()` pattern in the `editor` view computes `epubBook`/`audioBook` identically to `handlePairPressed`. This duplicated logic could drift if one is updated without the other. Consider extracting a shared `getEpubAndAudioBooks()` helper.

---
Issues found: 7 | Blockers: 0 | High: 2 | Medium: 5 | Nits: 1
