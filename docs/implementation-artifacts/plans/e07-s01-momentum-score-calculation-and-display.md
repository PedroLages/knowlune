# E07-S01 Implementation Plan: Momentum Score Calculation & Display

**Story:** [7-1-momentum-score-calculation-and-display.md](../7-1-momentum-score-calculation-and-display.md)
**Branch:** `feature/e07-s01-momentum-score-calculation-and-display`
**Date:** 2026-03-08

---

## Overview

Add a momentum score system that calculates per-course engagement scores (0–100) based on recency, completion, and frequency, then displays them as hot/warm/cold indicators on course cards in the library with sortable support.

---

## Architecture

### Data Sources (all existing, no new DB tables)

| Input | Source | Table/Key |
|---|---|---|
| Study sessions | IndexedDB | `db.studySessions` — `courseId`, `startTime` |
| Completion % | localStorage `course-progress` | `CourseProgress.completedLessons` |
| Total lessons | Static course data | `Course.totalLessons` |

No new IndexedDB tables or schema version bumps are needed.

---

## Momentum Score Formula

```
score = clamp(recencyScore * 0.4 + completionScore * 0.3 + frequencyScore * 0.3, 0, 100)
```

### Component Definitions

**Recency Score (0–100):**
- `daysSinceLast` = days between now and the most recent session `startTime`
- `recencyScore = max(0, 100 - daysSinceLast * (100 / 14))`
- Normalizes linearly: 0 days = 100, 14+ days = 0
- No sessions: recencyScore = 0

**Completion Score (0–100):**
- `completionScore = completionPercent` (already 0–100)
- Uses existing `getCourseCompletionPercent(courseId, totalLessons)` from `progress.ts`

**Frequency Score (0–100):**
- `sessionsInLast30Days` = count of `db.studySessions` for courseId with `startTime >= (now - 30d)`
- `frequencyScore = min(100, sessionsInLast30Days * 10)` (10 sessions/month = max score)

### Tier Classification

| Tier | Score Range | Icon | Color |
|---|---|---|---|
| hot | ≥ 70 | `Flame` (lucide) | orange-500 / red-500 |
| warm | 30–69 | `Sun` (lucide) | amber-500 |
| cold | < 30 | `Snowflake` (lucide) | blue-400 / slate-400 |

---

## Files to Create

### 1. `src/lib/momentum.ts` — Pure calculation library

```typescript
export interface MomentumInput {
  courseId: string
  totalLessons: number
  sessions: StudySession[] // already loaded — avoids per-card DB calls
}

export type MomentumTier = 'hot' | 'warm' | 'cold'

export interface MomentumScore {
  score: number      // 0–100
  tier: MomentumTier
}

export function calculateMomentumScore(input: MomentumInput): MomentumScore
export function getMomentumTier(score: number): MomentumTier
```

**Design Decision:** Accept pre-loaded sessions array rather than making DB calls inside. This lets the Courses page load ALL sessions once and compute scores in a batch — far more efficient than N DB roundtrips for N courses.

### 2. `src/lib/__tests__/momentum.test.ts` — Unit tests

Uses `vitest` + `fake-indexeddb/auto` pattern from `challengeProgress.test.ts`. Tests:
- Score 0 with no sessions
- Score clamped to [0, 100]
- Recent sessions produce higher scores than old ones
- Tier thresholds (hot ≥ 70, warm 30–69, cold < 30)
- Frequency contribution (more sessions = higher score)

### 3. `src/app/components/figma/MomentumBadge.tsx` — Visual indicator

```typescript
interface MomentumBadgeProps {
  score: number        // 0–100
  tier: MomentumTier
  showScore?: boolean  // default false; shown in tooltip
  size?: 'sm' | 'md'
}
```

- Renders icon + tier label (e.g. "Hot")
- Tooltip (via shadcn `Tooltip`) shows numeric score
- `aria-label="Momentum: Hot (82)"`
- `motion-reduce` safe — no animation on badge entrance by default

---

## Files to Modify

### 4. `src/app/components/figma/CourseCard.tsx`

- Add optional `momentumScore?: MomentumScore` prop
- In `library` variant body: render `<MomentumBadge>` below the progress bar
- Only shown when `momentumScore` is defined (backward-compatible, no default change)

### 5. `src/app/components/figma/ImportedCourseCard.tsx`

- Add optional `momentumScore?: MomentumScore` prop
- Render `<MomentumBadge>` in card body below the video/PDF count row
- Only shown when `momentumScore` is defined

### 6. `src/app/pages/Courses.tsx`

