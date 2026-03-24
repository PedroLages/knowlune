# E18-S05 Implementation Plan: Integrate Quiz Completion with Study Streaks

**Story:** E18-S05
**Date:** 2026-03-23
**Complexity:** Small (2-3 hours)
**Status:** Planning

---

## 1. Problem Statement

Quiz completions don't count toward study streaks. A learner who only takes quizzes on a given day gets no streak credit, breaking motivation continuity.

## 2. Architecture Analysis

### Current Streak System (NOT what the epic describes)

The epic references `useStreakStore` (Zustand) and a `streaks` Dexie table — **neither exists**. The actual architecture:

| Component | Location | Mechanism |
|-----------|----------|-----------|
| Study action logging | `src/lib/studyLog.ts:logStudyAction()` | Appends to localStorage `study-log` key |
| Streak calculation | `src/lib/studyLog.ts:studyDaysFromLog()` | Filters log for `lesson_complete` type, dedupes by date |
| Streak snapshot | `src/lib/studyLog.ts:getStreakSnapshot()` | Parse-once pattern: reads log, computes current/longest/activity |
| Calendar reactivity | `CustomEvent('study-log-updated')` | Components listen and re-read snapshot |
| Calendar UI | `src/app/components/StudyStreakCalendar.tsx` | Subscribes to `study-log-updated` event |

### Current Quiz Submission Flow

`src/stores/useQuizStore.ts:submitQuiz()` (lines 123-189):
1. Calculate score → create `QuizAttempt`
2. `persistWithRetry(() => db.quizAttempts.add(attempt))` — Dexie write
3. If passed: `useContentProgressStore.setItemStatus()` (isolated try/catch — non-blocking)
4. Update Zustand state
5. Clean up localStorage backup

### Cross-Store Pattern (Precedent)

`submitQuiz` already follows the exact pattern we need (lines 155-164):
```typescript
if (result.passed) {
  try {
    await useContentProgressStore.getState().setItemStatus(...)
  } catch (err) {
    console.error('[useQuizStore] setItemStatus failed after quiz submit:', err)
  }
}
```

Key characteristics:
- Isolated in its own try/catch
- Failure does NOT roll back the quiz attempt
- Error is logged, not shown to user
- Tests verify this isolation (`useQuizStore.crossStore.test.ts`)

## 3. Implementation Strategy

### Approach: Extend StudyAction type + fire-and-forget logStudyAction

**Why this approach (not what the epic suggests):**
- The epic suggests `useStreakStore.getState().recordActivity()` — but no such store exists
- Creating a Zustand store just for this would be over-engineering when `logStudyAction()` already works
- `logStudyAction()` is the established pattern (used by `progress.ts` for lesson_complete, video_progress, etc.)
- The `study-log-updated` CustomEvent already triggers calendar/widget refreshes
- Idempotency is already handled by `studyDaysFromLog()` which deduplicates by date

### Changes Required

#### File 1: `src/lib/studyLog.ts`

**Change A:** Extend `StudyAction.type` union
```typescript
// Before:
type: 'lesson_complete' | 'video_progress' | 'note_saved' | 'course_started' | 'pdf_progress'

// After:
type: 'lesson_complete' | 'video_progress' | 'note_saved' | 'course_started' | 'pdf_progress' | 'quiz_complete'
```

**Change B:** Update `studyDaysFromLog()` to count quiz completions
```typescript
// Before (line 210):
if (a.type === 'lesson_complete') {

// After:
if (a.type === 'lesson_complete' || a.type === 'quiz_complete') {
```

**Change C:** Update `activityFromLog()` to count quiz completions
```typescript
// Before (line 314):
if (a.type === 'lesson_complete') {

// After:
if (a.type === 'lesson_complete' || a.type === 'quiz_complete') {
```

**Rationale for counting quiz_complete separately from lesson_complete:**
- Semantic clarity — quiz and lesson are different activities
- Future analytics can distinguish quiz vs lesson activity
- No risk of double-counting: `studyDaysFromLog()` uses a Set (dedupes by date)

#### File 2: `src/stores/useQuizStore.ts`

**Change:** Add streak recording after successful quiz persistence

```typescript
// After the existing setItemStatus block (line ~165), add:
// Trigger study streak update (QFR55)
// Fire-and-forget: streak failure must not block quiz submission
try {
  logStudyAction({
    type: 'quiz_complete',
    courseId,
    lessonId: currentQuiz.lessonId,
    timestamp: new Date().toISOString(),
    metadata: { quizId: currentQuiz.id, score: result.percentage, passed: result.passed },
  })
} catch (streakError) {
  console.error('[useQuizStore] streak recording failed (non-blocking):', streakError)
}
```

