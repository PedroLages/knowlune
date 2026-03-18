---
story_id: E12-S05
story_name: "Display Multiple Choice Questions"
status: in-progress
started: 2026-03-18
completed:
reviewed: true
review_started: 2026-03-18
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 12.5: Display Multiple Choice Questions

## Story

As a learner,
I want to see multiple choice questions with selectable answer options,
So that I can answer quiz questions by selecting the correct option.

**FRs Fulfilled:** QFR9 (multiple choice display), QFR2 (question display), QFR14 (rich text in questions)

## Acceptance Criteria

**Given** a quiz with multiple choice questions
**When** I view a question
**Then** I see the question text rendered as Markdown (via `react-markdown` with `remark-gfm`)
**And** the question is wrapped in a card: `bg-card rounded-[24px] p-6 lg:p-8`
**And** I see 2-6 answer options as styled radio buttons below the question
**And** each option uses the label wrapper pattern from the UX spec
**And** all options are unselected initially (no default selection)
**And** I can select exactly one option at a time (radio group behavior)

**Given** I select an answer option
**When** I click or tap on a radio button or its label
**Then** the option becomes visually selected: `border-2 border-brand bg-brand-soft rounded-xl p-4`
**And** unselected options show: `border border-border bg-card hover:bg-accent rounded-xl p-4`
**And** any previously selected option becomes unselected
**And** `useQuizStore.submitAnswer(questionId, selectedOption)` is called
**And** the selection persists via Zustand store if I navigate away and return

**Given** the QuestionDisplay component API
**When** defining the component props
**Then** it accepts a `mode` prop: `'active' | 'review-correct' | 'review-incorrect' | 'review-disabled'`
**And** in 'active' mode (Epic 12): only unselected and selected states render
**And** review modes (Epic 16): correct (`border-success bg-success-soft`), incorrect (`border-warning`), disabled (`opacity-60`)
**And** this prop surface exists now to prevent API breakage when review mode ships

**Given** the question display on mobile (<640px)
**When** rendering answer options
**Then** options stack vertically with full-width labels
**And** each option has minimum height `h-12` (48px) for touch targets per UX spec

**Given** a question with fewer than 2 or more than 6 options
**When** rendering the question
**Then** it renders whatever options exist (graceful degradation)
**And** logs a warning to console for data quality monitoring

## Tasks / Subtasks

- [ ] Task 1: Create QuestionDisplay polymorphic renderer component (AC: 3)
  - [ ] 1.1 Create `src/app/components/quiz/QuestionDisplay.tsx` with `mode` prop
  - [ ] 1.2 Implement switch on question.type dispatching to type-specific components
  - [ ] 1.3 Handle unsupported question type fallback
- [ ] Task 2: Create MultipleChoiceQuestion component (AC: 1, 2, 4, 5)
  - [ ] 2.1 Create `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
  - [ ] 2.2 Render question text with react-markdown + remark-gfm
  - [ ] 2.3 Implement radio group with shadcn/ui RadioGroup
  - [ ] 2.4 Style selected/unselected states per UX spec
  - [ ] 2.5 Wire up useQuizStore.submitAnswer on selection change
  - [ ] 2.6 Ensure 48px touch targets and mobile responsiveness
  - [ ] 2.7 Add console warning for <2 or >6 options
- [ ] Task 3: Integrate QuestionDisplay into QuizPlayer page (AC: 1, 2)
  - [ ] 3.1 Wire QuestionDisplay into existing QuizPlayer component
  - [ ] 3.2 Pass current question + user answer from store
  - [ ] 3.3 Verify answer persistence across navigation
- [ ] Task 4: Verify dependencies (react-markdown, remark-gfm) are installed
- [ ] Task 5: Write unit tests for MultipleChoiceQuestion and QuestionDisplay
- [ ] Task 6: Write E2E tests for answer selection, persistence, and keyboard navigation

## Design Guidance

### Layout Approach

The question display lives inside the existing Quiz page card (`bg-card rounded-[24px]`). It renders below QuizHeader as a self-contained section. No additional outer card needed — the Quiz page already provides the card wrapper.

**Vertical flow** (top to bottom):
1. QuizHeader (title, progress bar, timer) — already exists
2. Question text (Markdown rendered via `react-markdown`)
3. Answer options (RadioGroup — vertical stack)

### Component Composition

```
QuizPage (existing)
└── QuizHeader (existing)
└── QuestionDisplay (new — polymorphic dispatcher)
    └── MultipleChoiceQuestion (new — MC-specific renderer)
        ├── <fieldset> wrapper
        ├── <legend> with ReactMarkdown question text
        └── RadioGroup with label-wrapped RadioGroupItems
