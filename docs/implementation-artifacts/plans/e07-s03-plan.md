# Implementation Plan: E07-S03 Next Course Suggestion After Completion

**Branch:** `feature/e07-s03-next-course-suggestion-after-completion`
**Story file:** `docs/implementation-artifacts/7-3-next-course-suggestion-after-completion.md`
**Date:** 2026-03-08

---

## 1. Context & Architectural Overview

### What We're Building

When a learner completes 100% of a course, the app should:
1. Show a course-level celebration (existing `CompletionModal` component extended to `type='course'`)
2. After the celebration, present a **Next Course Suggestion card** — the most relevant unfinished course from their library, ranked by tag overlap and momentum proxy
3. Let the user navigate directly to the suggestion, or dismiss it permanently for that completed course
4. Show a congratulatory message (no suggestion) if no eligible courses remain

### Key Dependency: Story 7.1 Momentum Score

Story 7.1 (Momentum Score Calculation) is **backlog/not implemented**. The ACs for 7.3 reference momentum score at 40% weight. This plan implements a **momentum proxy** that is:
- Self-contained within this story (no external dependency)
- Forward-compatible — when 7.1 ships, swap in the real score with no interface change

**Momentum Proxy Formula:**
```
recencyScore  = clamp(1 - daysSinceLastStudy / 14, 0, 1)
progressScore = completedLessons / totalLessons
momentumProxy = (recencyScore × 0.5) + (progressScore × 0.5)
```

---

## 2. File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/suggestions.ts` | Pure algorithm: `computeNextCourseSuggestion()` |
| `src/stores/useSuggestionStore.ts` | Zustand store for dismissal state (localStorage persist) |
| `src/app/components/NextCourseSuggestion.tsx` | Suggestion card + congratulatory empty state |
| `src/app/components/NextCourseSuggestion.test.tsx` | React Testing Library unit tests |
| `src/lib/suggestions.test.ts` | Unit tests for the suggestion algorithm |
| `tests/e2e/story-e07-s03.spec.ts` | Playwright E2E tests |

### Modified Files

| File | Change |
|------|--------|
| `src/app/pages/LessonPlayer.tsx` | Detect course completion → trigger suggestion flow |
| `src/app/components/celebrations/CompletionModal.tsx` | Verify `type='course'` renders correctly (may already exist) |

---

## 3. Algorithm Design (`src/lib/suggestions.ts`)

```typescript
export interface SuggestionCandidate {
  course: Course
  score: number
  tagOverlapCount: number
}

export function computeNextCourseSuggestion(
  completedCourseId: string,
  allCourses: Course[],
  allProgress: Record<string, CourseProgress>
): SuggestionCandidate | null
```

**Logic:**
1. Find the completed course object. Extract its `tags[]`.
2. Build candidate list: filter `allCourses` where:
   - `course.id !== completedCourseId`
   - `getCourseCompletionPercent(course.id, course.totalLessons) < 100`
   - Course has status `'active'` in importedCourses (or just exists in allCourses)
3. For each candidate, compute:
   ```
   tagScore     = (shared tag count / max(completedCourse.tags.length, 1))  [0–1]
   recencyScore = clamp(1 − daysSinceLastStudy / 14, 0, 1)
   progressScore = completedLessons / totalLessons
   momentumProxy = (recencyScore × 0.5) + (progressScore × 0.5)
   finalScore    = (tagScore × 0.6) + (momentumProxy × 0.4)
   ```
4. Sort candidates by `finalScore` descending. Tiebreaker: `tagOverlapCount` descending, then `momentumProxy` descending.
5. Return top candidate or `null` if no candidates.

**Edge Cases:**
- Completed course has 0 tags → `tagScore = 0` for all → ranked purely by `momentumProxy`
- All remaining courses have 0 progress → `progressScore = 0`, recency dominates momentum
- All other courses are 100% complete → return `null` → show congratulations

---

## 4. Dismissal Store (`src/stores/useSuggestionStore.ts`)

```typescript
interface SuggestionState {
  dismissed: Record<string, true>     // key: completedCourseId
  dismiss: (completedCourseId: string) => void
  isDismissed: (completedCourseId: string) => boolean
  reset: () => void                   // for tests
}
```

- Persisted to `localStorage` key `levelup-dismissed-suggestions`
- Uses `zustand/middleware` `persist` (same pattern as other stores in this codebase)
- `dismiss()` is idempotent (calling twice has no extra effect)

---

## 5. LessonPlayer Integration (`src/app/pages/LessonPlayer.tsx`)

**Entry point:** both `handleVideoEnded()` and `toggleComplete()`.

After `markLessonComplete(courseId, lessonId)`:

```typescript
// Check if this was the final lesson in the course
const isLastLesson = currentIndex === allLessons.length - 1
const completionPercent = getCourseCompletionPercent(courseId, allLessons.length)

if (isLastLesson && completionPercent >= 100) {
  setCelebrationType('course')      // triggers CompletionModal with type='course'
  setCelebrationTitle(course.title)
  setCelebrationModal(true)
  setShowCourseSuggestion(true)     // new state flag
}
```

`showCourseSuggestion` state drives the `NextCourseSuggestion` component render after the celebration modal closes.

---

## 6. NextCourseSuggestion Component

```
src/app/components/NextCourseSuggestion.tsx
```

**Props:**
```typescript
interface NextCourseSuggestionProps {
  completedCourseId: string
  onDismiss?: () => void
}
```

**Internal logic:**
1. Call `computeNextCourseSuggestion()` with live progress data
2. If `isDismissed(completedCourseId)` → render nothing (guard)
3. If `null` result → render `CongratulationsMessage` (no more active courses)
4. Otherwise → render suggestion card

**Suggestion Card UI:**
- Course title (h2)
- Description (truncated to 2 lines)
- Category badge (color-coded per existing CategoryBadge pattern)
- Shared tag chips (up to 4, with "+N more" overflow)
- Estimated hours pill
- "Start Course" CTA → `navigate('/courses/${candidate.course.id}')`
- Dismiss button (×) in top-right corner, `aria-label="Dismiss course suggestion"`

**Congratulatory empty state:**
- Trophy / celebration icon
- "You've completed all active courses!"
- "Explore your course library to find your next adventure." + link to Courses page

---

## 7. Test Strategy

### Unit Tests (`src/lib/suggestions.test.ts`)

| Test | Assertion |
|------|-----------|
| Tag overlap scoring | Course with 3/5 shared tags scores higher than course with 1/5 |
| Tiebreaker by momentum | Equal tags → higher momentum proxy wins |
| No-tags fallback | Completed course has 0 tags → 100% momentum weight |
| Excludes completed courses | 100%-complete courses never appear as candidates |
| Excludes self | Completed course never suggests itself |
| Null when no candidates | All others 100% done → returns null |
| Recency decay | 14+ day absence → recencyScore = 0 |

### Unit Tests (`src/app/components/NextCourseSuggestion.test.tsx`)

| Test | Assertion |
|------|-----------|
| Renders suggestion card | Shows course title and "Start Course" |
| Navigate on click | Clicking "Start Course" calls navigate with correct path |
| Dismiss fires store | Clicking × calls `dismiss(completedCourseId)` |
| Renders congrats on null | When algorithm returns null, shows congratulatory message |
| Dismissed guard | When `isDismissed()` is true, renders nothing |

### E2E Tests (`tests/e2e/story-e07-s03.spec.ts`)

| Test | Setup | Assertion |
|------|-------|-----------|
| Suggestion appears after completion | Seed 100% progress for course A; navigate to its last lesson; trigger completion | NextCourseSuggestion card visible |
| Start Course navigates correctly | As above; click "Start Course" | URL changes to `/courses/{suggestedId}` |
| Dismiss hides card | As above; click × | Card disappears |
| Dismiss persists across reload | Dismiss then reload page | Card does not reappear |
| Congrats message when all done | Seed all 8 courses at 100% | Congratulatory message shown, no suggestion card |
| Tag-based ranking | Seed course A (tags: X, Y) done; courses B (X,Y) and C (Z) available | B suggested over C |

**Test setup notes:**
- Seed `localStorage.setItem('knowlune-sidebar-v1', 'false')` to prevent sidebar overlay
- Use `tests/support/factories/` factory helpers for course progress

---

## 8. Implementation Sequence

```
Task 1 → suggestions.ts algorithm (pure, easy to unit-test first)
Task 2 → useSuggestionStore (Zustand, localStorage persist)
Task 5.1 → Unit tests for suggestions.ts (TDD: write tests first)
Task 5.2 → Unit tests for store
Task 3 → LessonPlayer.tsx integration
Task 4 → NextCourseSuggestion.tsx component
Task 5.3–5.6 → E2E tests
```

---

## 9. Out of Scope

- Persisting the suggestion to Dexie (not needed — computed on demand)
- Multiple suggestions / carousel (single best match per AC)
- Suggestions from courses outside the local library
- Real momentum score (deferred to Story 7.1)

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Story 7.1 shipped before 7.3 | Algorithm interface unchanged; swap `momentumProxy` for real score |
| 8-course library is small | Algorithm still correct; may frequently return `null` (all done) — congratulatory UX handles this |
| CompletionModal type='course' may not be styled | Check existing modal variants; add if needed (low effort) |
| Last-lesson detection is fragile if lessons reorder | Use `allLessons.length` and completion percentage, not index alone |
