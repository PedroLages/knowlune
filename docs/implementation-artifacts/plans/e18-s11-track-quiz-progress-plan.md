# E18-S11: Track Quiz Progress in Content Completion — Implementation Plan

**Created:** 2026-03-23
**Story:** As a learner, I want quiz completion to mark the associated lesson as complete, so that my content progress accurately reflects quiz-based learning activities.
**Complexity:** Small (2-3 hours)
**FR:** QFR60

---

## Executive Summary

The core cross-store integration is **already implemented** in `useQuizStore.ts:152-165` (shipped as part of E12-S03-AC5). This story validates completeness against the E18-S11 acceptance criteria and fills remaining test gaps — primarily E2E coverage and a retake-specific unit test.

---

## Current State Analysis

### What Already Exists

| AC | Requirement | Implementation | Unit Tests | E2E Tests |
|----|-------------|---------------|------------|-----------|
| AC1 | Pass quiz → mark lesson complete | `useQuizStore.ts:155-164` | `crossStore.test.ts:105-125` | **Missing** |
| AC2 | Fail quiz → no completion | `useQuizStore.ts:155` (guard) | `crossStore.test.ts:127-146` | **Missing** |
| AC3 | Retake + pass → mark complete | Implicit (same code path) | **Missing** (explicit retake test) | **Missing** |
| AC4 | Progress failure → quiz saved | `useQuizStore.ts:162-164` (isolated try/catch) | `crossStore.test.ts:148-194` | N/A |

### Key Code References

- **Cross-store integration:** `src/stores/useQuizStore.ts:152-165`
  ```typescript
  if (result.passed) {
    try {
      const course = await db.courses.get(courseId)
      const modules = course?.modules ?? []
      await useContentProgressStore
        .getState()
        .setItemStatus(courseId, currentQuiz.lessonId, 'completed', modules)
    } catch (err) {
      console.error('[useQuizStore] setItemStatus failed after quiz submit:', err)
    }
  }
  ```
- **Content progress store:** `src/stores/useContentProgressStore.ts` — `setItemStatus()` persists to IndexedDB `contentProgress` table with module status cascading
- **UI progress display:** `src/app/components/figma/ModuleAccordion.tsx:40-41` reads `statusMap` and shows completion badges
- **Course detail progress:** `src/app/pages/CourseDetail.tsx:153` shows "X of Y lessons completed"

### Existing Test Infrastructure

- **Unit tests:** `src/stores/__tests__/useQuizStore.crossStore.test.ts` — 3 tests covering pass/fail/error scenarios
- **Quiz factory:** `tests/support/fixtures/factories/quiz-factory.ts` — `makeQuiz()`, `makeQuestion()`, `makeAttempt()`, `makeProgress()`
- **Content progress factory:** `tests/support/fixtures/factories/content-progress-factory.ts` — `createContentProgress()`
- **E2E seeding:** `seedQuizzes()`, `seedIndexedDBStore()` in `tests/support/helpers/seed-helpers.ts`
- **E2E quiz flow patterns:** `tests/e2e/regression/story-e12-s04.spec.ts` (start quiz), `story-e13-s01.spec.ts` (navigation + submit)

---

## Implementation Plan

### Phase 1: Validate Existing Implementation (No Code Changes)

**Goal:** Confirm the existing code satisfies all four ACs.

1. **Read and verify `useQuizStore.ts:submitQuiz()`** against each AC:
   - AC1: `result.passed` guard + `setItemStatus(courseId, lessonId, 'completed', modules)` call ✅
   - AC2: The `if (result.passed)` guard prevents `setItemStatus` call on failure ✅
   - AC3: `setItemStatus` with `'completed'` is idempotent (IndexedDB `put` overwrites) ✅
   - AC4: Inner try/catch isolates progress failure from quiz attempt persistence ✅

2. **Verify the `setItemStatus` signature matches** — the epics.md spec shows `setItemStatus(lessonId, 'completed')` but the actual implementation uses `setItemStatus(courseId, lessonId, 'completed', modules)` which is correct (the spec was simplified)

**Outcome:** No production code changes needed.

### Phase 2: Add Retake-Specific Unit Test (AC3)

**File:** `src/stores/__tests__/useQuizStore.crossStore.test.ts`

Add one new test case to the existing describe block:

