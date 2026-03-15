---
story_id: E11-S01
story_name: "Spaced Review System"
status: in-progress
started: 2026-03-15
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 11.1: Spaced Review System

## Story

As a learner,
I want to schedule notes for spaced review using a difficulty rating and see a prioritized review queue,
So that I can retain knowledge more effectively by reviewing material at optimal intervals.

## Acceptance Criteria

**Given** a learner has completed reviewing a note
**When** they rate the note using the 3-grade system (Hard / Good / Easy)
**Then** the system records the rating and calculates the next review interval based on recall difficulty
**And** Hard shortens the interval, Good maintains a moderate interval, and Easy extends the interval

**Given** a learner has notes scheduled for spaced review
**When** they open the review queue
**Then** notes due for review are displayed sorted by predicted retention percentage, lowest retention first
**And** each note shows the predicted retention percentage, course name, topic, and time until due

**Given** a learner rates a note that was previously reviewed
**When** the new rating is submitted
**Then** the system updates the review interval based on the cumulative review history and latest rating
**And** the review queue re-sorts to reflect the updated retention predictions

**Given** a learner has no notes due for review
**When** they open the review queue
**Then** the system displays an empty state indicating no reviews are currently due
**And** shows the date and time of the next upcoming review

**Given** an IndexedDB write fails when saving a review rating
**When** the error is detected
**Then** the system displays a toast notification with a retry option
**And** the rating is preserved in memory so the review queue state is not lost

## Tasks / Subtasks

- [ ] Task 1: Design and implement spaced repetition algorithm (AC: 1, 3)
  - [ ] 1.1 Create interval calculation with 3-grade system (Hard/Good/Easy)
  - [ ] 1.2 Implement retention percentage prediction based on review history
  - [ ] 1.3 Add cumulative review history tracking for interval updates
- [ ] Task 2: Set up Dexie schema and data layer (AC: 1, 3, 5)
  - [ ] 2.1 Add ReviewRecord table to Dexie schema (noteId, rating, reviewedAt, nextReviewAt, interval, easeFactor)
  - [ ] 2.2 Create review data access functions (save rating, get due reviews, update intervals)
  - [ ] 2.3 Implement error handling with in-memory fallback for IndexedDB failures
- [ ] Task 3: Create Zustand review store (AC: 1, 2, 3, 5)
  - [ ] 3.1 Build useReviewStore with review queue state, rating actions, retry logic
  - [ ] 3.2 Add computed selectors for due reviews sorted by retention percentage
- [ ] Task 4: Build Review Queue UI page (AC: 2, 4)
  - [ ] 4.1 Create ReviewQueue page component with sorted review cards
  - [ ] 4.2 Display retention percentage, course name, topic, time until due per card
  - [ ] 4.3 Implement empty state with next upcoming review date/time
- [ ] Task 5: Build Rating interaction UI (AC: 1, 3)
  - [ ] 5.1 Create rating component with Hard/Good/Easy buttons
  - [ ] 5.2 Wire rating submission to store and DB with toast feedback
- [ ] Task 6: Add route and navigation (AC: 2)
  - [ ] 6.1 Add /review route to routes.tsx
  - [ ] 6.2 Add sidebar navigation entry
- [ ] Task 7: Write tests (AC: all)
  - [ ] 7.1 Unit tests for spaced repetition interval calculation
  - [ ] 7.2 E2E tests for review queue, rating interaction, interval updates, and empty state

## Design Guidance

### Layout Approach
- **Page structure**: Full-width page within existing Layout shell (sidebar + header). Follow the same pattern as Overview.tsx — page heading at top, content grid below.
- **Review queue**: Vertical card stack (single column on mobile, max-width container on desktop). Cards should be scannable — the learner is in "study mode" so minimize cognitive load.
- **Empty state**: Centered illustration/icon + message + next review date. Follow the pattern used in other empty states (e.g., Challenges, Bookmarks).

### Component Structure
| Component | Location | Purpose |
|-----------|----------|---------|
| `ReviewQueue` (page) | `src/app/pages/ReviewQueue.tsx` | Route-level page, loads store, renders card list or empty state |
| `ReviewCard` | `src/app/components/figma/ReviewCard.tsx` | Single review item: note excerpt, retention %, course, topic, due time |
| `RatingButtons` | `src/app/components/figma/RatingButtons.tsx` | Hard / Good / Easy button group, attached to each card |
| `ReviewEmptyState` | `src/app/components/figma/ReviewEmptyState.tsx` | Empty state with next review countdown |

### Design Token Usage
| Element | Token | Rationale |
|---------|-------|-----------|
| Review card background | `bg-card` | Consistent with all other cards in the app |
| Card border radius | `rounded-[24px]` | LevelUp card standard |
| Retention % (low, <50%) | `text-destructive` | Visually urgent — needs review soon |
| Retention % (medium, 50-79%) | `text-warning` | Caution — review soon |
| Retention % (high, 80%+) | `text-success` | Safe — retention is strong |
| Hard button | `bg-destructive/10 text-destructive hover:bg-destructive/20` | Soft destructive for urgency without alarm |
| Good button | `bg-brand-soft text-brand hover:bg-brand-muted` | Brand color for neutral/default action |
| Easy button | `bg-success-soft text-success hover:bg-success/20` | Success for confidence |
| Empty state icon | `text-muted-foreground` | Subdued, non-alarming |
| Page heading | `font-display` (Space Grotesk) | Consistent with all page headings |

### Responsive Strategy
- **Mobile-first** (< 640px): Full-width cards with stacked metadata (retention % above, course/topic below note title). Rating buttons span full width.
- **Tablet** (640-1024px): Cards get slight horizontal padding. Rating buttons remain full-width within card.
- **Desktop** (> 1024px): Max-width container (~720px) centered. Cards can show metadata inline (retention % left, course/topic right). Rating buttons right-aligned within card.

### Accessibility Requirements
- **Rating buttons**: Use `role="group"` with `aria-label="Rate your recall"`. Each button needs descriptive `aria-label` (e.g., "Rate as Hard — shorter review interval").
- **Retention percentage**: Use `aria-label` with full text (e.g., "Predicted retention: 42%") since the visual might be just "42%".
- **Empty state**: Ensure the next review date is in an `aria-live="polite"` region if it updates dynamically.
- **Keyboard navigation**: Tab through cards, Enter/Space to rate. Focus should move to next card after rating.
- **Color contrast**: All retention % colors meet 4.5:1 against `bg-card`. Verify `text-warning` on white passes.
- **Toast notifications** (AC5): Sonner toasts are already accessible. Ensure retry button is keyboard-reachable.

### Motion & Micro-interactions
- Use `motion/react` for card exit animation when rated (fade out + slide up, ~200ms).
- Stagger card entrance on page load (existing `staggerContainer` + `fadeUp` pattern from Overview).
- Rating button hover: subtle scale (1.02) + background color transition.

## Implementation Plan

See [plan](plans/e11-s01-spaced-review-system.md) for implementation approach.

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

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
