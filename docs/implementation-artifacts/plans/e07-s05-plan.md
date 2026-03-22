# Implementation Plan: E07-S05 Smart Study Schedule Suggestion

**Branch:** `feature/e07-s05-smart-study-schedule-suggestion`
**Story file:** `docs/implementation-artifacts/7-5-smart-study-schedule-suggestion.md`
**Date:** 2026-03-08

---

## 1. Context & Architectural Overview

### What We're Building

A "Suggested Study Time" widget on the Overview dashboard that:

1. Analyzes the user's past 30 days of study activity to find their **peak hour of day**
2. Computes a **recommended daily study duration** from their weekly goal ÷ historical study days/week
3. **Distributes** that daily time across active courses, weighted proportionally by momentum score
4. Handles three distinct states: *insufficient data*, *no time-based goal*, and *full schedule*

### Data Sources

| Data | Source | Access Pattern |
|------|--------|---------------|
| Study activity (hour distribution, distinct days) | `localStorage['study-log']` | `getStudyLog()` from `src/lib/studyLog.ts` |
| Weekly goal | `localStorage['study-goals']` | `getStudyGoal()` from `src/lib/studyGoals.ts` |
| Active courses + momentum | Dexie sessions + static `allCourses` | `useSessionStore.sessions` + `calculateMomentumScore()` |

**Why localStorage for analytics:** Consistent with `StudyGoalsWidget`, easy to seed in E2E tests (no IndexedDB fixture needed).

### Key Dependencies (already implemented)

- `src/lib/momentum.ts` — `calculateMomentumScore()`, `MomentumScore`
- `src/lib/studyLog.ts` — `getStudyLog()`, `StudyAction`
- `src/lib/studyGoals.ts` — `getStudyGoal()`, `StudyGoal`
- `src/stores/useSessionStore.ts` — `useSessionStore` with `sessions: StudySession[]`
- `src/lib/progress.ts` — `getAllProgress()`, `getCourseCompletionPercent()`

---

## 2. File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/studySchedule.ts` | Pure algorithm: all schedule computation functions |
| `src/lib/__tests__/studySchedule.test.ts` | Unit tests for all algorithm functions |
| `src/app/components/StudyScheduleWidget.tsx` | Dashboard widget component (3 states) |
| `tests/e2e/story-e07-s05.spec.ts` | Playwright E2E tests |

### Modified Files

| File | Change |
|------|--------|
| `src/app/pages/Overview.tsx` | Import and render `StudyScheduleWidget` as a new section |

---

## 3. Algorithm Design (`src/lib/studySchedule.ts`)

### Type Definitions

```typescript
import type { StudyAction } from '@/lib/studyLog'
import type { StudyGoal } from '@/lib/studyGoals'
import type { Course } from '@/data/types'
import type { MomentumScore } from '@/lib/momentum'

export interface CourseWithMomentum {
  course: Course
  momentumScore: MomentumScore
}

export interface CourseAllocation {
  courseId: string
  courseTitle: string
  minutes: number
}

export type StudyScheduleStatus = 'insufficient-data' | 'no-goal' | 'ready'

export interface StudyScheduleResult {
  status: StudyScheduleStatus
  optimalHour: number | null        // 0-23, null when insufficient data
  recommendedDailyMinutes: number | null
  courseAllocations: CourseAllocation[]
  activeCourseCount: number
  distinctStudyDays: number         // for display context
}

export interface StudyScheduleInput {
  studyLog: StudyAction[]
  goal: StudyGoal | null
  activeCourses: CourseWithMomentum[]
  windowDays?: number               // default: 30
  minDaysRequired?: number          // default: 7
}
```

### Helper Functions

#### `getDistinctStudyDays(log, windowDays)`

```
Filter log to entries where type === 'lesson_complete' AND within past windowDays
Build Set<string> of unique toLocalDateString(timestamp) values
Return Set.size
```

#### `calculateOptimalStudyHour(log, windowDays)`

```
Filter log to lesson_complete entries within past windowDays
Build hourCounts: Record<0-23, number>
For each entry: hourCounts[new Date(timestamp).getHours()]++
Return hour with max count (null if no entries)
Tiebreaker: lowest hour number (earlier is more deterministic)
```

#### `getHistoricalDaysPerWeek(log, windowDays)`

```
distinctDays = getDistinctStudyDays(log, windowDays)
Return Math.max(1, distinctDays / (windowDays / 7))
Clamp to [1, 7]
```

#### `getWeeklyGoalMinutes(goal)`

```
If goal.metric === 'sessions': return null
If goal.frequency === 'weekly': return goal.target
If goal.frequency === 'daily': return goal.target * 7
```

Note: `goal.target` is already in minutes when `metric === 'time'`.

#### `calculateDailyStudyDuration(goal, log, windowDays)`

```
weeklyMinutes = getWeeklyGoalMinutes(goal)
If weeklyMinutes === null: return null

daysPerWeek = getHistoricalDaysPerWeek(log, windowDays)
rawDaily = weeklyMinutes / daysPerWeek

# Round to nearest 15 minutes
rounded = Math.round(rawDaily / 15) * 15
Return Math.max(15, rounded)   # minimum 15 minutes
```