```typescript
it('calls setItemStatus when retake achieves passing score (AC3)', async () => {
  await seedAndStartPassingQuiz()

  const setItemStatusSpy = vi
    .spyOn(useContentProgressStore.getState(), 'setItemStatus')
    .mockResolvedValue(undefined)

  // First attempt: fail
  await act(async () => {
    useQuizStore.getState().submitAnswer('q1', 'London')
  })
  await act(async () => {
    await useQuizStore.getState().submitQuiz(COURSE_ID)
  })
  expect(setItemStatusSpy).not.toHaveBeenCalled()

  // Retake: pass
  await act(async () => {
    await useQuizStore.getState().retakeQuiz(LESSON_ID)
  })
  await act(async () => {
    useQuizStore.getState().submitAnswer('q1', 'Paris')
  })
  await act(async () => {
    await useQuizStore.getState().submitQuiz(COURSE_ID)
  })

  expect(setItemStatusSpy).toHaveBeenCalledOnce()
  expect(setItemStatusSpy).toHaveBeenCalledWith(COURSE_ID, LESSON_ID, 'completed', testModules)

  setItemStatusSpy.mockRestore()
})
```

**Why this test matters:** While AC3 is technically handled by the same code path as AC1, explicitly testing the retake→pass flow proves the `retakeQuiz()` + `submitQuiz()` sequence correctly triggers content completion. This catches regressions where `retakeQuiz()` might reset state differently.

### Phase 3: Add E2E Test

**File:** `tests/e2e/regression/story-e18-s11.spec.ts`

This is the most valuable addition. The E2E test verifies the full integration from user action to UI reflection.

**Test structure:**

```
E18-S11: Track Quiz Progress in Content Completion
├── AC1: Pass quiz → lesson shows completed in course view
│   - Seed course with modules/lessons + quiz
│   - Navigate to quiz, start, answer correctly, submit
│   - Navigate to course detail page
│   - Assert lesson shows "completed" status indicator
│
├── AC2: Fail quiz → lesson NOT completed
│   - Seed course with modules/lessons + quiz
│   - Navigate to quiz, start, answer incorrectly, submit
│   - Navigate to course detail page
│   - Assert lesson shows "not-started" status
│
└── (AC3 + AC4 covered by unit tests — no E2E needed)
```

**Seeding strategy:**
- Need to seed both the `courses` store (for `db.courses.get(courseId)` in submitQuiz) AND the `quizzes` store
- Use `seedIndexedDBStore()` for both stores
- The `courses` store is the existing Dexie `courses` table with `modules` array containing lessons

**Key considerations:**
- Must seed a course with `modules[].lessons[]` structure matching the quiz's `lessonId`
- After quiz submission, navigate to course detail and check `ModuleAccordion` for completion badge
- The `contentProgress` table receives the status via `setItemStatus()` — the UI reads from `useContentProgressStore.statusMap`
- May need a page reload or wait for IndexedDB write to propagate to UI

### Phase 4: Verify Error Logging (AC4)

AC4 is fully covered by the existing unit test `crossStore.test.ts:148-194` which:
- Mocks `setItemStatus` to throw
- Verifies quiz attempt is still saved to IndexedDB
- Verifies `console.error` is called with the expected message

No additional work needed.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/stores/__tests__/useQuizStore.crossStore.test.ts` | **Modify** | Add retake-specific test (AC3) |
| `tests/e2e/regression/story-e18-s11.spec.ts` | **Create** | E2E tests for AC1, AC2 |
| `src/stores/useQuizStore.ts` | **No changes** | Already implemented |
| `src/stores/useContentProgressStore.ts` | **No changes** | Already implemented |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| E2E test flakiness from IDB timing | Medium | Use `seedIndexedDBStore` with retry pattern; wait for UI indicators |
| Course seeding complexity (modules structure) | Low | Reuse patterns from `story-e04-s01.spec.ts` |
| Retake test state leakage | Low | `beforeEach` already resets Dexie + localStorage |

---

## Definition of Done

- [ ] Existing implementation verified against all 4 ACs (no production code changes needed)
- [ ] Retake-specific unit test added and passing (`npm run test:unit`)
- [ ] E2E test for AC1 (pass → completed) added and passing
- [ ] E2E test for AC2 (fail → not completed) added and passing
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Story file updated with implementation notes and lessons learned
