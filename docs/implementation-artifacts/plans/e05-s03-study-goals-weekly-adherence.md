# E05-S03: Study Goals & Weekly Adherence — Implementation Plan

## Context

Story E05-S03 adds a study goals system to the LevelUp dashboard. Learners can set daily/weekly study goals (time-based or session-based), see real-time progress via a dashboard widget, and track weekly adherence. This builds on E05-S01 (streak counter) and E05-S02 (pause/freeze), which established the localStorage + custom event patterns for study tracking.

**Key design decision**: Goals configuration uses localStorage (simple config, consistent with streak settings), while progress computation derives from existing `StudySessions` in Dexie and `study-log` actions in localStorage. No new database tables needed.

---

## Task 1: Study Goals Library (`src/lib/studyGoals.ts`)

Create a pure-function library following the `studyLog.ts` pattern.

**Types:**
```ts
interface StudyGoal {
  frequency: 'daily' | 'weekly'
  metric: 'time' | 'sessions'
  target: number          // minutes (time) or count (sessions)
  createdAt: string       // ISO timestamp
}

interface GoalProgress {
  current: number         // minutes or session count
  target: number
  percent: number         // 0-100, clamped
  completed: boolean
}

interface WeeklyAdherence {
  daysStudied: number
  totalDays: number       // days since goal creation or 7, whichever is smaller
  percent: number         // (daysStudied / totalDays) * 100
}
```

**Functions:**
- `getStudyGoal(): StudyGoal | null` — read from localStorage key `study-goals`
- `saveStudyGoal(goal: StudyGoal): void` — write + dispatch `study-goals-updated` event
- `clearStudyGoal(): void` — remove goal
- `computeDailyProgress(goal, sessions, studyLog): GoalProgress` — compute today's progress
  - Time metric: sum `session.duration` for sessions with `startTime` today
  - Session metric: count distinct sessions started today
- `computeWeeklyProgress(goal, sessions, studyLog): GoalProgress` — compute current week progress
  - Same logic but for Monday-Sunday (or Sunday-Saturday) of current week
- `computeWeeklyAdherence(goal, studyLog): WeeklyAdherence` — calculate adherence %
  - Count days in last 7 with `lesson_complete` actions in study-log
  - Formula: `(daysStudied / 7) * 100`

**Key files to reference:**
- `src/lib/studyLog.ts` — localStorage pattern, `getActionsPerDay()`, `toLocalDateString()`
- `src/stores/useSessionStore.ts` — `sessions[]` with `duration`, `startTime`

---

## Task 2: Goal Configuration Dialog (`src/app/components/StudyGoalConfigDialog.tsx`)

A Dialog component for setting/editing study goals. Opens from CTA button or edit action.

**Structure:**
- Step 1: Choose frequency (daily / weekly) — two radio-style cards
- Step 2: Choose metric (time in minutes / session count) — two radio-style cards
- Step 3: Set numeric target — input with preset suggestions (30/60/90 min or 1/2/3 sessions)
- Save button commits to localStorage via `saveStudyGoal()`

**Pattern to follow:** `StudyStreakCalendar.tsx` uses Dialog for freeze day configuration. Follow same Dialog + trigger pattern.

**data-testids:** `goal-frequency-daily`, `goal-frequency-weekly`, `goal-metric-time`, `goal-metric-sessions`, `goal-target-input`, `goal-save-button`

---

## Task 3: Study Goals Widget (`src/app/components/StudyGoalsWidget.tsx`)

Dashboard widget with two states: empty and active.

**Empty State** (no goal configured):
- Card with illustration/icon, motivational text, CTA button "Set a Study Goal"
- `data-testid="study-goals-widget"`, `data-testid="goals-empty-state"`, `data-testid="goals-setup-cta"`

