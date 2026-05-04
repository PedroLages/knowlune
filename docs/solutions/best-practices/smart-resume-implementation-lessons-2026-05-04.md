---
title: Smart Resume — Plan-Deepen Loop Fixes for Hooks Violation, Coupling, and Navigation
date: 2026-05-04
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: high
applies_when:
  - Computing per-path derived data from a list of entities — avoid calling a hook inside a loop
  - A generic flow hook (e.g., post-completion) needs domain-specific awareness — resolve context in the consumer, not the hook
  - Navigation targets from a hook — return the target ID in the result shape rather than letting callers derive it
  - An async-reliant hook needs a sync-first return shape — use INITIAL_RESULT + async update via useEffect
  - Responding to critic findings in a plan-deepen loop — structure the deepen pass to address root causes, not surface symptoms
tags:
  - react-rules-of-hooks
  - decoupling
  - navigation-patterns
  - plan-deepen-loop
  - use-next-best-course
  - critic-feedback
  - async-initial-result
  - course-celebration
---

# Smart Resume — Plan-Deepen Loop Fixes for Hooks Violation, Coupling, and Navigation

## Context

The Smart Resume feature connected learning paths to the daily learning flow across three surfaces: an Overview dashboard section, path card continue buttons, and post-completion path continuity in the lesson player. The initial plan passed the `ce:plan` review at 92/100, but the R1 critic found it at 72/100 with a BLOCKER and two HIGH issues. Three deepen cycles fixed all three issues before implementation began. A subsequent synthesis review (11 agents) found 14 findings; 3 applied fixes further hardened the implementation. This document captures the patterns that emerged from the corrective loop — not just what the fixes were, but the structural principles they revealed.

Three patterns recur across all the fixes:

1. **Calling a hook inside a map/loop violates React's Rules of Hooks.** The Overview section needed per-path next-course data. The initial plan iterated over paths and called `useNextBestCourse(path.id)` per path. The fix: compute from a single hook call and derive per-path results from the pre-computed data.
2. **A generic flow hook should not carry domain-specific context.** The initial plan added `pathContext` params to `useCompletionFlow.ts` so it could signal the lesson player to show path-based suggestions. The fix: resolve path context entirely within `UnifiedLessonPlayer.tsx` — `useCompletionFlow.ts` is not modified.
3. **Navigation targets belong in the hook's return shape, not distributed across callers.** The initial plan navigated to course overview pages (`/courses/${courseId}`) for MVP. The fix: `useNextBestCourse` returns `targetLessonId`, and all callers navigate to the lesson player directly.

## Guidance

### 1. Derive per-item data from a single hook call — never call hooks in a loop

**The problem:** `ContinueLearningPathSection` needed the next best course for each path. The initial approach iterated over `paths` and called `useNextBestCourse(path.id)` inside the loop:

```typescript
// WRONG: calling useNextBestCourse inside a map violates React Rules of Hooks
{paths.map(path => {
  const result = useNextBestCourse(path.id) // BLOCKER: hooks in a loop
  return <PathCard ... />
})}
```

React requires hooks to be called in the same order on every render. A map over an array of variable length breaks this invariant — React cannot guarantee the same number or order of hook calls.

**The fix:** Call `useMultiPathProgress` once with all paths' entries aggregated into a single map. Then derive per-path next courses by traversing each path's sorted entries over the pre-computed progress object — no hooks in sight:

```typescript
// Correct: single hook call, derive per-path results from the pre-computed map
const allEntries = useLearningPathStore(s => s.entries)

const entriesByPathMap = useMemo(() => {
  const map = new Map<string, LearningPathEntry[]>()
  for (const entry of allEntries) {
    if (!map.has(entry.pathId)) map.set(entry.pathId, [])
    map.get(entry.pathId)!.push(entry)
  }
  return map
}, [allEntries])

// Single hook call — no loop
const multiProgress = useMultiPathProgress(entriesByPathMap)

// Derive per-path next courses from pre-computed data
function deriveNextCourse(
  sortedEntries: LearningPathEntry[],
  courseProgress: Map<string, CourseProgressInfo>,
  importedCourses: ImportedCourse[]
): { entry: LearningPathEntry | null; course: ImportedCourse | null; action: NextBestAction } {
  // Pass 1: Find first in-progress (resume)
  for (const entry of sortedEntries) {
    const cp = courseProgress.get(entry.courseId)
    if (cp && cp.completionPct > 0 && cp.completionPct < 100) {
      return { entry, course: importedCourses.find(c => c.id === entry.courseId) ?? null, action: 'resume' }
    }
  }
  // Pass 2: Find first unstarted (start)
  for (const entry of sortedEntries) {
    const cp = courseProgress.get(entry.courseId)
    if (cp && cp.completionPct === 0) {
      return { entry, course: importedCourses.find(c => c.id === entry.courseId) ?? null, action: 'start' }
    }
  }
  return { entry: null, course: null, action: 'complete' }
}
```

