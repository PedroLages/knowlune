---
title: "fix: Skip celebration modal for individual lesson completions"
type: fix
status: active
date: 2026-05-03
---

# fix: Skip celebration modal for individual lesson completions

## Overview

Currently, the `CompletionModal` (with confetti and "Lesson Completed!" message) appears every time a user finishes a single lesson. Change the behavior so the celebration modal only appears when the **entire course** is completed — all lessons finished. Auto-advance countdown to the next lesson should continue to work after each individual lesson.

## Problem Frame

The celebration modal was designed with three tiers (lesson/module/course), but the lesson-level modal is intrusive — it interrupts the learning flow after every single lesson. Users should feel a sense of progress without a full-screen celebration each time. The modal should be reserved for the meaningful milestone of completing an entire course.

## Requirements Trace

- R1. After finishing a single lesson (video ends, YouTube >90%, or manual mark-complete), do **not** show the celebration modal unless the lesson also completes the course
- R2. After finishing the final lesson of a course, show the course-level celebration modal (with trophy, stats, confetti)
- R3. Auto-advance countdown to the next lesson must still appear after each individual lesson completion
- R4. Persistence of completion status must still happen after each individual lesson (no change to data layer)

## Scope Boundaries

- Only the celebration modal trigger behavior changes — completion persistence, auto-advance, next-course suggestions all stay the same
- The `CompletionModal` component itself keeps the `lesson` and `module` types (they may be used elsewhere or re-enabled later)
- The `BottomNav` "Mark Complete" toggle is unaffected (it already doesn't trigger the modal)

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useCompletionFlow.ts` — `showCelebration()` (line 92) is the single gate that decides whether to show the modal and at what level
- `src/app/components/celebrations/CompletionModal.tsx` — renders the modal, title, description, confetti, stats
- `src/app/pages/UnifiedLessonPlayer.tsx` — wires `useCompletionFlow` to the `CompletionModal`, passes celebration state
- `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx` — unit tests for the completion flow callbacks (lines 200-300)

### Key Pattern: Auto-advance is independent of celebration

Auto-advance countdown is triggered in `handleVideoEnded` and `handleYouTubeAutoComplete` **after** the `showCelebration` call — they are separate code paths. This means we can gate the modal without affecting auto-advance.

### Institutional Learnings

- None directly applicable

## Key Technical Decisions

- **Change `showCelebration` to bail out early**: When the course is not fully complete, `showCelebration` returns without setting any celebration state. This is the single choke-point — both active triggers (video end, YouTube auto-complete) flow through it. (`handleManualStatusChange` is also defined on the hook but is currently not wired to any UI component.) Alternative (modifying each caller individually) would touch more code for no benefit.
- **Keep the `celebrationType` state and `CompletionModal` component unchanged**: Removing the `lesson`/`module` types from the component would be a broader refactor not justified by this fix. The modal still accepts all types; the hook simply stops requesting lesson-level celebrations.

## Implementation Units

- [ ] **Unit 1: Gate celebration modal to course completion only**

**Goal:** Modify `showCelebration` in `useCompletionFlow` to only open the modal when all course lessons are complete.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/hooks/useCompletionFlow.ts`
- Modify: `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`

**Approach:**
- In `showCelebration`, after computing `isCourseComplete`, add an early return: `if (!isCourseComplete) return`
- Remove the ternary for `celebrationType` — it will always be `'course'` when we proceed past the guard
- Remove the ternary for `celebrationTitle` — it will always use `courseName`
- All callers (`handleVideoEnded`, `handleYouTubeAutoComplete`, `handleManualStatusChange`) remain unchanged — they still call `showCelebration`, which now silently no-ops for individual lessons

**Patterns to follow:**
- Same early-return guard pattern already used in `handleVideoEnded` (line 111-112) for missing `courseId`/`lessonId`

**Test scenarios:**
- Happy path: When a single lesson finishes (mock other lessons as `not-started`), the celebration modal does NOT appear, but auto-advance countdown DOES appear (if next lesson exists)
- Happy path: When the final lesson of a course finishes (mock all other lessons as `completed`), the celebration modal appears with `data-type="course"`
- Edge case: When a course has only 1 lesson, finishing it shows the course-level celebration modal
- Edge case: When `setItemStatus` fails (throws), no celebration appears and no auto-advance — error toast still fires (existing behavior preserved)
- Edge case: When there are no lessons in the course (`lessons.length === 0`), no celebration appears

**Existing tests requiring migration** (in `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`):
1. `'shows celebration modal when video ends'` (line 212) — currently asserts modal IS shown with a single lesson. After the fix, completing one lesson with others `not-started` should NOT show the modal. Rename to `'does NOT show celebration when only one lesson is completed'` and assert `queryByTestId('celebration-modal').not.toBeInTheDocument()`.
2. `'shows lesson-level celebration when not all lessons are complete'` (line 247) — currently asserts `data-type="lesson"`. After the fix, no modal should appear. Rename to `'does NOT show celebration when not all lessons are complete'` and assert modal is absent.
3. `'does not call adapter.getLessons() in showCelebration (uses hook data)'` (line 280) — currently waits for the modal to appear. After the fix with `not-started` mock, the modal won't open and the test will time out. Change `mockGetItemStatus` to return `'completed'` for all other lessons so the course-level celebration opens, making the `getLessons` assertion still testable.

**Verification:**
- Run `npm run test:unit -- src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx` — all tests pass after updates
- Manual: open a course with multiple lessons, finish one lesson — no celebration modal appears, but auto-advance countdown shows

---

- [ ] **Unit 2: (Optional) Update course completion message**

**Goal:** Refresh the course completion modal copy to better celebrate the achievement, since it's now the only celebration.

**Requirements:** R2 (enhancement)

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/celebrations/CompletionModal.tsx`
- Modify: `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx` (update any assertions on the old course-completion copy strings if present)

**Approach:**
- Update the course title from `"🎉 Course Completed!"` to something more celebratory
- Update the course description to emphasize the accomplishment
- Suggestions (to be decided at implementation time):
  - Title: `"🎉 Course Complete!"` or `"🏆 You Finished the Course!"`
  - Description: `You completed all lessons in "{title}". Great work staying committed!`

**Test scenarios:**
- Happy path: When a course is completed, the modal displays the updated title and description text
- Existing test "shows course-level celebration when all lessons are complete" still passes (verifies the modal renders with `data-type="course"`)

**Verification:**
- Complete a course in the browser — verify the updated message renders correctly

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Users may miss the visual feedback of completing a lesson | The auto-advance countdown, the completed checkmark in the lesson sidebar, and the progress bar all provide feedback. The celebration wasn't the only signal. |

## Sources & References

- `src/app/hooks/useCompletionFlow.ts` — primary change location
- `src/app/components/celebrations/CompletionModal.tsx` — modal component (optional copy update)
- `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx` — affected tests
