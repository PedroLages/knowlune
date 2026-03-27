# Full App Audit: Page Components Code Review

**Date:** 2026-03-26
**Scope:** All 32 `.tsx` files in `src/app/pages/` (excluding `__tests__/` and `prototypes/`)
**Reviewer:** Adversarial Code Review Agent (Opus 4.6)

---

## What Works Well

1. **Consistent async cleanup patterns.** Nearly every page with async effects uses the `let ignore = false` / `return () => { ignore = true }` pattern to prevent state updates after unmount. This is disciplined and prevents a whole class of React memory leak warnings.

2. **Accessibility baseline is solid.** Most pages include `aria-label` on search inputs, `aria-busy`/`aria-label` on loading skeletons, `aria-hidden="true"` on decorative icons, `role="button"` with keyboard handlers, and semantic heading hierarchy. The LessonPlayer focus management (`titleRef.current?.focus({ preventScroll: true })`) is a notably thoughtful touch.

3. **Error states are not ignored.** Pages like `ImportedCourseDetail`, `SessionHistory`, and `YouTubeCourseDetail` have explicit error UI with retry actions, and silent catches are annotated with `// silent-catch-ok` explaining why. This is well above average for a client-side app.

---

## Findings

### Blockers

_(None found)_

### High Priority

- **[Recurring] `ImportedLessonPlayer.tsx:42`, `YouTubeLessonPlayer.tsx:89` (confidence: 90)**: Fire-and-forget `db.importedVideos.get(lessonId).then(...)` without `.catch()`. If IndexedDB throws (quota exceeded, database closed, corrupted record), the promise rejection is unhandled and the component silently stays in loading state forever. The user sees an infinite spinner with no way to recover. **Why:** Learner gets stuck on a loading screen with no error feedback. **Fix:** Add `.catch(err => { if (!ignore) setVideo(null); console.error('[LessonPlayer] DB read failed:', err) })`.

- **[Recurring] `LessonPlayer.tsx:245` (confidence: 88)**: `getLessonBookmarks(courseId, lessonId).then(setBookmarks)` has no `.catch()`. An IndexedDB failure will produce an unhandled promise rejection. **Why:** Bookmarks silently fail to load; no user feedback. **Fix:** Add `.catch(err => console.warn('[LessonPlayer] bookmarks load failed:', err))`.

- **[Recurring] `LessonPlayer.tsx:234` (confidence: 85)**: `getNotes(courseId, lessonId).then(notes => { ... })` inside the lesson-change effect also lacks `.catch()`. Same fire-and-forget pattern. **Fix:** Add `.catch(err => console.warn(...))`.

- **`ImportedCourseDetail.tsx:135-147` (confidence: 85)**: `handleDelete()` is an `async function` that `await`s `removeImportedCourse(courseId)` but has no `try/catch`. If `removeImportedCourse` throws (e.g., IndexedDB transaction failure), the error propagates as an unhandled rejection and the UI freezes with `deleting=true` permanently. **Why:** Learner clicks "Delete", sees "Deleting..." forever, can't interact with the dialog. **Fix:** Wrap the body in `try/catch` with `setDeleting(false)` in the `catch` block and `toast.error('...')`.

- **`Challenges.tsx:102` (confidence: 92)**: Hardcoded Tailwind color `[&>div]:bg-amber-500` bypasses design tokens. This is the only hardcoded color in non-prototype page files, but it breaks dark mode theming since `amber-500` has no dark mode override. **Why:** Completed challenge progress bars will have inconsistent colors in dark mode. **Fix:** Use `[&>div]:bg-warning` or `[&>div]:bg-gold` to reference the design token system.

- **[Recurring] `Overview.tsx:348`, `Courses.tsx:574,583` (confidence: 85)**: String interpolation for `className` instead of `cn()`. Example: `` className={`transition-opacity duration-200 motion-reduce:transition-none ${importedCourses.length > 0 ? 'opacity-60 hover:opacity-100' : ''}`} ``. **Why:** When conditions grow, string interpolation produces malformed class strings with trailing spaces and doesn't handle `undefined`/`false` cleanly. **Fix:** Use `cn('transition-opacity duration-200 motion-reduce:transition-none', importedCourses.length > 0 && 'opacity-60 hover:opacity-100')`.

### Medium

- **`Overview.tsx:69,115-117`, `Reports.tsx:126-132,143` (confidence: 78)**: Multiple `useMemo(..., [])` with empty dependency arrays calling functions like `getAllProgress()`, `getWeeklyChange()`, `getLast7DaysLessonCompletions()`. These compute from localStorage/IndexedDB state but the memos never recompute because the deps are empty. If a user completes a lesson and navigates back to Overview/Reports, the stats are stale until a full page refresh. **Why:** Learner completes a lesson, returns to dashboard, and sees outdated stats -- confusing and demoralizing. **Fix:** Either add a dependency that changes on data mutation (e.g., a counter from a store), use a custom event listener, or accept the trade-off with a comment explaining the intentional staleness.