**Why this works:** `useMultiPathProgress` accepts a `Map<string, LearningPathEntry[]>` where keys are path IDs and values are arrays of entries. A single hook call covers all paths. Per-path derivation is pure computation — no hooks, no rules violations, no variable-length concerns. The map is stable via `useMemo` so it only recomputes when entries change.

### 2. Resolve domain context in the consumer, not the generic flow hook

**The problem:** The lesson player's post-completion behavior needed to know whether the completed course belonged to a learning path. The initial plan modified `useCompletionFlow.ts` to accept `pathContext` parameters — coupling the generic completion flow with path-specific concerns:

```typescript
// WRONG: generic flow hook carrying domain-specific context
interface CompletionFlowParams {
  courseId: string
  pathContext?: { pathId: string; pathName: string } // coupling
}
```

**The fix:** Determine path membership entirely within `UnifiedLessonPlayer.tsx` using store selectors. `useCompletionFlow.ts` is not modified:

```typescript
// UnifiedLessonPlayer.tsx — path context resolved entirely in the consumer
const allPathEntries = useLearningPathStore(s => s.entries)
const paths = useLearningPathStore(s => s.paths)

const pathContext = useMemo(() => {
  if (!courseId) return null
  const matchingEntry = allPathEntries.find(e => e.courseId === courseId)
  if (!matchingEntry) return null
  const path = paths.find(p => p.id === matchingEntry.pathId)
  if (!path || path.isTemplate) return null
  return { pathId: matchingEntry.pathId, pathName: path.name }
}, [allPathEntries, courseId, paths])

// Only call useNextBestCourse when we know the course is in a path
const coursePathId = pathContext?.pathId ?? ''
const nextBest = useNextBestCourse(coursePathId)
```

The component conditionally renders `NextInPath` or the existing `NextCourseSuggestion` based on whether `pathContext` is non-null:

```typescript
{pathSuggestion ? (
  <NextInPath ... />
) : courseSuggestion ? (
  <NextCourseSuggestion ... />
) : null}
```

**Why this works:** `useCompletionFlow.ts` controls the celebration modal lifecycle — open/close state and the timing of `showCourseSuggestion`. It should not know about learning paths. The lesson player, which renders both the completion flow and the suggestion UI, is the natural place to bridge them. This keeps each module focused: the flow hook manages flow state, the page component wires domain logic.

### 3. Return navigation targets from the hook — don't let callers derive them

**The problem:** The initial plan navigated to the course overview page (`/courses/${courseId}`) from continue buttons, deferring direct lesson player navigation to a follow-up. This left R7 ("1-click resume to the exact lesson") partially unmet:

```typescript
// WRONG: caller has to guess the navigation target
const result = useNextBestCourse(pathId)
navigate(`/courses/${result.course?.id}`) // course overview, not lesson player
```

**The fix:** `useNextBestCourse` resolves `targetLessonId` internally — the first incomplete lesson for 'resume' actions, the first lesson for 'start' actions — and includes it in the return shape. All callers use it uniformly:

```typescript
// The hook returns targetLessonId
export interface NextBestCourseResult {
  entry: LearningPathEntry | null
  course: ImportedCourse | null
  action: NextBestAction
  targetLessonId: string | null  // resolved by the hook
}

// All callers navigate the same way
navigate(`/courses/${result.entry!.courseId}/lessons/${result.targetLessonId}`)
```

**Why this works:** The `targetLessonId` resolution requires knowledge of the course's lesson structure (`findFirstIncompleteLesson` queries Dexie for video/PDF ordering). If each caller resolved this independently, the logic would be duplicated across the Overview section, path cards, and NextInPath. Centralizing it in the hook ensures consistent behavior and makes it trivial to add callers: just read `result.targetLessonId`.

### 4. Sync-first return shape for async-dependent hooks

**The hook has an async dependency** (Dexie queries to find lesson IDs) but must be callable as a regular React hook. The pattern: return `INITIAL_RESULT` (all nulls) synchronously, then use `useEffect` + state to compute the real result asynchronously:

