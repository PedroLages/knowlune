---
title: "feat: Bridge Learning Paths to Schedule, Challenges, and Reports"
type: feat
status: active
date: 2026-05-04
origin: docs/brainstorms/2026-05-03-learning-paths-06-path-as-study-plan-requirements.md
---

# feat: Bridge Learning Paths to Schedule, Challenges, and Reports

## Overview

Wire learning path progress data into three existing mature systems -- Study Schedule, Challenges, and Reports -- via the `learningPathId` FK that was designed for this bridge but never connected. Each sub-idea (A: Plan My Week, B: Path Milestones, C: Path Analytics) is independently shippable and composes existing infrastructure with path progress data from `usePathProgress` and `useMultiPathProgress`.

## Problem Frame

A user who creates a learning path and studies diligently has no schedule integration, no achievement recognition for path progress, and no analytics view of their path-level learning patterns. The three destination systems (Study Schedule, Challenges, Reports) are mature and tested but lack any awareness of learning paths. The bridge data (`learningPathId` on schedules, path progress hooks) already exists; only the wiring is missing.

(see origin: docs/brainstorms/2026-05-03-learning-paths-06-path-as-study-plan-requirements.md)

## Requirements Trace

- R1. "Plan My Week" button on path detail page pre-fills Study Schedule creation form from `usePathProgress.estimatedRemainingHours`
- R2. Pre-filled schedule presented as editable preview; user must explicitly confirm before save
- R3. After saving, "View Schedule" link replaces the button, navigating to a schedule view filtered to the path
- R4. Button shows "Path complete" (disabled) when no remaining hours
- R5. Define `pathMilestone` challenge type with 4 tiered achievements (25/50/75/100%)
- R6. Milestone challenges fire automatically when `usePathProgress.completionPct` crosses thresholds
- R7. Milestone challenge cards show path name, milestone %, progress bar, badge/icon
- R8. If user jumps from 20% to 60%, all intermediate milestones (25%, 50%) fire in sequence
- R9. Challenge detail view shows mini progress timeline with 4 milestones
- R10. Add "Learning Paths" tab to Reports page consuming `useMultiPathProgress` data
- R11. Tab includes: stacked bar chart (completion % groups), line chart (cumulative hours over time), stats table
- R12. Each path in table links to detail page; charts support existing tooltip/legend patterns
- R13. Reports date range filter applies to path analytics (note: filter infrastructure must be built)

## Scope Boundaries

- Plan My Week produces a one-time schedule preview -- no recurring generation, no calendar sync
- Path milestones are 4 fixed tiers -- no custom percentages, no per-path configuration
- Path analytics reuse existing recharts components -- no new chart types, no CSV export
- The `learningPathId` FK already exists on `StudySchedule` -- no migration needed
- No external calendar integration (Google, Apple)
- No predictive analytics -- descriptive only

### Deferred to Separate Tasks

- CSV export for path analytics: extend existing Reports export pattern in a future iteration
- Recurring schedule generation from path progress: separate feature if user demand justifies it
- Per-path customizable milestone percentages: separate enhancement

## Context & Research

### Relevant Code and Patterns

