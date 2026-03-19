# E12-S06 Adversarial Review Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 issues found in the adversarial review of the quiz scoring feature (3 blockers, 2 high, 3 medium).

**Architecture:** Targeted fixes across Quiz.tsx, QuizResults.tsx, ScoreSummary.tsx, and useQuizStore.ts. No new files. No schema changes.

**Tech Stack:** React 19, Zustand, React Router v7, Tailwind CSS v4, shadcn/ui

---

### Task 1: Fix "Back to Lesson" link (Blocker #9)

**Files:**
- Modify: `src/app/pages/QuizResults.tsx:102`

**Fix:** Add missing `/lessons/` segment to the link path.

```tsx
// Before
to={`/courses/${courseId}/${lessonId}`}
// After
to={`/courses/${courseId}/lessons/${lessonId}`}
```

---

### Task 2: Fix empty modules array in submitQuiz (Blocker #1)

**Files:**
- Modify: `src/stores/useQuizStore.ts` (submitQuiz signature + body)
- Modify: `src/app/pages/Quiz.tsx` (handleSubmitConfirm)

**Problem:** `submitQuiz(courseId, [])` passes empty modules — `setItemStatus` cascade finds nothing.

**Fix:** Remove `modules` param from `submitQuiz`. Fetch modules from Dexie inside the store action so the caller doesn't need them.

```ts
// useQuizStore.ts — submitQuiz becomes:
submitQuiz: async (courseId: string) => {
  // ... existing scoring logic unchanged ...

  if (result.passed) {
    try {
      const course = await db.courses.get(courseId)
      const modules = course?.modules ?? []
      await useContentProgressStore
        .getState()
        .setItemStatus(courseId, currentQuiz.lessonId, 'completed', modules)
    } catch (err) {
      console.error('[useQuizStore] setItemStatus failed:', err)
    }
  }
}
```

```tsx
// Quiz.tsx — handleSubmitConfirm:
await submitQuiz(courseId)  // remove second arg
```

---

### Task 3: Fix QuizResults cold-load redirect (Blocker #8 + #2)

**Files:**
- Modify: `src/app/pages/QuizResults.tsx:49-54`

**Problem:** On cold load, `isLoading` starts `false` and `currentQuiz` is `null`, triggering immediate redirect before data loads.

**Fix:** Replace render-body `navigate()` with `<Navigate>` component, and add a guard that waits for hydration.

```tsx
// Add useState for hydration check
const [hydrated, setHydrated] = useState(false)

useEffect(() => {
  setHydrated(true)
}, [])

// Replace the navigate() call with:
if (!hydrated || isLoading) {
  return <LoadingSkeleton />
}

if (!currentQuiz && !lastAttempt) {
  return <Navigate to={`/courses/${courseId}/lessons/${lessonId}/quiz`} replace />
}
```

---

### Task 4: Add submission loading state (High #12)

**Files:**
- Modify: `src/app/pages/Quiz.tsx` (Submit Quiz button + handleSubmitConfirm)

**Fix:** Read `isStoreLoading` (already subscribed) and disable submit button + show loading text during submission.

```tsx
<Button
  className="bg-brand text-brand-foreground rounded-xl min-h-[44px]"
  onClick={handleSubmitClick}
  disabled={isStoreLoading}
>
  {isStoreLoading ? 'Submitting...' : 'Submit Quiz'}
</Button>
```

Also disable "Submit Anyway" in the AlertDialog.

---

### Task 5: Move question navigation into store actions (High #6)

**Files:**
- Modify: `src/stores/useQuizStore.ts` (add `goToNextQuestion`, `goToPrevQuestion` actions)
- Modify: `src/app/pages/Quiz.tsx` (replace inline setState calls)

**Fix:** Add proper Zustand actions:

```ts
// useQuizStore.ts
goToNextQuestion: () => {
  const { currentProgress, currentQuiz } = get()
  if (!currentProgress || !currentQuiz) return
  if (currentProgress.currentQuestionIndex >= currentQuiz.questions.length - 1) return
  set({
    currentProgress: {
      ...currentProgress,
      currentQuestionIndex: currentProgress.currentQuestionIndex + 1,
    },
  })
},

goToPrevQuestion: () => {
  const { currentProgress } = get()
  if (!currentProgress || currentProgress.currentQuestionIndex <= 0) return
  set({
    currentProgress: {
      ...currentProgress,
      currentQuestionIndex: currentProgress.currentQuestionIndex - 1,
    },
  })
},
```

```tsx
// Quiz.tsx — replace handlePrevQuestion/handleNextQuestion:
const goToPrevQuestion = useQuizStore(s => s.goToPrevQuestion)
const goToNextQuestion = useQuizStore(s => s.goToNextQuestion)
```

---

### Task 6: Deduplicate unansweredCount logic (Medium #7)

**Files:**
- Modify: `src/app/pages/Quiz.tsx`

**Fix:** Extract a single helper, use it in both `handleSubmitClick` and the render body.

```ts
function countUnanswered(quiz: QuizType, progress: QuizProgress): number {
  return quiz.questions.filter(q => {
    const a = progress.answers[q.id]
    return a === undefined || a === ''
  }).length
}
```

---

### Task 7: Fix ScoreRing text overflow on mobile (Medium #13)

**Files:**
- Modify: `src/app/components/quiz/ScoreSummary.tsx`

**Fix:** Use responsive text size instead of fixed `text-5xl`.

```tsx
// Before
<span className="absolute text-5xl font-bold text-foreground">
// After
<span className="absolute text-3xl sm:text-5xl font-bold text-foreground">
```

---

### Verification

```bash
npm run build
npm run lint
npm run test:unit
```