```typescript
const INITIAL_RESULT: NextBestCourseResult = {
  entry: null,
  course: null,
  action: null,
  targetLessonId: null,
}

export function useNextBestCourse(pathId: string): NextBestCourseResult {
  // ... sync selectors ...
  const [result, setResult] = useState<NextBestCourseResult>(INITIAL_RESULT)

  const runCompute = useCallback(async () => {
    const newResult = await computeNextBestCourse(
      sortedEntries, courseProgress, importedCourses, statusMap
    )
    if (!cancelledRef.current) {
      setResult(newResult)
    }
  }, [sortedEntries, courseProgress, importedCourses, statusMap])

  useEffect(() => {
    cancelledRef.current = false
    runCompute()
    return () => { cancelledRef.current = true }
  }, [runCompute])
  // ...
}
```

The cancellation ref (`cancelledRef`) prevents stale async results from overwriting newer ones when dependencies change between render and resolution. This is the same generation-counter pattern documented separately for Zustand stale async results.

**Why this works:** Components always render with a valid `NextBestCourseResult` — initially the null-state, then the computed value. No conditional rendering needed, no suspense boundary. The async resolution is transparent to the consumer.

### 5. Structure deepen fixes to address root causes, not symptoms

The R1 critic found 3 issues. Instead of patching each symptom independently, the deepen pass restructured the plan to eliminate the root causes:

| Issue | Symptom-level fix | Root-cause fix (what was done) |
|-------|-------------------|-------------------------------|
| Hooks in a loop | Wrap each hook call in a guard (`if (condition)`), add eslint-disable | Switch to single `useMultiPathProgress` + derive — no hooks in iteration at all |
| Coupled completion flow | Add optional `pathContext` params, conditionally branched | Resolve path context in the consumer only — flow hook is never modified |
| Wrong navigation target | Change `navigate('/courses/${id}')` to `navigate('/courses/${id}/lessons/${lessonId}')` in 3 places | Return `targetLessonId` from the hook so all callers automatically get the right target |

Root-cause fixes are more expensive upfront (plan restructuring vs. code patching) but eliminate entire classes of future bugs. The symptom-level fixes would each need to be re-checked on every code change. The root-cause fixes are structural invariants.

## Why This Matters

**Hooks-in-loop violations are invisible in development.** A single path renders fine. Two paths render fine. Three paths render fine. Then a path is deleted, the array resizes, and React's hook order guarantee breaks — causing mysterious state corruption in unrelated components. ESLint's `react-hooks/rules-of-hooks` rule catches this at save-time, but only if the hook call is syntactically inside a loop. The pattern of "loop over entities → call hook per entity" often passes linting when abstracted behind a `useMemo` or a component. The fix is structural: avoid per-entity hook calls entirely by computing a batch result from a single hook invocation.

**Generic flow hooks should not know about every domain that uses them.** `useCompletionFlow` manages celebration modal state — open/close, timing, animation. Adding path context to it would be a leaky abstraction: every feature that needs post-completion behavior would add its own params. The consumer pattern (resolve context in the page component, pass props to the suggestion UI) keeps the flow hook clean and composable.

**Navigation targets are a cross-cutting concern.** If three surfaces (Overview, path card, lesson player) each derive the navigation target independently, they will inevitably diverge — one will route to the lesson player, another to the course overview, a third to a different URL pattern. Centralizing target resolution in the hook ensures consistency at zero ongoing cost.

## When to Apply

- When a component needs per-item data for each entity in a list — aggregate data for all items with a single hook call, then derive per-item results with pure functions. Never call a hook inside a `map()`, `forEach()`, or `for` loop.
- When a generic flow hook needs domain awareness (e.g., post-completion, onboarding, error fallback) — resolve the domain context in the consumer component that renders the hook, not inside the hook itself.
- When a hook's result implies navigation — include the navigation target in the return shape rather than documenting a convention across callers. This prevents drift.
- When a hook has async dependencies but must be sync-callable — use a well-typed INITIAL_RESULT constant and an effect-driven async update with cancellation refs.
- When a critic finds root-cause-level issues in a plan — restructure the plan to eliminate the vulnerability pattern entirely rather than patching each instance.

## Examples

### Before (plan-level bug): Calling hooks in a loop for the Overview section

```typescript
// Plan Unit 2 approach (R1 critic: BLOCKER)
function ContinueLearningPathSection() {
  const paths = useLearningPathStore(s => s.paths)

  // Called during render, variable iteration — hooks-in-loop violation
  return paths.map(path => {
    const nextCourse = useNextBestCourse(path.id) // VIOLATION
    return <PathCard key={path.id} nextCourse={nextCourse} />
  })
}
```

### After: Single hook call, derive per-path