- **Study Schedule store**: `src/stores/useStudyScheduleStore.ts` -- `addSchedule`, `updateSchedule`, `getSchedulesForCourse`, `getSchedulesForDay`. Has `learningPathId` FK on `StudySchedule` type but no path-based query getter.
- **Study Schedule editor**: `src/app/components/figma/StudyScheduleEditor.tsx` -- Sheet-based form accepting `courseId`, `scheduleId`, `open`, `onOpenChange`. Supports title, course, days, start time, duration, reminder fields.
- **Study Schedule widget**: `src/app/components/StudyScheduleWidget.tsx` -- personalized schedule recommendations on Overview page. Not a schedule list view.
- **Challenge store**: `src/stores/useChallengeStore.ts` -- `addChallenge`, `refreshAllProgress`, `loadChallenges`, `deleteChallenge`. `ChallengeType = 'completion' | 'time' | 'streak' | 'books' | 'pages'` -- no `pathMilestone` type yet.
- **Challenge progress**: `src/lib/challengeProgress.ts` -- `calculateProgress` dispatches by type. `src/lib/challengeMilestones.ts` -- `detectChallengeMilestones` uses `CHALLENGE_MILESTONES = [25, 50, 75, 100]`.
- **Challenge toast**: `src/app/components/celebrations/ChallengeMilestoneToast.tsx` -- existing toast celebration component.
- **Reports page**: `src/app/pages/Reports.tsx` -- uses `Tabs` (shadcn/ui) with `study`, `quizzes`, `ai` tabs via URL search params. Charts via recharts `BarChart`, `AreaChart` inside `ChartContainer`. No date range filter currently exists.
- **Chart components**: `src/app/components/ui/chart.tsx` -- shadcn/ui chart primitives wrapping recharts. Supports `BarChart`, `AreaChart`, `LineChart` (via recharts).
- **Path progress hooks**: `src/app/hooks/usePathProgress.ts` -- `usePathProgress(entries)` returns `PathProgressSummary` with `completionPct`, `completedLessons`, `totalLessons`, `completedCourses`, `totalCourses`, `estimatedRemainingHours`, `courseProgress`. `useMultiPathProgress(pathEntries)` returns `Map<string, PathProgressSummary>`.
- **Path detail page**: `src/app/pages/LearningPathDetail.tsx` -- renders header with progress stats, TrailMap, sortable course list, sidebar with "Suggest Order", "Add Course", "Import Course". Uses `usePathProgress` for progress data.
- **Learning path store**: `src/stores/useLearningPathStore.ts` -- `paths`, `entries`, `getEntriesForPath`.
- **Data types**: `src/data/types.ts` -- `StudySchedule` has `learningPathId?: string` (line 537), `Challenge` has `type: ChallengeType` and `celebratedMilestones: number[]`.
- **Routes**: `src/app/routes.tsx` -- Reports at `/reports` with tab query params. Learning path detail at `/learning-paths/:pathId`. No dedicated schedule list page exists.

### Institutional Learnings

- No `docs/solutions/` entries directly relevant to this feature. The existing patterns for tabs (Reports), challenge progress (challengeMilestones), and sheet-based editors (StudyScheduleEditor) are well-established and should be followed.

### External References

- Recharts stacked bar chart: `BarChart` with multiple `<Bar stackId="a">` children
- The codebase already uses recharts directly, so no new dependencies

## Key Technical Decisions

- **Add `pathMilestone` to `ChallengeType` union** rather than creating a separate challenge system: The existing `calculateProgress`/`detectChallengeMilestones` pipeline and toast infrastructure can be reused with a new calculator. This avoids duplicating the achievement system.
- **Trigger milestones from `usePathProgress` reactive effect** rather than the `refreshAllProgress` loop: Path progress is computed in React hooks and changes infrequently. A `useEffect` in a new milestone watcher hook can compare previous and current `completionPct` and fire `detectChallengeMilestones` accordingly. This is simpler than integrating into the generic `refreshAllProgress` which knows nothing about learning paths.
- **Use existing `StudyScheduleEditor` sheet** for the Plan My Week preview: Rather than building a new form, pass pre-filled props to the existing editor component. The key change is adding a multi-entry batch creation mode (or repeatedly calling `addSchedule` in a loop).
- **Add "Learning Paths" as a 4th Reports tab** following the existing pattern: `VALID_TABS` array extended with `'paths'`, new `TabsTrigger` and `TabsContent` added. Path tab reuses the same `ChartContainer`/recharts patterns as the study tab.
- **Build a lightweight date range filter for Reports** (required by R13): The current Reports page has no date filter. Since R13 requires filter support, add a simple `DateRangePicker` or two-date-input filter that filters path data by activity within the range. This becomes a shared component for the Reports page.

## Output Structure

