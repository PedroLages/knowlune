# E20-S02: Flashcard System with Spaced Repetition

## Context

Knowlune users forget concepts after completing courses. This story adds a flashcard system with SM-2 spaced repetition, allowing learners to create flashcards from their notes and review them on a schedule that adapts to their recall ability.

**Critical finding:** Epic 11 already implemented ~75% of the infrastructure — the SM-2 algorithm (`spacedRepetition.ts`), Zustand review store patterns, rating UI, and 3D flip card animation are all production-ready. E20-S02 builds on this foundation with a new data model, creation UI, and dedicated page.

## Task 1: Define Flashcard Type + Dexie Schema v20 Migration

**Files to modify:**
- `src/data/types.ts` — Add `Flashcard` interface after `ReviewRecord` (~line 363)
- `src/db/schema.ts` — Add `flashcards` EntityTable type + v20 migration
- `src/db/__tests__/schema.test.ts` — Update table list assertion + add flashcards table tests

**Flashcard type:**
```typescript
export interface Flashcard {
  id: string
  courseId: string
  noteId?: string           // Optional: provenance from note
  front: string
  back: string
  interval: number          // SM-2 (default 0)
  easeFactor: number        // SM-2 (default 2.5)
  reviewCount: number       // SM-2 (default 0)
  lastRating?: ReviewRating
  reviewedAt?: string       // ISO 8601
  nextReviewAt?: string     // ISO 8601 (null = never reviewed = immediately due)
  createdAt: string
  updatedAt: string
}
```

**Design decision:** Standalone type with embedded SM-2 fields (not FK to ReviewRecord). ReviewRecord is note-centric (one per note); Flashcard is concept-centric (many per note). Embedding avoids joins and keeps reads simple.

**Schema v20:** Redeclare all 20 existing tables + `flashcards: 'id, courseId, noteId, nextReviewAt, createdAt'`. No upgrade function needed (new table).

**Commit:** `feat(E20-S02): define Flashcard type and Dexie v20 schema migration`

---

## Task 2: Extract SpacedRepetitionState for Algorithm Reuse

**Files to modify:**
- `src/lib/spacedRepetition.ts` — Extract interface, widen function signatures
- `src/lib/__tests__/spacedRepetition.test.ts` — Add Flashcard-shaped compatibility tests

**What:** Extract a shared interface from the 3 fields `calculateNextReview` actually reads:

```typescript
export interface SpacedRepetitionState {
  reviewCount: number
  easeFactor: number
  interval: number
}
```

Widen `calculateNextReview(record: SpacedRepetitionState | null, ...)` — backwards-compatible since `ReviewRecord` satisfies the interface structurally. Similarly widen `isDue` to `{ nextReviewAt: string }` and `predictRetention` to `SpacedRepetitionState & { reviewedAt: string }`.

**Verify:** All 19 existing tests pass unchanged.

**Commit:** `refactor(E20-S02): extract SpacedRepetitionState interface for algorithm reuse`

---

## Task 3: Create useFlashcardStore (Zustand)

**Files to create:**
- `src/stores/useFlashcardStore.ts`
- `src/stores/__tests__/useFlashcardStore.test.ts`

**Pattern:** Follow `useReviewStore.ts` exactly — Zustand `create`, optimistic updates, `persistWithRetry`, toast on error.

**Store shape:**
```typescript
interface FlashcardState {
  flashcards: Flashcard[]
  isLoading: boolean
  error: string | null
  reviewQueue: Flashcard[]
  reviewIndex: number
  isReviewActive: boolean

  loadFlashcards: () => Promise<void>
  createFlashcard: (front: string, back: string, courseId: string, noteId?: string) => Promise<void>
  deleteFlashcard: (id: string) => Promise<void>
  getDueFlashcards: (now?: Date) => Flashcard[]
  startReviewSession: (now?: Date) => void
  rateFlashcard: (rating: ReviewRating, now?: Date) => Promise<void>
  getSessionSummary: () => FlashcardSessionSummary
  resetReviewSession: () => void
  getStats: (now?: Date) => { total: number; dueToday: number; nextReviewDate: string | null }
}
```

**Key detail:** Cards with `nextReviewAt` undefined/null are treated as immediately due (never reviewed).

**Reuse:** Import `calculateNextReview`, `predictRetention`, `isDue` from `spacedRepetition.ts`. Import `persistWithRetry` from existing `src/lib/persistWithRetry.ts`.

**Commit:** `feat(E20-S02): create useFlashcardStore with CRUD and review actions`

---

## Task 4: Create Flashcard from Notes (AC1)

**Files to create:**
- `src/app/components/notes/CreateFlashcardDialog.tsx`

