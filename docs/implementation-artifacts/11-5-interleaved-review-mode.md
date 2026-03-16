---
story_id: E11-S05
story_name: "Interleaved Review Mode"
status: in-progress
started: 2026-03-16
completed:
reviewed: in-progress
review_started: 2026-03-16
review_gates_passed: []
burn_in_validated: false
---

# Story 11.5: Interleaved Review Mode

## Story

As a learner,
I want to review notes from multiple courses in a mixed sequence weighted by relevance,
So that I can strengthen cross-topic connections and improve long-term retention through varied practice.

## Acceptance Criteria

**Given** a learner activates interleaved review mode
**When** the review session begins
**Then** notes from multiple enrolled courses are surfaced in a mixed sequence
**And** the sequence is weighted by topic similarity and time since last review, prioritizing notes with longer gaps and related topics

**Given** an interleaved review session is in progress
**When** a note is presented to the learner
**Then** the note is displayed in a card-flip style interface with the prompt on the front and the content on the back
**And** the learner can flip the card to reveal the answer

**Given** a learner flips a card during interleaved review
**When** the answer is revealed
**Then** the learner can rate their recall using the same 3-grade system (Hard / Good / Easy) from the spaced review system
**And** the rating updates the note's review interval and retention prediction

**Given** a learner has notes from only one course
**When** they activate interleaved review mode
**Then** the system informs the learner that interleaved review works best with multiple courses
**And** offers to proceed with single-course review or return to the standard review queue

**Given** an interleaved review session is in progress
**When** the learner completes all queued notes or chooses to end the session
**Then** the system displays a session summary showing total notes reviewed, ratings distribution, courses covered, and an estimated retention improvement

## Tasks / Subtasks

- [ ] Task 1: Interleaved sequence weighting algorithm (AC: 1)
  - [ ] 1.1 Build algorithm to mix notes from multiple courses
  - [ ] 1.2 Weight by topic similarity and time since last review
  - [ ] 1.3 Prioritize notes with longer gaps and related topics
- [ ] Task 2: Card-flip review interface (AC: 2)
  - [ ] 2.1 Create card-flip UI with prompt on front, content on back
  - [ ] 2.2 Implement flip animation/interaction
- [ ] Task 3: Rating integration with spaced review (AC: 3)
  - [ ] 3.1 Reuse 3-grade rating system (Hard / Good / Easy)
  - [ ] 3.2 Update review interval and retention prediction on rating
- [ ] Task 4: Single-course fallback handling (AC: 4)
  - [ ] 4.1 Detect single-course scenario
  - [ ] 4.2 Show informational message with options
- [ ] Task 5: Session summary display (AC: 5)
  - [ ] 5.1 Track notes reviewed, ratings, courses covered
  - [ ] 5.2 Calculate estimated retention improvement
  - [ ] 5.3 Display summary UI

## Design Guidance

### Layout Approach

**Single-card focused layout** — unlike the ReviewQueue (vertical card list), interleaved mode presents **one card at a time** centered in the viewport. This forces active recall by preventing the learner from scanning ahead.

- Container: `mx-auto max-w-lg` (512px) centered, with generous vertical padding
- Progress indicator at top: `{current} / {total}` with a slim progress bar
- Card occupies the focal center of the screen
- Rating buttons appear below card **only after flip** (hidden before)
- "End Session" affordance in top-right corner

### Card-Flip Component (`InterleavedCard.tsx`)

**3D CSS flip using `transform-style: preserve-3d`** — not opacity fade:

```
.card-flip-container { perspective: 1000px; }
.card-flip-inner    { transform-style: preserve-3d; transition: transform 0.5s; }
.card-flip-inner.flipped { transform: rotateY(180deg); }
.card-front, .card-back { backface-visibility: hidden; position: absolute; inset: 0; }
.card-back { transform: rotateY(180deg); }
```

- **Front face**: Course badge (color-coded by `courseName`), topic tag, note title/prompt excerpt. "Tap to reveal" hint with `RotateCcw` icon
- **Back face**: Full note content (markdown rendered), retention badge, `<RatingButtons>` component (reuse from `src/app/components/figma/RatingButtons.tsx`)
- Card height: `min-h-[280px]` to prevent layout shift on flip
- Use `motion/react` for the flip (`animate={{ rotateY: flipped ? 180 : 0 }}`) consistent with existing ReviewCard animations
- `rounded-[24px]` card styling matching design system

### Component Composition