```
src/
  app/
    components/
      reports/
        PathAnalyticsTab.tsx          # NEW: Path analytics tab content (charts + table)
        DateRangeFilter.tsx           # NEW: Shared date range filter for Reports tabs
      challenges/
        PathMilestoneCard.tsx         # NEW: Milestone challenge card with path progress bar
        PathMilestoneTimeline.tsx     # NEW: Mini progress timeline for challenge detail
      learning-path/
        PlanMyWeekButton.tsx          # NEW: Plan My Week button + schedule preview logic
    hooks/
      usePathMilestones.ts            # NEW: Hook to watch path progress and fire milestones
    pages/
      LearningPathDetail.tsx          # MODIFY: Add Plan My Week button
      Reports.tsx                     # MODIFY: Add Learning Paths tab + date range filter
  lib/
    challengePathMilestones.ts        # NEW: Path milestone progress calculator
  stores/
    useStudyScheduleStore.ts          # MODIFY: Add getSchedulesForPath + batch add
    useChallengeStore.ts              # MODIFY: No changes needed (milestones use existing add)
  data/
    types.ts                          # MODIFY: Add 'pathMilestone' to ChallengeType
```

## Implementation Units

### Phase 1: Prerequisites and Sub-Idea B (Path Milestones) -- lowest risk, ships first

- [ ] **Unit 1: Add `pathMilestone` challenge type and milestone calculator**

**Goal:** Extend the challenge type system to support path milestone challenges and add the progress calculator.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/data/types.ts` (add `'pathMilestone'` to `ChallengeType`)
- Create: `src/lib/challengePathMilestones.ts` (path milestone progress calculator)
- Modify: `src/lib/challengeProgress.ts` (add `pathMilestone` case to `calculateProgress` dispatch)
- Create: `src/lib/__tests__/challengePathMilestones.test.ts`

**Approach:**
- Add `'pathMilestone'` to the `ChallengeType` union in `src/data/types.ts` (currently `'completion' | 'time' | 'streak' | 'books' | 'pages'`)
- Create `calculatePathMilestoneProgress` in `src/lib/challengePathMilestones.ts`: accepts a `pathId` and queries `usePathProgress`-equivalent logic against Dexie to compute aggregate path progress. Returns a percentage (0-100) as the progress value.
- Wire into `calculateProgress` dispatch so `refreshAllProgress` can compute it generically
- The challenge's `targetValue` is 100 (representing 100% completion). Milestone tiers (25/50/75) are detected by the existing `detectChallengeMilestones` function.

**Patterns to follow:**
- `src/lib/challengeProgress.ts` -- existing calculator dispatch pattern
- `src/lib/challengeMilestones.ts` -- existing milestone detection (CHALLENGE_MILESTONES = [25, 50, 75, 100])

**Test scenarios:**
- Happy path: `calculatePathMilestoneProgress({ pathId: 'p1' })` returns 50 when 2 of 4 courses are completed
- Happy path: Returns 0 when no courses have progress
- Happy path: Returns 100 when all courses are complete
- Edge case: Empty path (no entries) returns 0
- Edge case: Mixed catalog and imported course entries handled correctly
- Integration: `calculateProgress({ type: 'pathMilestone', ... })` dispatches to the new calculator

**Verification:**
- `ChallengeType` includes `'pathMilestone'`
- New calculator returns correct aggregate percentage
- No type errors in `calculateProgress` dispatch

---

- [ ] **Unit 2: Create path milestone watcher hook and milestone challenge cards**

**Goal:** Automatically fire milestone challenges when path completion crosses thresholds, and render milestone-specific UI.

**Requirements:** R6, R7, R8, R9

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/hooks/usePathMilestones.ts`
- Create: `src/app/components/challenges/PathMilestoneCard.tsx`
- Create: `src/app/components/challenges/PathMilestoneTimeline.tsx`
- Modify: `src/app/pages/Challenges.tsx` (render `PathMilestoneCard` for `pathMilestone` type)
- Create: `src/app/hooks/__tests__/usePathMilestones.test.ts`

**Approach:**
- `usePathMilestones` hook:
  - Takes `pathId`, `pathName`, and the current `completionPct` from `usePathProgress`
  - On mount or when `completionPct` changes, checks if any `pathMilestone` challenges exist for this path in the challenge store
  - If no challenge exists yet, creates one via `useChallengeStore.addChallenge` with `type: 'pathMilestone'`, `name: pathName`, `targetValue: 100`
  - Uses a ref to track previous `completionPct`; on change, detects which thresholds were crossed
  - For each crossed threshold, updates challenge progress and fires milestone detection
  - Handles R8 by checking ALL thresholds between previous and current percent (not just the highest)
