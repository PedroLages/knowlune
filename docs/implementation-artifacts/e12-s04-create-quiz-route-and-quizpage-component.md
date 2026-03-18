---
story_id: E12-S04
story_name: "Create Quiz Route and QuizPage Component"
status: done
started: 2026-03-17
completed: 2026-03-18
reviewed: true
review_started: 2026-03-18
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 12.4: Create Quiz Route and QuizPage Component

## Story

As a learner,
I want to navigate to a quiz from a lesson and see the quiz start screen,
So that I can begin taking a quiz when I'm ready.

## Acceptance Criteria

**Given** a course lesson with an associated quiz
**When** I click "Take Quiz" from the lesson page
**Then** I navigate to `/courses/:courseId/lessons/:lessonId/quiz`
**And** the quiz is resolved by looking up the quiz associated with the lessonId from Dexie
**And** I see the quiz title and description
**And** I see metadata badges: question count (e.g., "12 questions"), time limit or "Untimed", passing score (e.g., "70% to pass")
**And** I see a "Start Quiz" button (`bg-brand text-brand-foreground hover:bg-brand-hover rounded-xl h-12 px-8`)
**And** I do NOT see any questions yet (start screen only)

**Given** the quiz start screen
**When** I click "Start Quiz"
**Then** useQuizStore.startQuiz(lessonId) is called
**And** the first question loads and displays
**And** the quiz header shows progress (e.g., "Question 1 of 12") with a progress bar
**And** the timer starts counting down if quiz is timed (MM:SS format, right-aligned)

**Given** I have an incomplete quiz in progress (currentProgress exists in localStorage)
**When** I navigate to the quiz URL
**Then** I see a "Resume Quiz" button showing "Resume Quiz (5 of 12 answered)"
**And** clicking it restores my exact position, answers, and question order

**Given** I navigate to a quiz URL for a non-existent quiz or a lesson with no quiz
**When** the quiz lookup fails
**Then** I see an error message: "No quiz found for this lesson"
**And** I see a link back to the course page

**Out of scope (deferred):**
- Accessibility accommodations link on start screen (Epic 15 — timer stories)
- `<QuestionDisplay>` renders a stub/placeholder until Story 12.5 implements it

## Tasks / Subtasks

- [x] Task 1: Add quiz route to routes.tsx (AC: 1)
  - [x] 1.1 Import Quiz page lazily
  - [x] 1.2 Add `{ path: '/courses/:courseId/lessons/:lessonId/quiz', element: <Quiz /> }` nested inside Layout
- [x] Task 2: Create `src/app/pages/Quiz.tsx` (AC: 1, 2, 3, 4)
  - [x] 2.1 Extract `courseId` and `lessonId` from route params
  - [x] 2.2 Load quiz from Dexie via `useQuizStore` or direct db lookup using `lessonId`
  - [x] 2.3 Render QuizStartScreen when quiz not started
  - [x] 2.4 Render QuestionDisplay stub when quiz started
  - [x] 2.5 Render error state when quiz not found
- [x] Task 3: Create `src/app/components/quiz/QuizHeader.tsx` (AC: 2)
  - [x] 3.1 Display quiz title
  - [x] 3.2 Show progress "Question X of Y" with Progress bar
  - [x] 3.3 Timer placeholder (right-aligned, MM:SS format)
- [x] Task 4: Create `src/app/components/quiz/QuizStartScreen.tsx` (AC: 1, 3)
  - [x] 4.1 Display quiz title and description
  - [x] 4.2 Render metadata badges: question count, time limit, passing score
  - [x] 4.3 Render "Start Quiz" button (brand styles, h-12, rounded-xl)
  - [x] 4.4 Render "Resume Quiz (X of Y answered)" button when progress exists
  - [x] 4.5 Call `onStart` / `onResume` callbacks on click

## Design Guidance

**Aesthetic direction:** Academic Clarity — clean, focused, exam-room stillness. Every element earns its place.

### Layout

Mobile-first, single-column centered card (`bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm`). On mobile use `mx-3`; badges inline flex-wrap; button `w-full sm:w-auto`.

Responsive breakpoints:
- `< 640px`: Full-width card `mx-3`, badges stack with `flex-wrap`, button spans full width
- `640–1023px`: Card centered `max-w-xl`, badges inline
- `≥ 1024px`: Full `max-w-2xl`, `p-8`

### QuizStartScreen