#### `allocateTimeAcrossCourses(dailyMinutes, courses)`

```
If courses.length === 0: return []

totalScore = sum(c.momentumScore.score for c in courses)

If totalScore === 0:
  # Equal allocation when no momentum data
  perCourse = Math.round(dailyMinutes / courses.length)
  Return courses.map(c => { courseId, courseTitle, minutes: perCourse })

Return courses.map(c => {
  proportion = c.momentumScore.score / totalScore
  minutes = Math.max(1, Math.round(dailyMinutes * proportion))
  Return { courseId: c.course.id, courseTitle: c.course.title, minutes }
})
```

#### `computeStudySchedule(input)` — top-level orchestrator

```
{ studyLog, goal, activeCourses, windowDays = 30, minDaysRequired = 7 } = input

distinctDays = getDistinctStudyDays(studyLog, windowDays)
activeCourseCount = activeCourses.length
optimalHour = calculateOptimalStudyHour(studyLog, windowDays)

# Check 1: insufficient data
If distinctDays < minDaysRequired:
  return { status: 'insufficient-data', optimalHour: null, ...nulls, activeCourseCount, distinctStudyDays: distinctDays }

# Check 2: no usable time goal
weeklyMinutes = goal ? getWeeklyGoalMinutes(goal) : null
If weeklyMinutes === null:
  return { status: 'no-goal', optimalHour, recommendedDailyMinutes: null, courseAllocations: [], activeCourseCount, distinctStudyDays: distinctDays }

# Full schedule
dailyMinutes = calculateDailyStudyDuration(goal!, studyLog, windowDays)
allocations = allocateTimeAcrossCourses(dailyMinutes!, activeCourses)

return { status: 'ready', optimalHour, recommendedDailyMinutes: dailyMinutes, courseAllocations: allocations, activeCourseCount, distinctStudyDays: distinctDays }
```

---

## 4. Component Design (`src/app/components/StudyScheduleWidget.tsx`)

### Props

```typescript
// No external props — fully self-contained, reads its own data
export function StudyScheduleWidget(): JSX.Element
```

### Data Loading Pattern

Mirrors `StudyGoalsWidget`:

```typescript
const refresh = useCallback(() => {
  const studyLog = getStudyLog()
  const goal = getStudyGoal()

  // Get active courses with momentum scores
  const allProgress = getAllProgress()
  const sessions = useSessionStore.getState().sessions   // direct store access
  const activeCourses = buildActiveCoursesWithMomentum(allCourses, allProgress, sessions)

  const result = computeStudySchedule({ studyLog, goal, activeCourses })
  setSchedule(result)
}, [])

useEffect(() => {
  refresh()
  window.addEventListener('study-log-updated', refresh)
  window.addEventListener('study-goals-updated', refresh)
  return () => {
    window.removeEventListener('study-log-updated', refresh)
    window.removeEventListener('study-goals-updated', refresh)
  }
}, [refresh])
```

`buildActiveCoursesWithMomentum` is a helper (co-located in the component file) that:
1. Filters courses where `0 < completionPercent < 100`
2. Calls `calculateMomentumScore({ courseId, totalLessons, completionPercent, sessions })` for each
3. Returns `CourseWithMomentum[]`

### 3 UI States

#### State A: `insufficient-data`
```
[Calendar icon]
Build Your Study Pattern
You need at least 7 days of study activity to unlock personalized recommendations.
[Progress indicator: X / 7 days recorded]
Keep studying to unlock your optimal schedule!
```

#### State B: `no-goal`
```
[Clock icon]  Your Peak Study Hour: [hour label e.g. "8:00 AM"]

[Target icon with dashed border]
Set a weekly study goal to see your full personalized schedule.
[Link → /settings]  "Go to Settings"
```

#### State C: `ready`
```
[Clock icon]  Your Peak Study Hour: [hour label]   — [active course count] active courses

[Recommended Daily: Xh Ym]

Course Time Allocation:
  [Course Title 1]  ████████  X min
  [Course Title 2]  ████  X min
  ...
```

### `testid` Attributes

| Element | `data-testid` |
|---------|---------------|
| Widget root | `study-schedule-widget` |
| Insufficient data state | `schedule-insufficient-data` |
| No-goal state | `schedule-no-goal` |
| Ready state | `schedule-ready` |
| Optimal hour display | `schedule-optimal-hour` |
| Daily duration display | `schedule-daily-duration` |
| Go to Settings link | `schedule-settings-link` |

### Hour Formatting

```typescript
function formatHour(hour: number): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.toLocaleTimeString([], { hour: 'numeric', hour12: true })
  // → "8:00 AM", "2:00 PM"
}
```

### Duration Formatting

```typescript
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
```

---

## 5. Overview.tsx Integration

Add a new `motion.section` after the Study History Calendar section:

```tsx
{/* ── Study Schedule Widget ── */}
<motion.section
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-50px' }}
  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
  className="rounded-[24px] border border-border/50 bg-card p-6"
>
  <h2 className="text-xl font-semibold mb-4">Suggested Study Time</h2>
  <StudyScheduleWidget />
</motion.section>
```

