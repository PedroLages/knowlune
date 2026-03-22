---
story_id: E15-S02
story_name: "Configure Timer Duration and Accommodations"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 15.2: Configure Timer Duration and Accommodations

## Story

As a learner,
I want to configure the quiz timer duration before starting,
so that I can adjust time limits to my needs (including accessibility accommodations).

**FRs Fulfilled: QFR25, QFR26, QFR29**

## Acceptance Criteria

**Given** a quiz with a configurable time limit
**When** I view the quiz start screen
**Then** I see the default time limit (e.g., "15 minutes")
**And** I see an "Accessibility Accommodations" link or button
**And** I can click it to open a settings modal

**Given** the accessibility accommodations modal
**When** I open it
**Then** I see options to extend time:
  - Standard time (e.g., 15 minutes)
  - 150% extended time (e.g., 22 minutes 30 seconds)
  - 200% extended time (e.g., 30 minutes)
  - Untimed (no time limit)
**And** I can select one option via radio buttons
**And** I see an explanation: "Extended time is available for learners who need additional time due to disabilities or other needs."

**Given** I select an accommodation
**When** I choose "150% extended time" and start the quiz
**Then** the timer is initialized to 150% of the default time
**And** the timer header indicates the accommodation (e.g., "22:30 (Extended Time)")

**Given** I select "Untimed"
**When** I start the quiz
**Then** no timer is displayed
**And** I can take as long as needed to complete the quiz
**And** time-to-completion is still tracked internally (not displayed)

**Given** I have set an accommodation preference
**When** I retake the quiz later
**Then** my preference persists (saved to Settings or localStorage)
**And** I don't need to re-configure on every attempt

## Tasks / Subtasks

- [ ] Task 1: Create TimerAccommodationsModal component (AC: 1, 2)
  - [ ] 1.1 Dialog with RadioGroup for accommodation options
  - [ ] 1.2 Explanation text for extended time
- [ ] Task 2: Add accommodations button to QuizStartScreen (AC: 1)
  - [ ] 2.1 "Accessibility Accommodations" link/button
  - [ ] 2.2 Show default time limit on start screen
- [ ] Task 3: Apply accommodation multiplier in useQuizStore (AC: 3, 4)
  - [ ] 3.1 Adjust timer initialization based on selected accommodation
  - [ ] 3.2 Handle "Untimed" mode (null timer, internal tracking)
  - [ ] 3.3 Timer header annotation "(Extended Time)"
- [ ] Task 4: Persist accommodation preference (AC: 5)
  - [ ] 4.1 Save preference to useSettingsStore or localStorage
  - [ ] 4.2 Validate accommodation value at runtime (guard against corrupted values)
  - [ ] 4.3 Pre-select saved preference on retake
- [ ] Task 5: E2E tests for timer accommodations

## Design Guidance

### Layout Approach

**QuizStartScreen modifications** — The accommodations trigger should live in the metadata badges row (line 56-66 of QuizStartScreen.tsx), positioned as an inline link adjacent to the time limit badge. Use `variant="link"` on a `<Button>` with a small clock/accessibility icon (Lucide `Clock` or `Accessibility`) to keep it visually lightweight but discoverable. The link should only render when `quiz.timeLimit != null` (no accommodations for already-untimed quizzes).

**TimerAccommodationsModal** — Use shadcn/ui `<Dialog>` (not AlertDialog — this is a selection, not a confirmation). Content should be compact: title, RadioGroup, explanation text, and a single "Save" action button. No footer cancel — clicking outside or pressing Escape dismisses. Keep modal width at `sm:max-w-md` to match the card's `max-w-2xl` proportionally.

### Component Structure

```
QuizStartScreen
├── Metadata badges row
│   ├── Question count badge (bg-brand-soft)
│   ├── Time limit badge (bg-muted) ← update to show adjusted time
│   ├── Passing score badge (bg-muted)
│   └── "Accessibility Accommodations" link button (NEW)
├── TimerAccommodationsModal (Dialog, controlled open state)
│   ├── DialogTitle: "Timer Accommodations"
│   ├── DialogDescription: supportive explanation
│   ├── RadioGroup (4 options, vertical stack)
│   │   ├── Standard time — "15 minutes"
│   │   ├── 150% extended — "22 minutes 30 seconds"
│   │   ├── 200% extended — "30 minutes"
│   │   └── Untimed — "No time limit"
│   └── Save button (variant="brand")
└── CTA area (existing)
```