**Sort state:**
```typescript
type SortMode = 'recent' | 'momentum'
const [sortMode, setSortMode] = useState<SortMode>('recent')
```

**Momentum loading (async, with `useLiveQuery` or `useEffect`):**
```typescript
// Load ALL studySessions once; compute per-course scores in-memory
const [momentumMap, setMomentumMap] = useState<Map<string, MomentumScore>>(new Map())

useEffect(() => {
  async function loadScores() {
    const sessions = await db.studySessions.toArray()
    const map = new Map<string, MomentumScore>()
    for (const course of allCourses) {
      const courseSessions = sessions.filter(s => s.courseId === course.id)
      map.set(course.id, calculateMomentumScore({
        courseId: course.id,
        totalLessons: course.totalLessons,
        sessions: courseSessions,
      }))
    }
    setMomentumMap(map)
  }
  loadScores()
}, [])  // re-runs when study-session-ended events fire (see AC5)
```

**Sort UI:**
- Add a sort dropdown or segmented control (simple `<select>` or `ToggleGroup`) in the filter bar
- Options: "Most Recent" (default) | "Sort by Momentum"

**Sort application:**
```typescript
const sorted = sortMode === 'momentum'
  ? [...filtered].sort((a, b) =>
      (momentumMap.get(b.id)?.score ?? 0) - (momentumMap.get(a.id)?.score ?? 0)
    )
  : filtered  // existing order
```

**Real-time recalc (AC5):**
- Listen to `study-session-ended` custom DOM event (already dispatched by `useSessionStore`)
- Re-run `loadScores()` on event

---

## Tests to Create

### 7. `tests/e2e/story-e07-s01.spec.ts`

```typescript
test('momentum indicator renders on course cards', ...)
test('sort by momentum option is present in courses page', ...)
test('sort by momentum reorders course list', ...)
test('momentum badge has accessible aria-label', ...)
```

Pattern: follow `tests/e2e/courses.spec.ts` — use `goToCourses(page)` helper, role-based selectors.

---

## Implementation Sequence

```
Step 1: src/lib/momentum.ts                          (pure function, no deps)
Step 2: src/lib/__tests__/momentum.test.ts           (TDD — write tests first)
Step 3: src/app/components/figma/MomentumBadge.tsx  (component)
Step 4: Modify CourseCard.tsx                        (add prop + render badge)
Step 5: Modify ImportedCourseCard.tsx                (add prop + render badge)
Step 6: Modify Courses.tsx                           (sort + load scores)
Step 7: tests/e2e/story-e07-s01.spec.ts             (E2E)
```

---

## Key Design Decisions

### Why batch-load sessions?
N course cards × 1 DB query each = N IndexedDB roundtrips per render. Loading all sessions once in `Courses.tsx` then filtering in-memory is O(sessions) instead of O(N × sessions/N). At scale this matters.

### Why `useEffect` + custom event vs. `useLiveQuery`?
`useLiveQuery` (Dexie React addon) would require adding the `dexie-react-hooks` package. Given the existing pattern in this codebase (all async Dexie access via `useEffect`), we stay consistent and avoid a new dependency. Real-time update is triggered by the existing `study-session-ended` event.

### Why add prop to CourseCard vs. reading from DB inside it?
Cards are rendered inside a grid loop. Pushing the async data loading up to the page level keeps cards pure/sync and avoids creating dozens of concurrent DB queries. Same pattern as `completionPercent` which is computed at the page level and passed as a prop.

### MomentumBadge positioning
In `library` variant: below the progress bar (bottom of card body). This doesn't disrupt the existing card layout — it's additive content below existing elements. No card height change needed as the badge is small.

---

## Edge Cases

| Case | Behavior |
|---|---|
| No study sessions for course | score = 0, tier = cold |
| completionPercent = 100 (completed course) | Full completion score but recency/frequency may be 0 if not studied recently |
| Sessions older than 30 days | Only sessions within 30-day window count toward frequency; most recent session still used for recency |
| `momentumScore` prop not passed | MomentumBadge not rendered; backward compatible |
| Multiple sessions same day | Each session counts toward frequency (by DB row count) |

---

## Acceptance Criteria Mapping

| AC | Implementation |
|---|---|
| Score is 0–100 weighted function of recency/completion/frequency | `momentum.ts` formula |
| Hot/warm/cold indicator on course cards | `MomentumBadge.tsx` in CourseCard + ImportedCourseCard |
| No sessions → score 0, cold | `calculateMomentumScore` with empty sessions array |
| Sort by Momentum in course library | Sort UI + `sortMode` state in `Courses.tsx` |
| Score recalculates in-session after study session | `study-session-ended` event listener triggers reload |