- `PathMilestoneCard`: Renders a challenge card specific to path milestones showing path name, milestone %, progress bar, and badge/icon using `CHALLENGE_TIER_CONFIG`
- `PathMilestoneTimeline`: Renders the 4 milestone tiers as a mini timeline with checkmarks (completed) and progress indicators (current)
- `Challenges.tsx` modification: Detect `pathMilestone` type challenges and render `PathMilestoneCard` instead of generic challenge card

**Patterns to follow:**
- `src/app/hooks/usePathProgress.ts` -- hook pattern with reactive progress tracking
- `src/lib/challengeMilestones.ts` -- `CHALLENGE_TIER_CONFIG` for milestone icon/gradient/confetti config
- `src/app/components/challenges/CreateChallengeDialog.tsx` -- existing challenge creation UI

**Test scenarios:**
- Happy path: Completing 25% of a path creates a pathMilestone challenge with progress 25 and fires "25% Complete" milestone
- Happy path: Completing 50% fires both 25% and 50% milestones
- Happy path: Completing 100% fires all 4 milestones and marks challenge complete
- Edge case: Jumping from 20% to 60% fires 25% and 50% milestones in sequence (R8)
- Edge case: Challenge already exists for path -- does not duplicate
- Edge case: Challenge already at 50% when path reaches 60% -- only new thresholds fire
- Error path: Challenge creation fails with toast
- Integration: Milestone toast fires via existing `ChallengeMilestoneToast` component
- Integration: `achievement:unlocked` event emitted when challenge completes (100%)

**Verification:**
- Creating a path and completing 25% of courses triggers a milestone notification
- Completing 100% shows all 4 milestones with proper toast and confetti
- Challenge card renders with path name and progress bar
- Timeline shows checkmarks for completed tiers

---

### Phase 2: Sub-Idea A (Plan My Week)

- [ ] **Unit 3: Add batch schedule creation and path-based schedule filtering**

**Goal:** Extend the Study Schedule store to support creating multiple schedule entries at once and filtering schedules by learning path.

**Requirements:** R1, R2, R3

**Dependencies:** None (independent of Units 1-2)

**Files:**
- Modify: `src/stores/useStudyScheduleStore.ts` (add `getSchedulesForPath` getter and `addSchedules` batch method)
- Create: `src/stores/__tests__/useStudyScheduleStore.test.ts` (if not existing) or modify existing

**Approach:**
- Add `getSchedulesForPath(pathId: string): StudySchedule[]` -- filters schedules by `learningPathId`
- Add `addSchedules(schedules: Array<Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>>)` -- batches creation of multiple schedules. Implements via sequential `addSchedule` calls (the store uses `syncableWrite` which handles per-row persistence). Alternatively, wrap in a single try/catch with rollback on any failure.
- Fills `learningPathId` on each created schedule entry

**Patterns to follow:**
- `src/stores/useStudyScheduleStore.ts` -- existing `addSchedule`, `getSchedulesForCourse` patterns
- `src/lib/sync/syncableWrite.ts` -- syncable write pattern for persistence

**Test scenarios:**
- Happy path: `addSchedules` with 3 entries creates 3 schedules
- Happy path: `getSchedulesForPath('p1')` returns only schedules with `learningPathId === 'p1'`
- Edge case: `addSchedules` with empty array is a no-op
- Error path: One schedule fails to persist -- previously created ones remain (or rollback depending on implementation choice)

**Verification:**
- Batch creation produces correct number of Dexie rows
- Path-based filter returns correct subset
- No regression on existing `addSchedule` behavior

---

- [ ] **Unit 4: Plan My Week button and schedule preview on path detail**

**Goal:** Add a "Plan My Week" button to the path detail page that pre-fills a multi-entry schedule preview and navigates to the schedule view after save.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 3

**Files:**
- Create: `src/app/components/learning-path/PlanMyWeekButton.tsx`
- Modify: `src/app/pages/LearningPathDetail.tsx` (integrate button in header/sidebar area)
- Modify: `src/app/components/figma/StudyScheduleEditor.tsx` -- not used by PlanMyWeekPreview directly; the preview is a standalone dialog. StudyScheduleEditor may optionally be reused for per-entry editing within the preview
- Create: `src/app/components/learning-path/PlanMyWeekPreview.tsx` (editable schedule preview dialog/sheet -- new dedicated component, not a modification of StudyScheduleEditor)
- Create: `src/app/components/learning-path/__tests__/PlanMyWeekButton.test.tsx`