### Design Token Usage

| Element | Token | Rationale |
|---------|-------|-----------|
| Accommodation link text | `text-brand-soft-foreground` | Matches brand-soft badge palette, passes 4.5:1 contrast |
| Radio option (selected) | `border-brand bg-brand-soft` | Consistent with E14 true/false radio selection pattern |
| Radio option (default) | `border-border bg-card` | Neutral default state |
| Explanation text | `text-muted-foreground text-sm` | De-emphasized helper text |
| Save button | `variant="brand"` | Primary action in modal |
| Time badge (adjusted) | `bg-brand-soft text-brand-soft-foreground` | Visually distinguishes adjusted time from default |
| Timer annotation "(Extended Time)" | `text-muted-foreground text-xs` | Subtle annotation next to countdown, doesn't compete with timer digits |

### Radio Option Card Pattern

Follow the established card-style radio pattern from E14 (true/false questions):
- Each option is a `<label>` wrapping a hidden `<RadioGroupItem>` + visible content
- Min height `min-h-12` (48px touch target)
- Rounded corners `rounded-xl` matching button style
- Selected state: `border-brand bg-brand-soft` with transition
- Hover state: `hover:border-brand/50` on unselected options
- Include calculated time in each label (e.g., "150% extended time (22 min 30 sec)")

### Responsive Strategy

- **Desktop (≥640px)**: Modal at `sm:max-w-md`, radio options in vertical stack with comfortable padding
- **Mobile (<640px)**: Modal goes full-width with `mx-4` margin. Radio options stack vertically (same as desktop — no layout change needed). Touch targets already ≥48px via `min-h-12`
- **Time badge update**: On QuizStartScreen, the adjusted time replaces the default time in the badge — no layout shift needed

### Timer Header Annotation

In `QuizTimer.tsx`, add an optional `annotation` prop (e.g., `"Extended Time"`). Render it as a `<span>` after the time digits:
```
22:30 (Extended Time)
```
- Annotation uses `text-muted-foreground text-xs` to stay subordinate to the timer digits
- When `annotation` is `undefined`, nothing renders (zero layout impact for standard time)
- Screen reader live region should include the annotation: "Time remaining: 22 minutes (Extended Time)"

### Untimed Mode

When "Untimed" is selected:
- `QuizTimer` component should not render at all (parent conditionally renders based on `timeRemaining !== null`)
- The time badge on QuizStartScreen updates from "15 min" to "Untimed"
- Internal time tracking continues via `QuizProgress.startTime` — no UI for this

### Accessibility Requirements (WCAG 2.1 AA+)

- **Dialog**: Focus trapped while open, Escape to close, focus returns to trigger on close (shadcn/ui Dialog handles this automatically via Radix)
- **RadioGroup**: Arrow key navigation between options (Radix RadioGroup provides this), `role="radiogroup"` with `aria-label="Timer accommodation"`
- **Screen reader**: Announce selected accommodation when modal closes (via `aria-live="polite"` region)
- **Keyboard**: All interactive elements reachable via Tab, radio options navigable via Arrow keys
- **Contrast**: All text meets 4.5:1 minimum — use design tokens, not hardcoded colors
- **Touch targets**: All radio options and buttons ≥44x44px (enforce via `min-h-12`)

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

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- **70% pre-built infrastructure**: The `TimerAccommodation` type, Zod enum, and `QuizProgress.timerAccommodation` field were already in place from type definitions in E12. The store had a TODO comment marking exactly where to insert the multiplier. This made the implementation primarily about UI + wiring rather than data modeling.
- **Untimed guard edge case**: When a quiz has `timeLimit: 15` but the user selects "Untimed", the store sets `timeRemaining: null`. However, `Quiz.tsx` line 224 was checking `currentQuiz?.timeLimit != null` (the quiz definition, not the accommodation) to initialize the timer. Added `currentProgress.timerAccommodation !== 'untimed'` guard to prevent timer from running when untimed is selected on a timed quiz.
- **localStorage persistence with Zod validation**: Used `TimerAccommodationEnum.safeParse()` to validate stored accommodation values — if someone tampers with localStorage, it gracefully falls back to `'standard'` instead of passing an invalid value to the multiplier logic.
- **Modal local state pattern**: The `TimerAccommodationsModal` uses a local `selected` state that only commits on "Save" click, preventing premature side effects from radio changes. Resyncs from prop on reopen without `useEffect`.