**Placement:** After the Dexie write succeeds but before clearing `currentProgress`. This mirrors the existing `setItemStatus` pattern.

**Important:** This runs for ALL quiz submissions (pass or fail) — the AC says "complete a quiz", not "pass a quiz". Studying (even failing) should count as daily activity.

## 4. Files Modified

| File | Change | Lines |
|------|--------|-------|
| `src/lib/studyLog.ts` | Add `quiz_complete` type, update 2 filter functions | ~6 lines changed |
| `src/stores/useQuizStore.ts` | Add `logStudyAction` import + call in `submitQuiz` | ~12 lines added |

## 5. Test Plan

### Unit Tests

#### 5a. `src/lib/__tests__/studyLog.test.ts` (extend existing)

| Test | AC | What it verifies |
|------|----|-----------------|
| `quiz_complete action is stored and retrievable` | AC1 | `logStudyAction({ type: 'quiz_complete', ... })` persists to log |
| `quiz_complete counts toward current streak` | AC1 | `getCurrentStreak()` returns 1 after a quiz_complete on today |
| `quiz_complete shows as activity in calendar` | AC3 | `getStudyActivity()` returns `hasActivity: true` for quiz-only day |
| `getStreakSnapshot includes quiz_complete` | AC3 | `getStreakSnapshot().currentStreak` reflects quiz completion |
| `multiple quiz_complete same day = one streak day` | AC2 | Two quiz_complete same date → `getCurrentStreak()` === 1, not 2 |
| `quiz_complete + lesson_complete same day = one streak day` | AC2 | Mixed activity → streak incremented once |

#### 5b. `src/stores/__tests__/useQuizStore.streakIntegration.test.ts` (new file)

Follow the `useQuizStore.crossStore.test.ts` pattern:

| Test | AC | What it verifies |
|------|----|-----------------|
| `submitQuiz calls logStudyAction after successful persist` | AC1 | `logStudyAction` called with `type: 'quiz_complete'` |
| `submitQuiz calls logStudyAction for failed quiz too` | AC1 | Even failing quizzes trigger streak update |
| `streak recording failure does not prevent quiz submission` | AC4 | Mock `logStudyAction` to throw → quiz attempt still saved |
| `streak recording failure is logged` | AC4 | `console.error` called with appropriate message |
| `quiz attempt preserved when logStudyAction throws` | AC4 | Dexie still has attempt, store state is correct |

#### 5c. Integration test considerations

The idempotency guarantee comes from `studyDaysFromLog()` using `Set<string>` for dates — already tested. No new integration tests needed beyond the unit tests above.

### E2E Test

#### `tests/e2e/quiz-streak-integration.spec.ts` (new file)

**Scenario:** Complete quiz → streak calendar shows today active

Steps:
1. Seed IndexedDB with a quiz (use existing seeding patterns)
2. Seed localStorage with a study-log showing a streak ending yesterday
3. Navigate to quiz page, answer questions, submit
4. Navigate to Overview page
5. Assert: streak counter shows expected value
6. Assert: today's cell in streak calendar has activity styling

**Note:** No existing quiz E2E tests exist in the repo. This would be the first. If E2E is deemed too complex for this story's scope, the unit tests provide sufficient AC coverage.

## 6. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| localStorage full when logging quiz_complete | Low | `logStudyAction` already caps at 1000 entries; quiz adds minimal entries |
| Double-counting breaks streak number | None | `studyDaysFromLog()` uses Set — inherently idempotent per date |
| `logStudyAction` throws and blocks quiz submission | None by design | Isolated try/catch, matching existing `setItemStatus` pattern |
| Calendar doesn't refresh after quiz submit | Low | `logStudyAction` dispatches `study-log-updated` CustomEvent; all streak widgets listen for it |

## 7. Implementation Order

1. **studyLog.ts changes** (type + filters) — enables quiz_complete to count
2. **studyLog unit tests** — verify streak counting works with new type
3. **useQuizStore.ts change** — wire up the integration
4. **useQuizStore streak tests** — verify cross-module isolation
5. **E2E test** (if in scope) — end-to-end verification

## 8. What This Plan Does NOT Do

- Does NOT create `useStreakStore` (the epic's suggestion doesn't match reality)
- Does NOT create a `streaks` Dexie table (streaks are localStorage-based)
- Does NOT modify UI components (streak calendar already reacts to `study-log-updated`)
- Does NOT change streak calculation logic (just expands which actions count)