| Component | Location | Purpose |
|-----------|----------|---------|
| `InterleavedReview.tsx` | `src/app/pages/` | Page component (route-level) |
| `InterleavedCard.tsx` | `src/app/components/figma/` | Card-flip with front/back faces |
| `InterleavedSummary.tsx` | `src/app/components/figma/` | Session completion summary |
| `RatingButtons.tsx` | (existing) | Reuse unchanged |
| `useReviewStore.ts` | (existing) | Extend with interleaved session state |

### Design Token Usage

| Element | Token | Rationale |
|---------|-------|-----------|
| Card background | `bg-card` | Consistent with all cards |
| Card shadow | `shadow-md` → `shadow-lg` on hover | Elevated focus state |
| Course badges | `bg-brand-soft text-brand` | Matches ReviewCard pattern |
| Progress bar fill | `bg-brand` | Primary action color |
| Progress bar track | `bg-muted` | Neutral track |
| "End Session" button | `text-muted-foreground` | De-emphasized secondary action |
| Summary stats | `text-foreground` with `text-muted-foreground` labels | Standard data display |
| Hard rating | `bg-destructive/10 text-destructive` | Existing RatingButtons pattern |
| Good rating | `bg-brand-soft text-brand` | Existing RatingButtons pattern |
| Easy rating | `bg-success-soft text-success` | Existing RatingButtons pattern |

### Responsive Strategy

- **Mobile-first** (`< 640px`): Full-width card with `px-4`, stacked layout, larger tap targets (48px min)
- **Tablet** (`640px-1023px`): `max-w-md` centered, same stacked layout
- **Desktop** (`≥ 1024px`): `max-w-lg` centered, comfortable reading width
- Card flip works via tap (mobile) and click (desktop)
- Keyboard: `Space`/`Enter` to flip, `1`/`2`/`3` for Hard/Good/Easy ratings

### Accessibility (WCAG 2.1 AA+)

- Card: `role="button"` with `aria-label="Flip card to reveal answer"` (front state)
- After flip: `aria-live="polite"` region announces "Answer revealed. Rate your recall."
- Rating buttons: existing `role="group"` with `aria-label="Rate your recall"` (from RatingButtons)
- Progress: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Focus management: after rating, auto-focus next card's flip trigger (or summary heading if last card)
- Keyboard shortcuts: `Space`/`Enter` = flip, `1` = Hard, `2` = Good, `3` = Easy
- `prefers-reduced-motion`: skip flip animation, use instant state change

### Single-Course Fallback (AC4)

Use `AlertDialog` (shadcn/ui) — modal with two action buttons:
- Title: "Interleaved Review Works Best with Multiple Courses"
- Description: brief explanation of why mixing courses helps retention
- Primary action: "Continue with Single Course" → proceeds
- Secondary action: "Return to Review Queue" → navigates back
- Icon: `BookOpen` from Lucide

### Session Summary (AC5)

Displayed when all cards reviewed or "End Session" clicked:
- Layout: centered card (`max-w-lg`, `rounded-[24px]`)
- Stats grid (2x2 on mobile, 4-column on desktop):
  - Total notes reviewed (number)
  - Courses covered (number + course name pills)
  - Ratings distribution (mini bar chart or 3 colored segments)
  - Estimated retention improvement (percentage with arrow indicator)
- Actions: "Review More" (if unreviewed notes remain) | "Back to Dashboard"
- Celebration: subtle `confetti`-style animation via motion/react if all notes rated Easy (stretch goal)

## Implementation Plan

See [plan](plans/e11-s05-interleaved-review-mode.md) for implementation approach.

## Implementation Notes

**Dependencies:** Story 11.1 (spaced review system and rating infrastructure), Epic 3 (notes across multiple courses)

**Complexity:** Medium (3-5 hours)

## Testing Notes

Unit tests for interleaved sequence weighting algorithm, E2E for card-flip interface, rating interaction, single-course fallback, and session summary

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

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- Story setup: all dependencies (E11-S01 spaced review, Epic 3 notes) confirmed done. Existing `RatingButtons` and `useReviewStore.rateNote()` are fully reusable — no modifications needed.
- Design decision: chose Jaccard similarity on `tags[]` for topic weighting over vector embeddings — simpler, no AI dependency, sufficient for interleaving purposes.
- Card-flip approach: 3D CSS transform with `perspective` + `backfaceVisibility: hidden` chosen over opacity fade for physical feel.
