## External Code Review: E113-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-12
**Story**: E113-S01

### Findings

#### Blockers
- **[src/app/components/library/BookReviewEditor.tsx:72-74] (confidence: 90)**: `handleSaveText` silently drops review text when `review` is falsy. After a user sets a rating and focuses the textarea, the rating store update triggers a re-render. Due to the `useEffect` on line 60-62 (`[review?.reviewText]`) clearing local text when `reviewText` is `undefined`, and the `if (review)` guard on line 73, the "Save review" button becomes a no-op — the user's typed text is silently discarded with no feedback. Fix: Remove the `if (review)` guard and always call `setReviewText(bookId, localText)`, or better yet, save text unconditionally (the store already rejects unrated books with an error toast).

#### High Priority
- **[src/app/components/library/BookCard.tsx:54] (confidence: 85)**: `useBookReviewStore(s => s.getReviewForBook(book.id))` calls the *store action* `getReviewForBook` inside a selector. Since `getReviewForBook` calls `get().reviews.find(...)`, it reads the latest state outside React's subscription model, effectively bypassing Zustand's selector-based reactivity — the component may not re-render when reviews change, showing stale ratings. Fix: Use a proper selector that subscribes to the reviews slice: `const review = useBookReviewStore(s => s.reviews.find(r => r.bookId === book.id))`.

- **[src/stores/useBookReviewStore.ts:56] (confidence: 90)**: Race condition — `const { reviews } = get()` captures the reviews array, then `set({ reviews: updated })` performs an optimistic update. If two rapid `setRating` calls occur for different books, the second call captures `reviews` before the first's `set` completes, and the second `set` overwrites the first's optimistic update (lost review). Fix: Use the `set` callback form `set(state => ({ reviews: ... }))` to always read the latest state, and capture `reviews` from `state` inside the callback.

- **[src/stores/useBookReviewStore.ts:81] (confidence: 90)**: Same race condition in `setReviewText` — `const { reviews } = get()` on line 67 captures stale state. Concurrent calls can cause lost updates. Fix: Use `set(state => ...)` callback pattern.

- **[src/stores/useBookReviewStore.ts:94] (confidence: 90)**: Same race condition in `deleteReview` — `const { reviews } = get()` captures stale state for the optimistic delete. Fix: Use `set(state => ...)` callback pattern.

#### Medium
- **[src/app/components/library/BookReviewEditor.tsx:57-62] (confidence: 80)**: The `useEffect` that syncs `localText` fires whenever `review?.reviewText` changes, including after the user has started typing but before saving. If the store's `reviewText` is `undefined` (rating just set, no text saved yet), this resets `localText` to `''`, clearing the user's in-progress text. This is triggered by any re-render that causes the `review` object reference to change. Fix: Track whether the user is actively editing and skip the sync effect when `isEditing` is true, e.g., `useEffect(() => { if (!isEditing) setLocalText(review?.reviewText ?? '') }, [review?.reviewText, isEditing])`.

- **[src/app/components/library/StarRating.tsx:58] (confidence: 75)**: Keyboard handler calls `onChange` directly without updating local state, so arrow-key presses don't visually update the stars — the display depends entirely on the parent re-rendering with the new value. If the parent's state update is batched/deferred, the slider feels unresponsive. Also, `aria-valuenow` won't update until parent re-renders. Fix: Track keyboard-driven value in local state for immediate visual feedback, or document that the parent must synchronously update `value`.

#### Nits
- **[src/stores/useBookReviewStore.ts:48] (confidence: 60)**: `loadReviews` error is silently swallowed — `catch` shows a toast but never sets `isLoaded`, so every subsequent call re-attempts the load. If the DB is corrupted, this creates an infinite retry loop on every store interaction. Consider setting `isLoaded: true` in the catch or adding a dedicated `error` state.

---
Issues found: 8 | Blockers: 1 | High: 3 | Medium: 2 | Nits: 1