```typescript
// Plan Unit 2 approach (after R1 deepen)
function ContinueLearningPathSection() {
  const allEntries = useLearningPathStore(s => s.entries)
  const importedCourses = useCourseImportStore(s => s.importedCourses)

  const entriesByPathMap = useMemo(() => {
    const map = new Map<string, LearningPathEntry[]>()
    for (const entry of allEntries) {
      if (!map.has(entry.pathId)) map.set(entry.pathId, [])
      map.get(entry.pathId)!.push(entry)
    }
    return map
  }, [allEntries])

  // Single hook call — no Rules of Hooks violation
  const multiProgress = useMultiPathProgress(entriesByPathMap)

  // Derive next courses per path as pure computation
  const pathsWithNextCourse = useMemo(() => {
    const results: Array<{ pathId: string; nextCourse: NextBestCourseResult }> = []
    for (const [pathId, entries] of entriesByPathMap) {
      const pathProgress = multiProgress.get(pathId)
      if (!pathProgress) continue
      const next = deriveNextCourse(
        entries.sort((a, b) => a.position - b.position),
        pathProgress.courseProgress,
        importedCourses
      )
      if (next.entry) results.push({ pathId, nextCourse: next })
    }
    return results
  }, [entriesByPathMap, multiProgress, importedCourses])

  // Render from derived data — no hooks in render
  // ...
}
```

### Before: Modifying the generic completion flow hook

```typescript
// Plan Unit 4 approach (R1 critic: HIGH — coupled)
interface CompletionFlowParams {
  courseId: string
  pathContext?: { pathId: string; pathName: string }  // domain leak
}
```

### After: Context resolved in the consumer

```typescript
// UnifiedLessonPlayer.tsx — consumer resolves context
const pathContext = useMemo(() => {
  if (!courseId) return null
  const matchingEntry = allPathEntries.find(e => e.courseId === courseId)
  if (!matchingEntry) return null
  const path = paths.find(p => p.id === matchingEntry.pathId)
  if (!path || path.isTemplate) return null
  return { pathId: matchingEntry.pathId, pathName: path.name }
}, [allPathEntries, courseId, paths])

// useCompletionFlow.ts — never modified, no path awareness
```

### Before: Navigation target derived by callers

```typescript
// Plan Unit 2-3 approach (R1 critic: HIGH — wrong target)
// Caller 1 (Overview):
navigate(`/courses/${result.course.id}`)

// Caller 2 (PathCard):
navigate(`/courses/${result.course.id}`)

// Caller 3 (NextInPath):
navigate(`/courses/${courseId}`)
```

### After: Navigation target centralized in the hook

```typescript
// useNextBestCourse returns targetLessonId:
export interface NextBestCourseResult {
  entry: LearningPathEntry | null
  course: ImportedCourse | null
  action: NextBestAction
  targetLessonId: string | null  // centralized
}

// All callers use the same pattern:
navigate(`/courses/${courseId}/lessons/${result.targetLessonId}`)
```

### Hook test: Async resolution with INITIAL_RESULT

```typescript
it('returns INITIAL_RESULT initially, then resolves async', async () => {
  const { result } = renderHook(() => useNextBestCourse('path-1'), { wrapper })

  // Initial render: sync null-state
  expect(result.current.action).toBeNull()
  expect(result.current.targetLessonId).toBeNull()

  // After async resolution
  await waitFor(() => {
    expect(result.current.action).toBe('resume')
    expect(result.current.targetLessonId).toBe('lesson-2')
  })
})
```

## Related

- `src/app/hooks/useNextBestCourse.ts` — The hook implementing all four patterns (single hook call, centralized navigation target, sync-first return shape with async resolution, cancellation ref pattern)
- `src/app/components/ContinueLearningPathSection.tsx` — Derives per-path next courses from a single `useMultiPathProgress` call
- `src/app/pages/UnifiedLessonPlayer.tsx` — Resolves path context in the consumer, keeping `useCompletionFlow.ts` generic
- `src/app/hooks/__tests__/useNextBestCourse.test.tsx` — Test patterns for async hooks with INITIAL_RESULT
- `docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md` — Plan with deepen history showing the R1→deepen→R2 cycle
- [Generation counter for stale async results](../best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md) — The `cancelledRef` pattern generalized for any stale-async scenario
- [Singleton Dialog Guard and Cross-Component Event Communication](./learning-paths-import-from-path-patterns-2026-05-03.md) — Another example of resolving context in the consumer (dialog target re-targeting via CustomEvent)
- PR: https://github.com/PedroLages/knowlune/pull/499
