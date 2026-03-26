## Edge Case Review — E20-S02 (2026-03-23)

### Unhandled Edge Cases

**`src/stores/useFlashcardStore.ts:2203-2207`** — `reviewCount === 0` but `interval > 0` (e.g., migrated/manually seeded card)
> Consequence: SM-2 first-review fixed intervals applied to a card that already has history, resetting progress.
> Guard: `const useFirstReview = currentCard.reviewCount === 0 && currentCard.interval === 0; calculateNextReview(useFirstReview ? null : currentCard, rating, now)`

---

**`src/stores/useFlashcardStore.ts:2182-2184`** — `reviewedAt` is a corrupt/invalid ISO string in DB
> Consequence: `predictRetention` returns `NaN`; sort comparator produces `NaN - NaN`, giving undefined/unstable review queue order.
> Guard: `const retA = a.reviewedAt && !isNaN(new Date(a.reviewedAt).getTime()) ? predictRetention(...) : 0`

---

**`src/app/pages/Flashcards.tsx:922`** — `FIXED_NOW` set at module load time, never updated
> Consequence: User keeping page open past midnight sees no newly-due cards; "Review More" redirects to dashboard even when cards are due.
> Guard: `const now = useMemo(() => new Date(), [])` inside component, or recompute on each relevant action

---

**`src/app/pages/Flashcards.tsx:924-935`** — `formatNextReviewDate` receives an invalid date string
> Consequence: Renders `"Invalid Date"` string visible to user in stats and summary panels.
> Guard: `const date = new Date(dateStr); if (isNaN(date.getTime())) return '—'`

---

**`src/app/pages/Flashcards.tsx:1086-1093`** — Global keyboard handler fires rating keys (1/2/3) when focus is on a non-dialog page element (e.g., header search input)
> Consequence: Keystroke in a focused input triggers flashcard rating without user intent.
> Guard: `if (target.closest('input, textarea, select, [contenteditable]')) return` before processing rating keys

---

**`src/app/components/notes/CreateFlashcardDialog.tsx:650-658`** — `courseId` prop is an empty string
> Consequence: Flashcard saved with `courseId: ''`; displays as "Unknown Course" on Flashcards page with no recovery path.
> Guard: `if (!front.trim() || !back.trim() || !courseId) return` in `handleCreate`

---

**`src/app/components/notes/NoteEditor.tsx:571-576`** — `openFlashcardDialog` called when TipTap selection is collapsed (`from === to`)
> Consequence: Dialog opens with empty front field; user unaware no text was selected.
> Guard: `if (from === to) return` at the top of `openFlashcardDialog`

---

**`src/lib/spacedRepetition.ts:hunk`** — `isDue` called with an invalid `nextReviewAt` date string
> Consequence: `new Date(invalid) <= now` evaluates `false`; due card treated as not due and excluded from review queue.
> Guard: `const d = new Date(record.nextReviewAt); return !isNaN(d.getTime()) && d <= now`

---

**Total:** 8 unhandled edge cases found.