Vertical hierarchy top → bottom:
1. Title — `text-2xl font-semibold`
2. Description — `text-base text-muted-foreground mt-2`
3. Metadata badges — `flex flex-wrap gap-2 mt-6` (question count: `bg-brand-soft text-brand`; time limit + passing score: `bg-muted text-muted-foreground`; all `rounded-full px-3 py-1 text-sm`)
4. CTA area — `mt-8 flex flex-col sm:flex-row gap-3`

When resume state is active, promote "Resume Quiz" as the primary action (above Start). Show "Start Over" as tertiary ghost button below.

### QuizHeader

Horizontal strip at top of card. Shows only when quiz is active (after Start):
- Title: `text-lg font-semibold` (smaller than start screen)
- Timer: `font-mono text-sm text-muted-foreground tabular-nums` (right-aligned, `ml-auto`)
- Progress bar: shadcn `<Progress>` component, `mt-2` (full width)
- Progress text: `text-sm text-muted-foreground mt-1` — "Question 3 of 12"

QuizHeader should NOT render on the start screen — keep the lobby uncluttered.

### Error State

Centered, non-alarming (no red, no error icons):
```tsx
<div className="text-center py-12">
  <p className="text-muted-foreground">No quiz found for this lesson.</p>
  <Link to={`/courses/${courseId}`} className="text-brand hover:underline mt-4 inline-block text-sm">
    ← Back to course
  </Link>
</div>
```

### State Transitions

| State | What renders |
|---|---|
| Loading | Spinner/skeleton (Dexie is fast) |
| Not started | QuizStartScreen |
| In progress | QuizHeader + QuestionDisplay stub |
| Error | Error message + course link |

No slide animations — quiz context demands focus, not distraction. Keep state changes sharp.

### Accessibility

- Timer: `aria-live="polite"` updating every minute (not every second — too noisy). `aria-label="Time remaining: 28 minutes 43 seconds"`
- Progress bar: `aria-label="Quiz progress"` with `aria-valuenow` and `aria-valuemax`
- After clicking Start Quiz: move focus to first question via `useRef` + `.focus()`
- All buttons: `type="button"` explicit
- Verify `text-brand` on `bg-brand-soft` passes 4.5:1 contrast

## Implementation Plan

See [plan](plans/rustling-watching-lantern.md) for implementation approach.

## Implementation Notes