**Approach:**
- `PlanMyWeekButton`:
  - Reads `usePathProgress` summary (specifically `estimatedRemainingHours`, `completedCourses`, `totalCourses`, `courseProgress`)
  - If `estimatedRemainingHours === 0`, renders disabled "Path complete" button (R4)
  - On click, opens a `PlanMyWeekPreview` dialog/sheet
- `PlanMyWeekPreview`:
  - Auto-populates schedule entries from path data:
    - Title: `"Study: {path.name}"` for each course
    - One schedule entry per incomplete course
    - Days: assigned to weekdays (Mon-Fri), one course per day
    - Duration: estimated from `estimatedRemainingHours / incompleteCourseCount`, rounded to nearest 15min, min 30min
    - Start time: defaults to `"09:00"`
  - Shows each entry as an editable row (title, day, start time, duration can be modified)
  - User must click "Save Schedule" to confirm -- no auto-commit (R2)
  - On save, calls `addSchedules` from Unit 3 with `learningPathId: pathId`
  - After save, shows success toast and renders "View Schedule" link (R3)
- Integration in `LearningPathDetail.tsx`:
  - Place "Plan My Week" button in the sidebar area below the "Suggest Order" card
  - Use `pathProgress.estimatedRemainingHours` to control enabled/disabled state

**Patterns to follow:**
- `src/app/components/figma/StudyScheduleEditor.tsx` -- Sheet-based editor pattern
- `src/app/pages/LearningPathDetail.tsx` -- sidebar button layout (e.g., Suggest Order card at line 1095)

**Test scenarios:**
- Happy path: Path with 10 remaining hours and 5 incomplete courses pre-fills 5 weekday entries at ~2h each
- Happy path: User edits day assignments and durations, saves, schedules are created
- Happy path: "View Schedule" link appears after save
- Edge case: Path with 0 remaining hours shows "Path complete" (disabled)
- Edge case: Path with 1 incomplete course creates 1 schedule entry
- Edge case: All courses complete -- no entries generated, button disabled
- Error path: Save fails -- entries not persisted, error toast shown
- Integration: Created schedules appear in `getSchedulesForPath` query

**Verification:**
- "Plan My Week" button visible on path detail page
- Clicking opens preview with correct auto-populated data
- Editing and saving creates real schedule entries
- "Path complete" shown when fully done

---

- [ ] **Unit 5: Schedule view for path schedules**

**Goal:** Provide a view where the user can see schedules created for a specific learning path, accessible via the "View Schedule" link.

**Requirements:** R3

**Dependencies:** Unit 3, Unit 4

**Files:**
- Create: `src/app/components/learning-path/PathScheduleList.tsx`
- Modify: `src/app/pages/LearningPathDetail.tsx` (integrate list or toggle)

**Approach:**
- `PathScheduleList`: Simple card list displaying schedule entries for the path
  - Fetches via `useStudyScheduleStore.getSchedulesForPath(pathId)` (memoized)
  - Each entry shows: title, course name, day(s), start time, duration
  - Rendered inline on the path detail page (collapsible section) rather than a separate route -- this avoids adding a new route for a simple list
  - "View Schedule" button in `PlanMyWeekButton` toggles visibility of this list
- The list also supports basic editing (click an entry opens `StudyScheduleEditor` in edit mode) and deletion

**Patterns to follow:**
- `src/app/pages/LearningPathDetail.tsx` -- collapsible sections pattern
- `src/app/components/figma/StudyScheduleEditor.tsx` -- edit mode support

**Test scenarios:**
- Happy path: After creating schedules, "View Schedule" link toggles the schedule list
- Happy path: List shows all entries for the path with correct course names and times
- Edge case: No schedules for path -- list shows empty state
- Integration: Clicking an entry opens StudyScheduleEditor in edit mode
- Integration: Deleting an entry removes it from the list

**Verification:**
- Schedule list renders with correct entries after Plan My Week
- Editing and deleting work from the list view

