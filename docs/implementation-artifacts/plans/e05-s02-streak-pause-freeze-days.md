# E05-S02: Streak Pause & Freeze Days — Implementation Plan

## Context

E05-S01 (Daily Study Streak Counter) shipped a localStorage-based streak system with a pause/vacation mode dialog. E05-S02 extends this with two features:

1. **Streak pause/resume toggle** — Replace the current "Pause Streak" dialog (which sets a timed vacation) with a simple toggle that pauses/resumes instantly. The current implementation uses a `days` field — E05-S02 needs an instant on/off toggle instead.
2. **Freeze days** — Let learners configure 1-3 days of the week as "rest days" where streak doesn't reset if no study occurs.

## Key Files

| File | Change |
|------|--------|
| `src/lib/studyLog.ts` | Extend data model, streak evaluation logic |
| `src/app/components/StudyStreakCalendar.tsx` | Pause toggle UI, freeze day settings UI |
| `tests/support/fixtures/local-storage-fixture.ts` | Add `study-streak-freeze-days` to STORAGE_KEYS |
| `src/lib/__tests__/studyLog.test.ts` | Unit tests for freeze day + pause logic |
| `tests/e2e/story-e05-s02.spec.ts` | Already created (ATDD) |

## Implementation Tasks

### Task 1: Extend data model in `studyLog.ts`

**Freeze days storage** — new localStorage key `study-streak-freeze-days`:
```typescript
const FREEZE_DAYS_KEY = 'study-streak-freeze-days'

interface FreezeDaysConfig {
  freezeDays: number[]  // Day indices: 0=Sun, 1=Mon, ..., 6=Sat. Max 3.
}

export function getFreezeDays(): number[]
export function setFreezeDays(days: number[]): void
```

**Pause model change** — The existing `StreakPause` with `days` field works for timed vacation. For the toggle behavior in AC1-2, reuse the same key but treat a very large `days` value (e.g., 99999) as "indefinite pause", or simplify: just use `enabled: true/false` and ignore `days` for the toggle. On resume, call `clearStreakPause()`.

Decision: Keep `StreakPause` as-is. The toggle will `setStreakPause(99999)` for pause and `clearStreakPause()` for resume. The existing `currentStreakFromDays` already handles this — when `daysSincePause < pause.days`, it preserves the streak.

### Task 2: Update streak evaluation in `studyLog.ts`

Modify `currentStreakFromDays()` to accept freeze days and check them:

1. If streak is paused (`pause.enabled && daysSincePause < pause.days`): return streak from yesterday (existing behavior). **Freeze logic is suspended** (AC7).
2. If NOT paused: when walking backwards through days, if a day has no activity but is a configured freeze day, **skip it** (don't break the streak). A freeze day with activity counts as a regular day (AC5).

Update `getStreakSnapshot()` to include freeze days config in the snapshot for the UI.

Extend `StreakSnapshot`:
```typescript
export interface StreakSnapshot {
  currentStreak: number
  longestStreak: number
  activity: Array<{ date: string; hasActivity: boolean; lessonCount: number; isFreezeDay: boolean }>
  pauseStatus: StreakPause | null
  freezeDays: number[]
}
```

### Task 3: Pause toggle UI in `StudyStreakCalendar.tsx`

Replace the current "Pause Streak" button + dialog with a simpler toggle:

- Add `data-testid="streak-pause-toggle"` button
- When NOT paused: shows "Pause Streak" with Pause icon
- When paused: shows "Resume Streak" with Play icon
- On click: toggles between `setStreakPause(99999)` and `clearStreakPause()`
- Add `data-testid="streak-paused-indicator"` — shown when paused (already partially exists as the Alert, but needs testid)

Keep the existing Pause dialog as an option or remove it in favor of the toggle. The toggle is simpler and matches AC1-2 better. Remove the days-based dialog since the toggle replaces it.

### Task 4: Freeze day settings UI in `StudyStreakCalendar.tsx`

Add a "Freeze Days" settings button and dialog:

- `data-testid="freeze-days-settings"` button to open settings
- Dialog with 7 day-of-week buttons (Sun-Sat), each with `data-testid="freeze-day-option"` and `data-selected="true|false"`
- Max 3 selection enforcement: when 3 are selected, clicking a 4th shows validation message (`data-testid="freeze-days-validation"`)
- Save button persists to localStorage via `setFreezeDays()`

### Task 5: Update activity display for freeze days

In the calendar heatmap, freeze days with no activity should be visually distinguishable from regular no-activity days:
- Use a different background color or icon (e.g., a small snowflake or blue-tinted cell)
- This supports AC4's "recorded distinctly in study history"

### Task 6: Update test fixtures

Add `study-streak-freeze-days` to `STORAGE_KEYS` in `tests/support/fixtures/local-storage-fixture.ts` so tests can seed and clean up freeze day config.

### Task 7: Unit tests in `studyLog.test.ts`

Add tests for:
- `getFreezeDays()` / `setFreezeDays()` — CRUD operations
- Streak calculation with freeze days: no activity on freeze day doesn't break streak
- Study on freeze day counts normally
- Max 3 freeze days validation (if enforced at data layer)
- Pause + freeze interaction: freeze suspended during pause

### Task 8: Verify ATDD tests pass

Run `npx playwright test tests/e2e/story-e05-s02.spec.ts --project chromium` and fix any issues.

## Build Sequence

1. Task 1 → Data model (freeze days storage)
2. Task 2 → Streak evaluation logic (depends on Task 1)
3. Task 6 → Test fixture update
4. Task 7 → Unit tests (verify Tasks 1-2)
5. Task 3 → Pause toggle UI
6. Task 4 → Freeze day settings UI
7. Task 5 → Calendar visual distinction
8. Task 8 → ATDD verification

## Patterns to Follow

- **Parse-once**: All data through `getStreakSnapshot()`, no separate calls
- **DST-safe dates**: Use `toLocalDateString()` / `parseLocalDate()` / `setDate(getDate()-1)` — never `Date.now() - 86400000`
- **CustomEvent updates**: Dispatch `study-log-updated` after any state change so UI refreshes
- **Sidebar localStorage seed**: `localStorage.setItem('knowlune-sidebar-v1', 'false')` in E2E `beforeEach`

## Verification

1. `npm run build` — no TypeScript errors
2. `npx vitest run src/lib/__tests__/studyLog.test.ts` — unit tests pass
3. `npm run dev` then `npx playwright test tests/e2e/story-e05-s02.spec.ts --project chromium` — ATDD tests pass
4. Manual check: pause toggle, freeze day selector, streak preserved on freeze day
