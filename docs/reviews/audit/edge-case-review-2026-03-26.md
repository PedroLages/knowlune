## Edge Case Review — Full App Audit (2026-03-26)

Audited all files in `src/app/pages/` (excluding `__tests__/` and `prototypes/`) and `src/app/components/figma/`.

---

### Unhandled Edge Cases

**[src/app/pages/Overview.tsx:69]** — `getAllProgress()` called with empty dependency array `[]` in useMemo
> Consequence: Progress data is computed once on mount and never updates. If a user completes a lesson and navigates back to Overview without a full remount (e.g., via back button with cached component), stale progress is displayed for all metrics (courses started, lessons completed, completion percentages).
> Guard: `const allProgress = useMemo(() => getAllProgress(), [allCourses])`
> Severity: MEDIUM

**[src/app/pages/Overview.tsx:355]** — `getCourseCompletionPercent(course.id, course.totalLessons)` with `totalLessons = 0`
> Consequence: If a course has zero lessons (malformed data), division by zero inside `getCourseCompletionPercent` could produce `NaN` or `Infinity`, causing the ProgressRing and Progress components to render incorrectly.
> Guard: `getCourseCompletionPercent` should return 0 when `totalLessons <= 0`
> Severity: LOW

**[src/app/pages/Flashcards.tsx:357]** — `reviewQueue.length > 0 ? Math.round((reviewIndex / reviewQueue.length) * 100) : 0`
> Consequence: When `reviewQueue.length` is 0 (empty queue reached during reviewing phase), the progress calculation is guarded, but the component renders `null` at line 486 as a fallback. The `currentCard` at line 224 would be `undefined`, and `courseNameMap.get(undefined)` returns `undefined` — the `?? 'Unknown Course'` fallback handles this. No crash, but the null render is a dead-end UX with no recovery path.
> Guard: Redirect to dashboard phase when queue is empty: `if (phase === 'reviewing' && !currentCard) { setPhase('dashboard'); return null; }`
> Severity: LOW

**[src/app/pages/Flashcards.tsx:37]** — `formatNextReviewDate` returns "Tomorrow" when review date is today after midnight
> Consequence: When `date < tomorrow` evaluates true for a review date that is later today (not past midnight), it incorrectly shows "Tomorrow" instead of "Today". The comparison checks if `date < tomorrow` but `tomorrow` is set to midnight of the next day, so any time today would be before tomorrow — this is actually correct. However, `diff` on line 38 uses `date.getTime() - today.getTime()` where `today` has time zeroed but `date` does not, so `diff` could be 0 for reviews due today, causing "In 0 days" to display.
> Guard: Add explicit "Today" case: `if (diff <= 0) return 'Today'`
> Severity: LOW

**[src/app/pages/CourseOverview.tsx:93-97]** — `course.authorId.split('-')` when `authorId` is empty string
> Consequence: If `course.authorId` is an empty string (no author assigned), `split('-')` returns `['']`, and `w[0]?.toUpperCase()` returns `undefined.toUpperCase()` — but the optional chaining `?` prevents a crash. The display would show an empty string for the author initials and name, which is a cosmetic issue but not a crash.
> Guard: Check `course.authorId` before the split fallback logic
> Severity: LOW

**[src/app/pages/LessonPlayer.tsx:230]** — `setActiveTab(pdfResources.length > 0 ? 'materials' : 'notes')` uses `pdfResources` before it's defined
> Consequence: `pdfResources` is derived from `lesson?.resources` at line 338-341, but the `useEffect` on line 228 that references it fires on `[courseId, lessonId]` changes. Since `pdfResources` is computed from `lesson` which depends on `course` and `lessonId`, this creates a stale closure where `pdfResources` references values from the previous render. On initial mount this is fine, but on lesson navigation the tab could be set incorrectly for one render cycle.
> Guard: Move `pdfResources` computation before the `useEffect` or include it in the dependency array
> Severity: LOW

**[src/app/pages/LessonPlayer.tsx:399]** — `getCourseCompletionPercent(courseId, allLessons.length) >= 100` after marking lesson complete
> Consequence: `markLessonComplete` writes to localStorage synchronously, then immediately calls `getCourseCompletionPercent` which reads from the same localStorage. This is correct. However, `allLessons.length` counts all lessons in the course, but `getCourseCompletionPercent` reads `completedLessons` from `getProgress()`. If a course has 0 lessons due to malformed data, this results in division by zero.
> Guard: Add `allLessons.length > 0` guard before the percentage check
> Severity: LOW

**[src/app/pages/QuizReview.tsx:79]** — `db.quizAttempts.get(attemptId!)` with non-null assertion
> Consequence: If the route is accessed without an `attemptId` param (e.g., manually typed URL `/quiz/review/`), `attemptId` is `undefined`, and `get(undefined!)` will query Dexie with `undefined` as the key. Dexie's `get(undefined)` returns `undefined` (no crash), which triggers the error state. The user sees "Quiz attempt not found" which is acceptable, but the non-null assertion hides the undefined param case.
> Guard: Add early return if `!attemptId` before the Dexie query
> Severity: LOW