---

### Phase 3: Sub-Idea C (Path Analytics in Reports)

- [ ] **Unit 6: Add date range filter component to Reports**

**Goal:** Build a reusable date range filter for the Reports page that applies to path analytics and can be extended to other tabs.

**Requirements:** R13

**Dependencies:** None (independent of other units)

**Files:**
- Create: `src/app/components/reports/DateRangeFilter.tsx`
- Modify: `src/app/pages/Reports.tsx` (integrate filter, pass range to tab contents)

**Approach:**
- `DateRangeFilter`: Two date inputs (from/to) or a preset selector ("Last 7 days", "Last 30 days", "Last 90 days", "All time")
  - Uses `date-fns` (already a dependency) for date formatting
  - Controlled component: `{ from: Date | null, to: Date | null }` state
  - Renders as a toolbar row above the tab content
  - Default: "All time" (no filter applied)
- Reports integration: Lift filter state to Reports page level and pass `dateRange` to each `TabsContent` via props or context

**Patterns to follow:**
- `src/app/pages/Reports.tsx` -- existing state management patterns (per-section error states)
- shadcn/ui `Input` with `type="date"` or reuse existing `DatePicker` if available

**Test scenarios:**
- Happy path: Selecting "Last 30 days" filters data correctly
- Happy path: "All time" shows unfiltered data
- Edge case: From date after To date -- validation prevents
- Edge case: Future dates -- clamped to today

**Verification:**
- Date range filter renders and controls date window
- Filter state propagates to tab contents

---

- [ ] **Unit 7: Path Analytics tab in Reports**

**Goal:** Add a "Learning Paths" tab to the Reports page with three visualizations consuming `useMultiPathProgress` data.

**Requirements:** R10, R11, R12, R13

**Dependencies:** Unit 6 (date range filter)

**Files:**
- Create: `src/app/components/reports/PathAnalyticsTab.tsx`
- Modify: `src/app/pages/Reports.tsx` (add 'paths' tab, integrate `PathAnalyticsTab` with date range)
- Create: `src/app/components/reports/__tests__/PathAnalyticsTab.test.tsx`

**Approach:**
- `PathAnalyticsTab`:
  - Loads all learning paths and their entries via `useLearningPathStore`
  - Computes progress for all paths via `useMultiPathProgress`
  - Applies date range filter by querying study sessions/activity within the range and recalculating progress limited to that window
  - Three visualizations:
    1. **Stacked bar chart** (R11a): Groups paths into 4 completion buckets (0-25%, 25-50%, 50-75%, 75-100%). Uses recharts `BarChart` with multiple `<Bar stackId="a">` elements. Follows existing `ChartContainer` pattern from Reports study tab.
    2. **Line chart** (R11b): Cumulative study hours over time. Computed by querying `db.studySessions` (filtered by `courseId` in path entries, grouped by date). Uses recharts `LineChart` (already used in the codebase at `src/app/components/quiz/ScoreTrajectoryChart.tsx`).
    3. **Stats table** (R11c): Renders a sortable table with columns: path name (link to detail), courses completed/total, hours spent, estimated remaining, last activity date. Uses shadcn/ui `Table` component or simple card-based layout.
  - Each path name links to `/learning-paths/:pathId` (R12)
  - Charts use existing recharts patterns: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, legend toggles (R12)
- Reports integration:
  - Extend `VALID_TABS` to include `'paths'`
  - Add `TabsTrigger value="paths"` to `TabsList`
  - Add `TabsContent value="paths"` rendering `PathAnalyticsTab`
  - Pass `dateRange` to `PathAnalyticsTab`

**Patterns to follow:**
- `src/app/pages/Reports.tsx` -- existing tab pattern, `ChartContainer` + recharts composition
- `src/app/hooks/usePathProgress.ts` -- `useMultiPathProgress` for batch path progress
- `src/app/components/quiz/ScoreTrajectoryChart.tsx` -- existing `LineChart` usage pattern for cumulative study hours
- `src/app/components/reports/AIAnalyticsTab.tsx` -- standalone tab content component pattern to follow