**Active State** (goal configured):
- Reuse `ProgressRing` component (`src/app/components/figma/ProgressRing.tsx`) for circular progress
- Text showing "45 / 60 min" or "2 / 3 sessions"
- Weekly adherence percentage below the ring
- Completion indicator (checkmark overlay on ring) when goal met
- Edit button to re-open config dialog

**data-testids:** `goal-progress-indicator`, `goal-progress-text`, `goal-adherence-percentage`, `goal-completed-indicator`

**Real-time updates:** Subscribe to `study-log-updated` custom event (same pattern as `StudyStreakCalendar`):
```ts
useEffect(() => {
  const refresh = () => { /* recompute progress */ }
  window.addEventListener('study-log-updated', refresh)
  return () => window.removeEventListener('study-log-updated', refresh)
}, [])
```

---

## Task 4: Dashboard Integration (`src/app/pages/Overview.tsx`)

Add `StudyGoalsWidget` to the **Engagement Zone**, alongside the streak calendar.

**Current layout:**
```
Engagement Zone: [StudyStreakCalendar (3fr)] [RecentActivity (2fr)]
```

**New layout option — add goals widget between streak and activity:**
```
Engagement Zone: [StudyStreakCalendar (3fr)] [StudyGoalsWidget + RecentActivity stacked (2fr)]
```

Or create a new section between Metrics Strip and Engagement Zone for the goals widget. The exact placement is a design choice to make during implementation based on visual balance.

---

## Task 5: Update Test Fixtures

Add `study-goals` to the `STORAGE_KEYS` array in `tests/support/fixtures/local-storage-fixture.ts` so E2E tests can seed and clean up goal data.

---

## Task 6: Unit Tests (`src/lib/__tests__/studyGoals.test.ts`)

Test the pure computation functions:
- `computeDailyProgress` with various session/log combinations
- `computeWeeklyProgress` across week boundaries
- `computeWeeklyAdherence` with different activity patterns
- Edge cases: no sessions, goal just created, exactly at target, over target
- `saveStudyGoal` / `getStudyGoal` localStorage round-trip

---

## Implementation Order

1. **Task 1** — Study goals library (types + localStorage + pure computation)
2. **Task 6** — Unit tests for the library (TDD: write tests alongside functions)
3. **Task 2** — Goal configuration dialog
4. **Task 3** — Study goals widget (empty state + active state + progress ring)
5. **Task 4** — Dashboard integration in Overview.tsx
6. **Task 5** — Update test fixtures
7. **Verify** — Run ATDD E2E tests to confirm all ACs pass

Make granular commits after each task as save points.

---

## Key Files

| File | Action |
|------|--------|
| `src/lib/studyGoals.ts` | **Create** — goal types, localStorage CRUD, progress computation |
| `src/lib/__tests__/studyGoals.test.ts` | **Create** — unit tests |
| `src/app/components/StudyGoalConfigDialog.tsx` | **Create** — configuration form |
| `src/app/components/StudyGoalsWidget.tsx` | **Create** — dashboard widget |
| `src/app/pages/Overview.tsx` | **Modify** — add widget to dashboard |
| `src/app/components/figma/ProgressRing.tsx` | **Reuse** — circular progress display |
| `src/lib/studyLog.ts` | **Reuse** — `getActionsPerDay()`, `toLocalDateString()`, custom event pattern |
| `src/stores/useSessionStore.ts` | **Reuse** — `sessions[]` for time-based progress |
| `tests/support/fixtures/local-storage-fixture.ts` | **Modify** — add `study-goals` key |
| `tests/e2e/story-e05-s03.spec.ts` | **Already created** — ATDD acceptance tests |

---

## Verification

1. `npm run build` — no TypeScript or build errors
2. `npx vitest run src/lib/__tests__/studyGoals.test.ts` — unit tests pass
3. `npx playwright test tests/e2e/story-e05-s03.spec.ts` — all 9 ATDD tests pass
4. Manual check: visit `/` → see empty state → set goal → see progress ring → study → see update