```

**QuestionDisplay** is a thin dispatcher — switches on `question.type` and renders the appropriate sub-component. The `mode` prop flows through to child components but only `'active'` is implemented in Epic 12.

**MultipleChoiceQuestion** owns all MC-specific rendering: Markdown question text, radio group, option styling, and store integration.

### Design System Token Usage

| Element | Token Classes |
|---------|---------------|
| Question card | Already provided by Quiz page: `bg-card rounded-[24px] p-4 sm:p-8` |
| Question text | `text-lg lg:text-xl text-foreground leading-relaxed` |
| Selected option | `border-2 border-brand bg-brand-soft rounded-xl p-4` |
| Unselected option | `border border-border bg-card hover:bg-accent rounded-xl p-4` |
| Option text | `text-base text-foreground leading-relaxed` |
| Focus ring | Global `*:focus-visible` already handles: `outline-2 outline-brand outline-offset-2` |
| Review: correct (E16) | `border-2 border-success bg-success-soft` |
| Review: incorrect (E16) | `border-2 border-warning` |
| Review: disabled (E16) | `opacity-60 pointer-events-none` |

### Responsive Strategy

**Mobile-first** — single column on all viewports (two-column deferred per ACs):
- Options always stack vertically via `space-y-3` on the RadioGroup
- Each option label: `min-h-12` (48px) for WCAG touch targets
- Padding scales: `p-4` mobile, unchanged on desktop (options don't need more)
- Question text scales: `text-lg` → `lg:text-xl`
- Card padding inherited from Quiz page: `p-4 sm:p-8`

### Accessibility Requirements

- **Semantic HTML**: `<fieldset>` wrapping the question, `<legend>` containing the question text
- **RadioGroup**: shadcn/ui RadioGroup provides `role="radiogroup"` and proper ARIA attributes
- **Keyboard**: Tab to enter group, Arrow keys between options, Space/Enter to select
- **Focus visible**: Global theme handles this — `outline: 2px solid var(--brand); outline-offset: 2px`
- **Screen reader**: Legend announces question text, each RadioGroupItem announces option text
- **No default selection**: RadioGroup starts with no `value` (empty string)

### Transition & Animation

Keep it subtle — quiz-taking is a focused activity:
- **Selection state change**: `transition-colors duration-150` on option labels for smooth border/background shifts
- **No entrance animations**: Questions should appear instantly (no stagger, no fade)
- **Hover feedback**: `hover:bg-accent` provides gentle highlight on unselected options
- **Respect `prefers-reduced-motion`**: Transitions are already minimal, but wrap in `motion-safe:` if adding anything beyond color transitions

### Markdown Rendering Notes

- Use `react-markdown` with `remark-gfm` plugin for GFM tables, strikethrough, etc.
- Question text may contain: bold, italic, code blocks, ordered/unordered lists
- Apply `prose` or custom styles to Markdown output for consistent typography
- Code blocks in questions: use default `<code>` styling (no syntax highlighting library needed — defer per ACs)

## Implementation Plan

See [plan](plans/elegant-gathering-whisper.md) for implementation approach.

## Implementation Notes

- **Polymorphic dispatcher pattern**: `QuestionDisplay` uses a switch on `question.type` to dispatch to type-specific renderers. Only `multiple-choice` is implemented now; additional types (fill-in-the-blank, matching) will be added in Epic 14 by adding new cases.
- **Mode prop surface**: The `QuestionDisplayMode` union type (`active | review-correct | review-incorrect | review-disabled`) is defined now but only `active` renders interactively. Review modes will ship in Epic 16 without API changes.
- **Semantic HTML**: `<fieldset>` + `<legend>` wrap the question for accessibility. The `<legend>` contains the Markdown-rendered question text.
- **Dependencies**: `react-markdown` and `remark-gfm` were already installed from prior work.
- **Store integration**: Selection calls `useQuizStore.submitAnswer()` via the `onChange` prop threaded from Quiz page. The Quiz page reads the current answer from `progress.answers[question.id]` for persistence across navigation.

## Testing Notes

- **Unit tests** (Vitest + React Testing Library): Cover QuestionDisplay dispatch (multiple-choice renders correctly, unsupported type shows fallback), MultipleChoiceQuestion rendering (options display, selection state, radio group behavior, Markdown rendering, console warning for <2 or >6 options).
- **E2E tests** (Playwright): `story-e12-s05.spec.ts` validates answer selection, visual styling for selected/unselected states, persistence via store, and keyboard navigation (arrow keys between options).
- **Hooks ordering fix**: Initial integration surfaced a React hooks ordering issue in Quiz.tsx — hooks were called conditionally after early returns. Fixed by moving all hooks above conditional rendering logic (commit `285b23a`).

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

- **M1**: Redundant spacing — `space-y-4` on fieldset + `mb-4` on legend both control same gap
- **M2**: `RadioGroup` div lacks `aria-labelledby` connecting to question legend
- **N1**: `gap-3` (from shadcn RadioGroup) + `space-y-3` doubles option spacing to 24px
- Design tokens verified correct, contrast ratios 13.34:1/16.67:1, touch targets 60px on mobile
- Full report: `docs/reviews/design/design-review-2026-03-18-e12-s05.md`

## Code Review Feedback

**High**: Border 1px→2px layout shift on selection, duplicate option keys as React keys, remarkPlugins array recreated per render, stale closure risk in submitAnswer
**Medium**: useEffect for sync console.warn, type assertions at dispatch boundary, legend containing block-level Markdown, networkidle in E2E
**Testing**: AC2 visual CSS states untested, submitAnswer store integration untested, persistence across navigation untested, review-incorrect mode untested
- Full code report: `docs/reviews/code/code-review-2026-03-18-e12-s05.md`
- Full testing report: `docs/reviews/code/code-review-testing-2026-03-18-e12-s05.md`
- Edge case report: `docs/reviews/code/edge-case-review-2026-03-18-e12-s05.md`

## Web Design Guidelines Review

- **MEDIUM**: Loading skeleton missing `aria-label="Loading quiz"`
- **MEDIUM**: No retry mechanism for fetch errors (acceptable for IndexedDB)
- **LOW**: No `focus-within` styling on label card wrappers
- **LOW**: Unsupported question type fallback div missing `role="status"`
- **LOW**: No `aria-live` region for question transitions (future concern)
- Full report via web-design-guidelines agent

## Challenges and Lessons Learned

1. **React hooks ordering with conditional early returns**: The Quiz page had early returns for loading/error/not-found states that appeared *before* hooks. After adding `QuestionDisplay` integration (which required reading store state), hooks were being called conditionally, violating the Rules of Hooks. **Fix**: Moved all hooks to the top of the component, before any conditional returns. **Lesson**: When integrating new components into existing pages with early-return patterns, audit hook placement first.

2. **Polymorphic type narrowing**: The `QuestionDisplay` component receives a generic `Question` type but dispatches to `MultipleChoiceQuestion` which expects `string | undefined` for `value`. A type assertion (`value as string | undefined`) was needed at the dispatch boundary. **Lesson**: Polymorphic dispatchers need explicit type narrowing at the switch boundary — this is an expected trade-off of the pattern.

3. **Fieldset/legend with Markdown**: Using `<legend>` to contain `react-markdown` output provides excellent screen reader behavior (the question text is announced as the group label) but required testing to confirm Markdown block elements render correctly inside `<legend>`. They do in all tested browsers.