**Test scenarios:**
- Happy path: Tab renders 3 visualizations when paths exist with progress data
- Happy path: Stacked bar chart shows correct bucket distribution
- Happy path: Line chart shows cumulative hours increasing over time
- Happy path: Table rows link to correct path detail pages
- Happy path: Date range filter changes limit data shown in all 3 visualizations
- Edge case: No learning paths exist -- tab shows empty state
- Edge case: Paths exist but no progress -- shows 0% across all visualizations
- Edge case: Single path with 100% completion -- shows correctly in 75-100% bucket
- Integration: Switching to "Learning Paths" tab updates URL search params
- Integration: Chart tooltips and legend toggles work

**Verification:**
- New tab appears in Reports navigation
- All 3 visualizations render with real path data
- Date range filter affects all visualizations
- Path links navigate to correct detail pages

## System-Wide Impact

- **Interaction graph:** Path progress hooks (`usePathProgress`, `useMultiPathProgress`) already exist and are consumed by path detail and list pages. This plan adds new consumers but no new providers.
- **Error propagation:** Challenge milestone creation failures surface via toast (existing pattern). Schedule creation failures roll back via store error handling. Reports tab uses per-section error states following the existing `InlineSectionError` pattern.
- **State lifecycle risks:** Path milestone challenge creation is idempotent (checks for existing challenge before creating). Schedule batch creation uses sequential `addSchedule` calls; partial failure leaves already-created entries (acceptable -- user can delete unwanted entries).
- **API surface parity:** `ChallengeType` union gains `'pathMilestone'` -- any code matching exhaustively on `ChallengeType` must be updated (TypeScript compiler will enforce this).
- **Integration coverage:** Cross-layer scenarios (e.g., "create path -> complete courses -> milestone fires -> schedule created -> reports show stats") span 3 subsystems. Unit tests cover each subsystem; an end-to-end test covering the full flow should be written separately.
- **Unchanged invariants:** Existing challenge types (`completion`, `time`, `streak`, `books`, `pages`) behavior is unchanged. Existing Reports tabs (`study`, `quizzes`, `ai`) are unchanged. Study Schedule store's single-entry `addSchedule` behavior is unchanged (batch adds a new method, not a modification).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `pathMilestone` challenge calculator needs Dexie queries that match `usePathProgress` logic | Follow the exact same logic as `usePathProgress` in the calculator; share a utility function if possible |
| Reports page has no existing date range filter -- R13 assumes one | Plan includes Unit 6 to build the filter. If R13 is de-scoped, Unit 7 still ships without date filtering |
| Batch schedule creation via sequential `addSchedule` calls could fail partway | Each call is independently persisted. If partial failure is unacceptable, wrap in a transaction-like pattern with rollback of already-created entries on any failure |
| `ChallengeType` union change requires exhaustive match updates | TypeScript compiler enforces this at build time; no runtime risk |
| No existing `LineChart` usage in Reports (only `AreaChart` and `BarChart`) | `LineChart` is a recharts component and follows the same API as `AreaChart`; just swap the component name |

## Documentation / Operational Notes

- The `learningPathId` FK on `StudySchedule` already exists in the data model and Dexie schema -- no migration needed
- Path milestone challenges persist via the existing `useChallengeStore` and `syncableWrite` -- they sync to Supabase like other challenges
- Reports Learning Paths tab follows the same URL param pattern as other tabs (`?tab=paths`)

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-03-learning-paths-06-path-as-study-plan-requirements.md](docs/brainstorms/2026-05-03-learning-paths-06-path-as-study-plan-requirements.md)
- Related code:
  - `src/stores/useStudyScheduleStore.ts` -- schedule CRUD and state
  - `src/stores/useChallengeStore.ts` -- challenge CRUD and progress refresh
  - `src/app/pages/Reports.tsx` -- reports page with tabs
  - `src/app/hooks/usePathProgress.ts` -- path progress hooks
  - `src/app/pages/LearningPathDetail.tsx` -- path detail page
  - `src/data/types.ts` -- type definitions
  - `src/lib/challengeProgress.ts` -- challenge progress calculator dispatch
  - `src/lib/challengeMilestones.ts` -- milestone detection and tier config
  - `src/app/components/figma/StudyScheduleEditor.tsx` -- schedule editor sheet