**Architecture decisions:**
- Quiz page fetches directly from Dexie (`db.quizzes.where('lessonId').equals(lessonId).first()`) rather than delegating to `useQuizStore` for the initial load. This avoids coupling the start-screen render to store state.
- Resume detection reads `localStorage.getItem('quiz-progress-${quizId}')` (per-quiz key) independently from the Zustand store's `levelup-quiz-store` key. The E2E test seeds via this key pattern.
- The "quiz active" transition is driven by `currentProgress?.quizId === quiz.id` from the Zustand store — set by `startQuiz()` or `handleResume()`.
- `useQuizStore.setState()` is used in `handleResume` to inject saved progress directly into the store. This is intentional — Zustand's public `setState` API is the correct mechanism for this kind of external state restoration.
- Timer in `QuizHeader` treats `timeRemaining` as **minutes** (matching `startQuiz`'s `timeRemaining: quiz.timeLimit ?? null` assignment). Countdown runs via `setInterval(1000)` started on mount with an empty deps array.
- E2E locator bug fixed: test AC4 used `filter({ hasText: /course/i })` which matched both the sidebar "Courses" nav link and the error-state back-link. Tightened to `getByRole('link', { name: /back to course/i })`.

**Patterns used:** Direct Dexie lookup, Zustand selector pattern, lazy route import, per-quiz localStorage key.

## Testing Notes

**Test strategy:** 6 E2E tests written in RED state (story pre-authored). All 6 pass on Chromium.
- AC1: Quiz start screen title/description/badges + "Untimed" badge variant
- AC2: Start Quiz → QuizHeader with "Question 1 of N" + MM:SS timer
- AC3: Resume button with answered count from per-quiz localStorage key
- AC4: Error state + back-link when quiz not found

**Edge cases:** Strict mode violation in AC4 locator fixed (sidebar nav "Courses" also matched `/course/i`).
Smoke regressions: navigation, overview, courses all pass.

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

Re-reviewed 2026-03-18. Full report: `docs/reviews/design/design-review-2026-03-18-e12-s04.md`

**Round 1 findings (2026-03-17): All 10 resolved** in commits 12207ed and ebf19dc.

**Round 2 new findings:**
- **HIGH (1):** "Back to course" link tap target 20px tall — needs `min-h-[44px]` for mobile touch target compliance (Quiz.tsx:144)
- **MEDIUM (2):** `--muted-foreground` contrast 3.88:1 (pre-existing theme issue, not quiz-specific); `mx-3` mobile margin additive with `<main>` padding producing narrower card

**Verdict: Approve after H1 fix.**

## Code Review Feedback

Re-reviewed 2026-03-18. Full reports:
- Architecture: `docs/reviews/code/code-review-2026-03-18-e12-s04.md`
- Testing: `docs/reviews/code/code-review-testing-2026-03-18-e12-s04.md`
- Edge cases: `docs/reviews/code/edge-case-review-2026-03-18-e12-s04.md`
- Web design guidelines: `docs/reviews/code/web-design-guidelines-2026-03-18-e12-s04.md`

**Round 1 carry-forward (2026-03-17): All 6 fixed** in commits 12207ed and ebf19dc.

**Round 2 new findings — carry forward to next story:**
- **HIGH (conf 90):** `useQuizStore.ts:193` — `partialize` only saves `currentProgress`, not `currentQuiz`. Browser refresh during active quiz silently discards progress. Fix: add `currentQuiz` to partialize.
- **HIGH (conf 82):** `QuizHeader.tsx:106` — `[remainingSeconds === null]` boolean expression in useEffect deps. Fragile — extract `isTimed` variable.
- **HIGH (conf 78):** `Quiz.tsx:93-95` — `.catch(console.error)` on `startQuiz` is unreachable dead code (store handles errors internally). Remove or comment.
- **MEDIUM (conf 75):** `QuizHeader.tsx:24` — `??` on `.length` never triggers for `0`. Use `||` or remove fallback.
- **MEDIUM (conf 70):** `Quiz.tsx:100-105` — `handleResume` doesn't validate `questionOrder` against current quiz questions (stale after quiz edit).
- **MEDIUM (conf 70):** `QuizHeader.tsx:30-33` — Timer doesn't react to prop changes (safe now but fragile).

**AC coverage:** 4/4 ACs covered by E2E tests. Previous AC3 blocker (resume click) verified fixed.

## Web Design Guidelines Review

Re-reviewed 2026-03-18. Full report: `docs/reviews/code/web-design-guidelines-2026-03-18-e12-s04.md`

**Round 1 findings (2026-03-17): All 6 resolved.**
**Round 2:** LOW — metadata badges lack `aria-label` on container; button manual class overrides vs custom variant. No blockers.

## Challenges and Lessons Learned

**1. useEffect + Dexie `.then()` requires ignore-flag cleanup**
Any `useEffect` that uses `.then()` (rather than `async/await`) must return a cleanup function with an `ignore` flag, or the `react-hooks-async/async-cleanup` ESLint rule fires as an error. The pattern is `let ignore = false` → check `if (ignore) return` inside `.then()` and `.catch()` → `return () => { ignore = true }`. This prevents stale state updates if the component unmounts before the Dexie query resolves.

**2. `eslint-disable-next-line react-hooks/exhaustive-deps` causes an error if the plugin isn't loaded**
This project doesn't have `eslint-plugin-react-hooks` configured. Adding the disable comment for this rule produces an ESLint error ("Definition for rule not found") rather than silently ignoring it. Intentional empty deps arrays (`[]` on a timer that should run once) can simply be left with a comment explaining the intent — no disable comment needed.

**3. New Dexie stores need a shared seed helper immediately**
The `manualIndexedDB` ESLint rule flags any `page.evaluate(indexedDB.open(...))` pattern as MEDIUM severity. When introducing a new Dexie store (here: `quizzes`), create a `seedQuizzes()` helper in `tests/support/helpers/indexeddb-seed.ts` before writing the spec — it's a 3-line wrapper around `seedIndexedDBStore()`. Doing it after the fact requires refactoring all test bodies.

**4. Strict-mode E2E locator: sidebar nav competes with page content**
`getByRole('link', { name: /course/i })` matched both the sidebar "Courses" nav link and the error-state "← Back to course" link, causing a strict mode violation. Use a more specific name: `getByRole('link', { name: /back to course/i })`. In general, prefer exact role+name combinations for links that could match sidebar items.

**5. Timer unit: `timeRemaining` from `startQuiz` is in minutes, not seconds**
`startQuiz()` sets `timeRemaining: quiz.timeLimit ?? null` where `timeLimit` is stored in minutes. `QuizHeader` must convert to seconds on mount: `Math.round(progress.timeRemaining * 60)`. If this conversion is missing, the timer shows `MM:SS` but counts down 60× too fast.