**[src/app/pages/CareerPathDetail.tsx:266-268]** — `navigate('/career-paths', { replace: true })` during render via useEffect
> Consequence: If `isLoaded` becomes true and `path` is undefined (invalid pathId in URL), the component navigates away. However, the component continues rendering below with `!path` at line 314, showing the skeleton. The redirect fires asynchronously from useEffect, so for one frame the user sees the skeleton, then immediately redirects. This is benign but could flash content.
> Guard: Return early before the main render when `isLoaded && !path`
> Severity: LOW

**[src/app/pages/SessionHistory.tsx:88]** — `(await db.studySessions.toArray()) as DisplaySession[]`
> Consequence: The type assertion assumes all sessions have the `DisplaySession` shape, but the actual records from Dexie may be missing optional fields (`courseTitle`, `contentSummary`, `contentItems`). This is safe because the enrichment logic at line 109-117 handles missing fields with `||` fallbacks. No actual edge case, but the assertion masks potential type drift.
> Guard: N/A (cosmetic type concern)
> Severity: LOW

**[src/app/pages/InterleavedReview.tsx:333-334]** — `interleavedQueue[interleavedIndex]` when queue could be empty after data reloads
> Consequence: If the interleaved session is active but the queue becomes empty (e.g., all reviews were processed between renders), `currentRecord` is `undefined` and `currentNote` is `undefined`. The rendering at line 394 `{currentRecord && currentNote && ...}` guards against this, but the progress display at line 339 shows `1 / 0` and `progressPct` becomes `NaN` (since `0/0 * 100 = NaN`), which would cause the `<Progress>` component to receive `NaN`.
> Guard: `const progressPct = total > 0 ? (interleavedIndex / total) * 100 : 0` — already guarded. But `current = interleavedIndex + 1` would show `1 / 0` in the UI text. Add: `if (!currentRecord) return null` before the JSX.
> Severity: MEDIUM

**[src/app/pages/YouTubeLessonPlayer.tsx:317]** — `courseId!` and `lessonId!` non-null assertions passed to YouTubePlayer
> Consequence: If the route is accessed with missing params (e.g., `/youtube-courses//lessons/`), `courseId` and `lessonId` are empty strings (not undefined, since useParams returns `string | undefined` but the route pattern ensures they exist). The non-null assertions are technically safe for the route structure but could pass empty strings to the player, causing silent failures in progress tracking.
> Guard: Add early validation: `if (!courseId || !lessonId)` return error state
> Severity: LOW

**[src/app/pages/YouTubeCourseDetail.tsx:183]** — `Math.round((completedCount / videos.length) * 100)` when `videos.length = 0`
> Consequence: Division by zero produces `NaN`, which is then passed to the `<Progress>` component. The guard `videos.length > 0 ? ... : 0` is present, so this is already handled correctly.
> Guard: Already guarded at line 183.
> Severity: N/A (false positive — already handled)

**[src/app/pages/Challenges.tsx:53-57]** — `challenge.targetValue > 0` guard for division, but `currentProgress` could be negative
> Consequence: If `challenge.currentProgress` is negative (data corruption), `progressPercent` becomes negative. `Math.min(100, negativeValue)` would pass the negative value through. The `<Progress>` component may not handle negative values gracefully (visual underflow).
> Guard: `Math.min(100, Math.max(0, challenge.targetValue > 0 ? Math.round(...) : 0))`
> Severity: LOW

**[src/app/pages/Notes.tsx:105]** — `(location.state as { fromNote?: string } | null)?.fromNote` type assertion on location state
> Consequence: If `location.state` is not an object (e.g., a string or number from an external navigation), the type assertion could cause a runtime error when accessing `.fromNote`. React Router can receive arbitrary state shapes.
> Guard: Use defensive access: `typeof location.state === 'object' && location.state !== null ? (location.state as Record<string, unknown>).fromNote : null`
> Severity: LOW

**[src/app/pages/Reports.tsx:137]** — `new Date(item.date + 'T12:00:00')` for date parsing
> Consequence: If `item.date` is an invalid date string (e.g., empty string or malformed), `new Date('T12:00:00')` produces an Invalid Date. `format(invalidDate, ...)` from date-fns would throw an error, crashing the Reports page.
> Guard: Validate date before formatting: `if (isNaN(new Date(item.date + 'T12:00:00').getTime())) return { ...item, date: 'Invalid', activities: 0, fullDate: '' }`
> Severity: MEDIUM

