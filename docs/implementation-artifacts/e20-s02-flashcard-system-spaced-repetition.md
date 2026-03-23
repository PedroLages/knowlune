---
story_id: E20-S02
story_name: "Flashcard System with Spaced Repetition"
status: in-progress
started: 2026-03-23
completed:
reviewed: true
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 20.02: Flashcard System with Spaced Repetition

## Story

As a learner who forgets concepts after completing courses,
I want to create flashcards from my notes and review them using spaced repetition,
so that I retain knowledge long-term.

## Acceptance Criteria

- **AC1:** Given I am viewing a note, when I select text and click "Create Flashcard", then a dialog opens pre-filled with the selected text as the front of the card, allowing me to enter the back
- **AC2:** Given I have created flashcards, when I navigate to the Flashcards page, then I see a review queue showing cards due today
- **AC3:** Given I am reviewing a flashcard, when I rate it as Hard/Good/Easy, then the SM-2 algorithm calculates the next review date and updates the card's interval and ease factor
- **AC4:** Given I have reviewed all due cards, when no cards remain, then a completion message is displayed with stats (cards reviewed, next review date)
- **AC5:** Given the SM-2 algorithm is applied, when a card is rated "Easy", then the interval increases more than "Good", which increases more than "Hard"
- **AC6:** Given flashcards exist, when I view the Flashcards page, then I see total cards, due today count, and upcoming review schedule

## Tasks / Subtasks

- [ ] Task 1: Add Dexie table for flashcards with schema migration (AC: 1,2)
  - [ ] 1.1 Define Flashcard interface in types
  - [ ] 1.2 Add flashcards table to Dexie schema
  - [ ] 1.3 Create DB version migration
- [ ] Task 2: Implement SM-2 spaced repetition algorithm (AC: 3,5)
  - [ ] 2.1 Create `src/lib/spacedRepetition.ts` with SM-2 logic
  - [ ] 2.2 Add unit tests for SM-2 calculations
- [ ] Task 3: Create Zustand flashcard store (AC: 1,2,3,4,6)
  - [ ] 3.1 Create `useFlashcardStore` with CRUD + review actions
  - [ ] 3.2 Integrate SM-2 algorithm into review action
- [ ] Task 4: Add "Create Flashcard" action to Notes page (AC: 1)
  - [ ] 4.1 Add context menu / button for selected text
  - [ ] 4.2 Create flashcard creation dialog
- [ ] Task 5: Create Flashcards page with review interface (AC: 2,3,4,6)
  - [ ] 5.1 Create `src/app/pages/Flashcards.tsx`
  - [ ] 5.2 Build review queue UI with card flip animation
  - [ ] 5.3 Add Hard/Good/Easy rating buttons
  - [ ] 5.4 Display stats and completion state
- [ ] Task 6: Add route and navigation (AC: 2)
  - [ ] 6.1 Add route in `routes.tsx`
  - [ ] 6.2 Add "Flashcards" to sidebar navigation

## Implementation Plan