- **`CourseOverview.tsx:145-149,165-169` (confidence: 82)**: Multiple inline `style={{}}` blocks for complex gradients using CSS variables. While the variables themselves are theme-aware, the inline styles bypass Tailwind's utility system and the ESLint `no-inline-styles` rule. The `minHeight: 280` should be a Tailwind class. **Fix:** Move gradient definitions to CSS custom utilities or use Tailwind arbitrary values: `min-h-[280px]` and consider a `@utility` for the gradient.

- **`CourseOverview.tsx:62` (confidence: 75)**: `useEffect` depends on `course?.modules` which is a new array reference on every render (since `courses.find()` returns from the store array). This means `setExpandedModules(new Set([course.modules[0].id]))` runs on every render, potentially resetting user-expanded modules. **Fix:** Depend on `course?.modules[0]?.id` (a stable string) instead of the modules array.

- **`MyClass.tsx:30-32` (confidence: 80)**: `getCoursesInProgress(allCourses)`, `getCompletedCourses(allCourses)`, `getNotStartedCourses(allCourses)` are called on every render without `useMemo`. These iterate the full course list each time. For the current dataset this is negligible, but it's inconsistent with the memoization discipline in Overview.tsx and Reports.tsx. **Fix:** Wrap in `useMemo(() => ..., [allCourses])`.

- **`Courses.tsx:262-283` (confidence: 78)**: `filteredImportedCourses` is computed as an IIFE `(() => { ... })()` on every render instead of using `useMemo`. This recomputes the full filter/search pipeline on every keystroke (after debounce) AND on every unrelated state change. **Fix:** Convert to `useMemo` with `[importedCourses, debouncedSearch, selectedTopics, selectedStatuses]` deps.

- **`Courses.tsx:165` (confidence: 72)**: TODO comment: `// TODO: Calculate from contentProgress when implemented`. This has been present since the feature was added and `contentProgress` is now implemented (used in `YouTubeLessonPlayer.tsx`). **Why:** Imported course completion percentage in momentum sorting always shows 0%. **Fix:** Integrate `useContentProgressStore` to get actual completion.

- **`LearningPathDetail.tsx:875` (confidence: 82)**: Non-null assertion `pathId!` passed to `CoursePickerDialog`. `pathId` comes from `useParams` which returns `string | undefined`. The component guards against `!path` rendering but `pathId` is still technically `undefined` at the type level. **Fix:** Add an early return or use `pathId ?? ''` with a guard.

- **`YouTubeLessonPlayer.tsx:317-318` (confidence: 82)**: Non-null assertions `courseId!` and `lessonId!` on `YouTubePlayer` props. Same pattern -- `useParams` returns `string | undefined`. **Fix:** Guard earlier or use `courseId ?? ''`.

- **`QuizReview.tsx:79` (confidence: 80)**: `db.quizAttempts.get(attemptId!)` -- non-null assertion on route param. If somehow navigated to without the param, this throws. **Fix:** Guard with `if (!attemptId) { setStatus('error'); return }`.

### Nits

- **Nit** `Overview.tsx:245,Courses.tsx:574,606` (confidence: 75): Template literal className strings used in 23 places across 10 page files (excluding prototypes). While functional, `cn()` is the project convention and provides better readability, deduplication, and false-value handling.

- **Nit** `MyClass.tsx:20` (confidence: 70): Default export `export default function MyClass()` while most pages use named exports. Inconsistent export style across pages (Overview is named, Reports is default, MyClass is default). Not a bug but makes lazy-loading route config harder to maintain.

- **Nit** `LessonPlayer.tsx:15-28` (confidence: 72): Relative imports `from '../components/...'` instead of `@/app/components/...` alias. This is the only page file not using the `@/` alias for component imports. **Fix:** Convert to `@/app/components/...` for consistency.

- **Nit** `CourseOverview.tsx:157` (confidence: 70): `(e.target as HTMLImageElement).style.display = 'none'` is an inline style mutation in an onError handler. While pragmatic, it bypasses React's virtual DOM. Consider using state to conditionally render the image.

---

## Recommendations

Fix in this order:

1. **Fire-and-forget IndexedDB reads** (ImportedLessonPlayer, YouTubeLessonPlayer, LessonPlayer) -- add `.catch()` handlers to prevent silent infinite loading states. Highest user impact.

2. **ImportedCourseDetail handleDelete** missing try/catch -- prevents permanent "Deleting..." UI freeze.

3. **Challenges.tsx hardcoded `bg-amber-500`** -- breaks dark mode theming for completed challenges.

4. **String interpolation -> cn()** across 10+ files -- batch refactor for consistency.

5. **Stale useMemo with `[]` deps** on Overview and Reports -- decide whether to accept staleness or add reactivity.

6. **Non-null assertions on route params** -- guard defensively against `undefined`.

7. **MyClass.tsx missing useMemo** and **Courses.tsx IIFE** -- minor performance consistency fixes.

---

Issues found: **17** | Blockers: **0** | High: **6** | Medium: **7** | Nits: **4**
Confidence: avg **81** | >= 90: **2** | 70-89: **15** | < 70: **0**