**Files to modify:**
- `src/app/components/notes/BubbleMenuBar.tsx` — Add `Layers` icon button + `onCreateFlashcard` prop
- `src/app/components/notes/NoteEditor.tsx` — Add dialog state, handler, render dialog
- `src/app/pages/LessonPlayer.tsx` — Pass `noteId` prop to NoteEditor (4 instances)
- `src/app/components/notes/NoteCard.tsx` — Pass `noteId` prop to NoteEditor (1 instance)

**CreateFlashcardDialog:** shadcn `Dialog` with two `Textarea` fields (front pre-filled from selected text, back empty). `variant="brand"` Create button. Calls `useFlashcardStore.createFlashcard()` on submit.

**BubbleMenuBar integration:** Add optional `onCreateFlashcard` prop with `Layers` icon button. Only shown when prop provided (backwards-compatible).

**NoteEditor wiring:** `openFlashcardDialog` callback extracts selected text via `editor.state.doc.textBetween(from, to)`, opens dialog.

**Commit:** `feat(E20-S02): add Create Flashcard button to BubbleMenuBar and dialog`

---

## Task 5: Flashcards Page (AC2, AC3, AC4, AC5, AC6)

**Files to create:**
- `src/app/pages/Flashcards.tsx`
- `src/app/components/figma/FlashcardReviewCard.tsx`
- `src/app/components/figma/FlashcardSummary.tsx`

**Page phases:** `'loading' | 'dashboard' | 'reviewing' | 'summary'`

**Dashboard phase (AC2, AC6):**
- Stats: total cards, due today, next review date (3 stat cards in grid)
- Upcoming schedule: cards due per day for next 7 days
- "Start Review" brand button (visible when due > 0)
- Empty state when no flashcards exist

**Review phase (AC3, AC5):**
- Progress bar: `current / total`
- `FlashcardReviewCard`: 3D flip card (adapt `InterleavedCard.tsx` pattern)
  - Front: flashcard.front, course badge, "Tap to reveal"
  - Back: flashcard.back, `RatingButtons` (reuse existing component)
- Keyboard: Space/Enter to flip, 1/2/3 for Hard/Good/Easy
- After rating: advance to next card

**Summary phase (AC4):**
- Cards reviewed count, rating distribution, next review date
- "Back to Dashboard" + "Review More" buttons

**Reuse from Epic 11:**
- `RatingButtons` component (exact reuse)
- `InterleavedCard` 3D flip pattern (adapt for flashcard content)
- `motion/react` animations (`fadeUp`, `scaleIn`, `staggerContainer`)
- Empty state component pattern

**Commit:** `feat(E20-S02): create Flashcards page with stats, review, and completion views`

---

## Task 6: Route + Navigation (AC2)

**Files to modify:**
- `src/app/routes.tsx` — Add lazy import + `/flashcards` route
- `src/app/config/navigation.ts` — Add `{ name: 'Flashcards', path: '/flashcards', icon: Layers }` to Review group

**Placement:** After "Retention" in the Review navigation group.

**Commit:** `feat(E20-S02): add /flashcards route and sidebar navigation`

---

## Critical Files Reference

| Purpose | File | Action |
|---------|------|--------|
| SM-2 algorithm | `src/lib/spacedRepetition.ts` | Refactor (widen types) |
| Review store pattern | `src/stores/useReviewStore.ts` | Read (copy pattern) |
| 3D flip card pattern | `src/app/components/figma/InterleavedCard.tsx` | Read (adapt pattern) |
| Rating buttons | `src/app/components/figma/RatingButtons.tsx` | Reuse directly |
| Bubble menu | `src/app/components/notes/BubbleMenuBar.tsx` | Modify (add button) |
| Note editor | `src/app/components/notes/NoteEditor.tsx` | Modify (add dialog) |
| DB schema | `src/db/schema.ts` | Modify (v20 migration) |
| Types | `src/data/types.ts` | Modify (add Flashcard) |
| Routes | `src/app/routes.tsx` | Modify (add route) |
| Navigation | `src/app/config/navigation.ts` | Modify (add nav item) |
| Persist helper | `src/lib/persistWithRetry.ts` | Reuse directly |

## Verification

1. **Unit tests:** `npm run test:unit` — all existing + new tests pass
2. **Build:** `npm run build` — no type errors
3. **Lint:** `npm run lint` — no violations (design tokens, no inline styles)
4. **Manual flow:**
   - Open a note → select text → click Layers icon in bubble menu → dialog opens pre-filled
   - Enter back text → Create → toast confirms
   - Navigate to /flashcards → see card in due queue
   - Start Review → flip card → rate → advance → completion summary
5. **E2E tests:** `npx playwright test tests/e2e/regression/story-e20-s02.spec.ts`