See [plan](plans/e20-s02-flashcard-system-spaced-repetition.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

**Date:** 2026-03-23 | **Report:** [design-review-2026-03-23-e20-s02.md](../reviews/design/design-review-2026-03-23-e20-s02.md)

- ✅ Zero hardcoded colors; design token discipline excellent
- ✅ `prefers-reduced-motion` handled at every animated boundary
- ✅ Keyboard accessibility exemplary (Space/Enter/1/2/3, `aria-live`)
- ⚠️ H1: Review header buttons 32px on mobile — below 44px WCAG 2.5.8 touch target (`Flashcards.tsx:360-368`, change `size="sm"` → `size="default"`)
- M1: 3-column stats grid clips at 375px — add `grid-cols-2 sm:grid-cols-3`
- M2: Rating button tinted backgrounds invisible in dark mode — increase to `/20` opacity
- N1: `"← Back"` uses Unicode arrow — replace with `<ArrowLeft />`
- N2: `"⌘↵ to save"` is Mac-only — update to `"⌘/Ctrl+↵"`

## Code Review Feedback

**Date:** 2026-03-23 | **Report:** [code-review-2026-03-23-e20-s02.md](../reviews/code/code-review-2026-03-23-e20-s02.md)

- ✅ SM-2 algorithm correctly extracts `SpacedRepetitionState` interface for structural reuse
- ✅ Optimistic update + rollback pattern matches Knowlune conventions
- 🚫 **BLOCKER B1:** `noteId` never passed to NoteEditor in LessonPlayer/NoteCard — all flashcards created with `noteId: undefined` (`LessonPlayer.tsx:757,879,925,988`)
- ⚠️ H1: `FIXED_NOW = new Date()` at module scope — page open past midnight shows stale due counts (`Flashcards.tsx:27`)
- ⚠️ H2: `handleRate` missing try/catch/finally — `isRating` stuck `true` on DB failure, UI permanently frozen (`Flashcards.tsx:134-155`)
- ⚠️ H3: Entire store destructured without selectors — unnecessary re-renders + `predictRetention` called on every render (`Flashcards.tsx:79-91`)
- ⚠️ H4: Load error state not shown — load failure indistinguishable from empty state
- M1: `formatNextReviewDate` returns "Tomorrow" for cards due today/overdue (`Flashcards.tsx:29-40`)
- M2: Phase `'reviewing'` + undefined `currentCard` → blank screen with no recovery (`Flashcards.tsx:481`)
- M3: `CreateFlashcardDialog.handleCreate` no try/catch — dialog closes on failure without feedback

## Web Design Guidelines Review

**Date:** 2026-03-23 | **Report:** [web-design-guidelines-2026-03-23-e20-s02.md](../reviews/design/web-design-guidelines-2026-03-23-e20-s02.md)

- 0 BLOCKERs, 0 HIGH, 4 MEDIUM, 16 LOW
- M: `FIXED_NOW` module-scope stale value (same as code review H1)
- M: `setTimeout(500)` for post-flip focus has no cleanup — use `onAnimationComplete`
- M: `"← Back"` Unicode arrow (same as design review N1)
- M: Decorative `<Layers />` icons missing `aria-hidden="true"` (`FlashcardReviewCard.tsx:67,115`)
- L: `formatNextReviewDate` off-by-one — today returns "Tomorrow"
- L: `toLocaleDateString('en-US', ...)` hardcodes locale
- L: `perspective: 1000` should be `perspective: '1000px'` (`FlashcardReviewCard.tsx:43`)

## Challenges and Lessons Learned

**Dexie schema migration discipline:**
- Adding a new `flashcards` table required a Dexie version bump (v19 → v20) with an explicit upgrade handler. The pattern is `db.version(20).stores({ flashcards: '++id, courseId, dueDate, ...' }).upgrade(tx => ...)`. Forgetting to add the table key in `.stores()` results in the table being inaccessible even after the version bump — always verify both `.stores()` and the upgrade callback.

**SM-2 algorithm implementation nuances:**
- The SM-2 algorithm uses an ease factor (EF) that starts at 2.5 and decreases on "Hard" ratings. The critical constraint is `EF >= 1.3` to prevent infinitely short intervals. The initial interval on the first correct review is 1 day, then 6 days, then EF × previous interval — this graduation sequence took multiple iterations to match the original SM-2 spec. A dedicated `SpacedRepetitionState` interface was extracted (`refactor(E20-S02)`) to allow the algorithm to be reused for future review-queue features.

**Zustand store with IndexedDB persistence:**
- The `useFlashcardStore` follows the established Knowlune pattern: optimistic state update → async IndexedDB write → rollback on failure. One subtle issue was that the review session state (`reviewQueue`, `reviewIndex`) is ephemeral UI state, not persisted — this is intentional and differs from card CRUD state. The `isReviewActive` flag was added to the store but turned out unused in the component; the review mode is instead inferred from `reviewQueue.length > 0 && reviewIndex < reviewQueue.length`. Removed in the review pre-check.

**BubbleMenuBar text selection integration:**
- The "Create Flashcard" button in `BubbleMenuBar` only appears when text is selected in TipTap and the note has a valid `courseId`. This required reading the TipTap selection state via `editor.state.selection` and comparing `from !== to`. The selected text is passed as the initial `front` value of the flashcard dialog, which is the key UX for AC1.

**`motion/react` animation with conditional sections:**
- `Flashcards.tsx` uses `MotionConfig` with `staggerChildren` for the stats grid and review queue sections. A subtle issue: when switching between "review mode" and "overview mode", the layout shift can cause the `AnimatePresence` to flash. The solution was to keep the review card always mounted but toggle visibility via opacity/scale variants rather than conditional rendering.

**Missing E2E spec — testing via navigation smoke test:**
- No story-specific E2E spec was written; the AC coverage relies on unit tests for SM-2 logic (`spacedRepetition.test.ts`, 23 tests) and store behavior (`useFlashcardStore.test.ts`, 24 tests). The Flashcards route is covered by the updated navigation smoke test. For future stories adding interactive review flows, consider adding a dedicated E2E spec testing the flip-and-rate cycle.

**Pre-review fix: `isReviewActive` unused variable:**
- TypeScript caught a destructured variable from `useFlashcardStore` that was never used in the component. This was a TS6133 error (not caught by `eslint --fix`). Remove unused store destructuring immediately when refactoring components.