**[src/app/pages/MyClass.tsx:60-62]** — Sort by `new Date(a.lastAccessedAt).getTime()` when `lastAccessedAt` might be an invalid date string
> Consequence: If `lastAccessedAt` is an empty string or malformed ISO date, `new Date('')` produces Invalid Date, and `getTime()` returns `NaN`. Comparing `NaN` values in sort produces undefined ordering behavior, potentially shuffling the course list unpredictably.
> Guard: Fallback to 0 for invalid dates: `const aTime = 'lastAccessedAt' in a ? (new Date(a.lastAccessedAt).getTime() || 0) : 0`
> Severity: LOW

**[src/app/pages/LearningPathDetail.tsx:875]** — `pathId={pathId!}` non-null assertion in CoursePickerDialog
> Consequence: If the URL has no `pathId` param, `pathId` is `undefined`, and the `!` assertion passes it as-is to `addCourseToPath`, which would attempt to add a course to an undefined path. The "Path not found" guard at line 662 should catch this case before rendering, but if React batching causes a render before the guard fires, the dialog could attempt operations on a non-existent path.
> Guard: The guard at line 662 returns early when `!path`, which prevents the dialog from rendering. Safe in practice.
> Severity: LOW

**[src/app/components/figma/ProgressRing.tsx:16]** — `circumference - (percent / 100) * circumference` when `percent` is negative or > 100
> Consequence: If `percent` is negative, the stroke offset exceeds the circumference, causing visual artifacts (ring wraps beyond full circle). If `percent` > 100, the offset becomes negative, causing the ring to overflow. The text display `{percent}%` would show values like `-5%` or `150%`.
> Guard: Clamp percent: `const clamped = Math.max(0, Math.min(100, percent))`
> Severity: LOW

**[src/app/components/figma/CourseCard.tsx:48-49]** — `diffInSeconds` calculation with future dates
> Consequence: If `isoDate` is a future date (e.g., from clock skew or corrupted data), `diffInSeconds` is negative. The function returns "just now" for negative values (since `-X < 60` is true), which is misleading but not a crash.
> Guard: Add `if (diffInSeconds < 0) return 'just now'` explicitly as first check
> Severity: LOW

**[src/app/pages/ImportedCourseDetail.tsx:138-146]** — `handleDelete` reads `importError` from store state after `await removeImportedCourse`
> Consequence: Reading `useCourseImportStore.getState().importError` immediately after the async call is a race condition if another store operation modifies `importError` concurrently. In practice, this is unlikely since only one delete can be in-flight (guarded by `deleting` flag), but the pattern is fragile.
> Guard: Have `removeImportedCourse` return success/failure directly instead of reading store state
> Severity: LOW

**[src/app/pages/Settings.tsx:234]** — `getCounterColor` divides `count / limit` where `limit` could theoretically be 0
> Consequence: `DISPLAY_NAME_LIMIT` and `BIO_LIMIT` are constants (50 and 200), so division by zero is impossible in practice. No actual edge case.
> Guard: N/A (constants are always > 0)
> Severity: N/A (false positive)

**[src/app/pages/KnowledgeGaps.tsx:147]** — `detectGaps` called without checking if AbortController signal was already aborted
> Consequence: If the user rapidly clicks "Analyze" button, the previous controller is aborted and a new one created. The `detectGaps` function receives the new controller's signal. If the component unmounts during analysis, the cleanup at line 131 aborts the controller. This is correctly handled — the `controller.signal.aborted` check at line 148 prevents stale state updates.
> Guard: Already handled correctly.
> Severity: N/A (false positive)

---

### Summary by Severity

| Severity | Count |
|----------|-------|
| BLOCKER  | 0     |
| HIGH     | 0     |
| MEDIUM   | 3     |
| LOW      | 14    |

---

**Total:** 17 unhandled edge cases found (3 MEDIUM, 14 LOW).

### Key Patterns Observed

1. **Division by zero in progress calculations** — Multiple locations compute percentages from `completed / total` without guarding `total = 0`. Most are protected by upstream data guarantees (courses always have lessons), but malformed or corrupted data could trigger NaN.

2. **Stale memoization dependencies** — `useMemo` with `[]` dependencies that should react to data changes (Overview.tsx line 69). Progress data is computed once and never refreshed within the same mount.

3. **Non-null assertions on route params** — Several pages use `paramId!` without validating the param exists. Route structure prevents undefined in normal navigation, but direct URL manipulation or deep-linking could produce empty strings.

4. **Date parsing without validation** — Several components parse ISO date strings with `new Date()` without checking for Invalid Date. Corrupted or empty date strings produce NaN timestamps that propagate through calculations.

5. **localStorage/sessionStorage access** — Well-handled throughout. The codebase consistently wraps storage access in try/catch with `silent-catch-ok` comments. No unguarded storage access found.

6. **Async race conditions** — Well-handled with `let ignore = false` pattern and AbortController usage. No significant race conditions found.

7. **Empty array/object handling** — Generally well-handled with empty state components. Most pages check for zero-length arrays before rendering lists.