Import: `import { StudyScheduleWidget } from '@/app/components/StudyScheduleWidget'`

---

## 6. Unit Test Strategy (`src/lib/__tests__/studySchedule.test.ts`)

Pin time: `const FIXED_NOW = new Date('2026-03-08T14:00:00.000Z')`

### Factory Helper

```typescript
function makeAction(type: StudyAction['type'], daysAgo: number, hour: number): StudyAction {
  const d = new Date(FIXED_NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 0, 0, 0)
  return { type, courseId: 'test-course', timestamp: d.toISOString() }
}
```

### Test Cases

| Function | Test | Expected |
|----------|------|----------|
| `getDistinctStudyDays` | 3 actions on 3 different days | 3 |
| `getDistinctStudyDays` | 3 actions on same day | 1 |
| `getDistinctStudyDays` | actions outside window filtered | correct count |
| `getDistinctStudyDays` | only counts `lesson_complete` | ignores `video_progress` |
| `calculateOptimalStudyHour` | 3 sessions at 8am, 2 at 2pm | returns 8 |
| `calculateOptimalStudyHour` | empty log | returns null |
| `calculateOptimalStudyHour` | tie → lower hour wins | deterministic |
| `getWeeklyGoalMinutes` | weekly time goal, target=300 | 300 |
| `getWeeklyGoalMinutes` | daily time goal, target=60 | 420 |
| `getWeeklyGoalMinutes` | session-count goal | null |
| `calculateDailyStudyDuration` | 300 min/week ÷ 5 days/week | 60 (rounds to 60) |
| `calculateDailyStudyDuration` | rounds to nearest 15 | e.g. 67min → 75min |
| `calculateDailyStudyDuration` | session goal → null | null |
| `allocateTimeAcrossCourses` | 2 courses, scores 70 & 30, 60min daily | 42min & 18min |
| `allocateTimeAcrossCourses` | all zero scores | equal split |
| `allocateTimeAcrossCourses` | empty courses | [] |
| `computeStudySchedule` | < 7 distinct days | status: 'insufficient-data' |
| `computeStudySchedule` | 7+ days, no goal | status: 'no-goal', optimalHour set |
| `computeStudySchedule` | 7+ days, session goal | status: 'no-goal' (no time) |
| `computeStudySchedule` | 7+ days, weekly time goal | status: 'ready' |
| `computeStudySchedule` | ready state has allocations | allocations.length === activeCourses.length |

---

## 7. E2E Test Strategy (`tests/e2e/story-e07-s05.spec.ts`)

### Setup Pattern

Seed localStorage via `page.addInitScript`:

```typescript
function makeStudyLogEntries(count: number, daySpread: number, hour = 9): StudyAction[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'lesson_complete',
    courseId: 'nci-access',
    lessonId: `lesson-${i}`,
    timestamp: new Date(Date.now() - (i % daySpread) * 86400000 - (i % 2) * 3600000 + hour * 3600000).toISOString(),
  }))
}
```

### Test Cases

| Test | Seed | Expected |
|------|------|----------|
| AC2: insufficient data | 3 distinct days in study log | `schedule-insufficient-data` visible |
| AC5: no goal | 10 distinct days, no `study-goals` key | `schedule-no-goal` visible |
| AC1+3: full schedule | 10 distinct days, weekly time goal set | `schedule-ready` visible, optimal hour shown, duration shown |
| AC5: settings link | 10 distinct days, no goal | clicking settings link navigates to `/settings` |

**Sidebar fix (from memory):** Seed `localStorage.setItem('knowlune-sidebar-v1', 'false')` before navigate.

---

## 8. Implementation Sequence

```
Step 1  studySchedule.ts — pure algorithm (no UI dependencies)
Step 2  studySchedule.test.ts — full unit coverage (TDD)
Step 3  StudyScheduleWidget.tsx — component with 3 states
Step 4  Overview.tsx — wire in the widget
Step 5  story-e07-s05.spec.ts — E2E tests for the 3 states
```

---

## 9. Out of Scope

- Persisting the suggested schedule to Dexie (computed on demand, not stored)
- Calendar/time-slot UI (only show optimal hour label, not a calendar grid)
- Notifications reminding user at the optimal hour (covered by E05-S05 reminders)
- Course-level "start studying now" CTA (widget is informational only)

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Study log has only `video_progress` entries (no `lesson_complete`) → always "insufficient data" | Filter to `lesson_complete` only; UI copy references "study sessions" not raw log |
| Weekly goal in `sessions` metric can't compute time | `getWeeklyGoalMinutes` returns null → `no-goal` state; widget copy hints "set a time-based goal" |
| All active courses have 0 momentum (all cold/new) | `allocateTimeAcrossCourses` falls back to equal split |
| No active courses (user completed everything) | `courseAllocations: []` rendered gracefully; daily duration still shown without breakdown |
| `new Date(hour).getHours()` timezone sensitivity | Always parse timestamps with `new Date(isoString)` — ISO strings from localStorage are stored in local time via `toISOString()` so UTC offset must be considered. Use `new Date(ts).getHours()` which returns local hours. |
