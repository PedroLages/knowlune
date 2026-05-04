---
title: "feat: Bridge Learning Paths to Schedule, Challenges, and Reports"
type: feat
status: active
date: 2026-05-04
origin: docs/brainstorms/2026-05-03-learning-paths-06-path-as-study-plan-requirements.md
deepened: 2026-05-04
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
- R3. After saving, "View Schedule" link replaces the button, toggling an inline schedule list filtered to the path (see Key Technical Decisions for Study Schedule page deviation)
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
- Dedicated Study Schedule page with route and calendared view: the current StudySchedule infrastructure (widget + editor + summary components) has no dedicated page. Building one is out of scope for this plan; the inline collapsible list on the path detail page (Unit 5) provides schedule visibility without a new route. A full schedule list/calendar page would unify schedule viewing across courses and paths.
- Adding `learningPathId` FK to `StudySession` for lossless path filtering: currently sessions are filtered by the courseId set from current path entries, which is lossy for courses that were added/removed after sessions occurred. Tagging sessions at creation time with the active pathId would eliminate this lossiness. Deferred because the analytics use case in this plan does not require this precision.

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
- **Build a lightweight date range filter for Reports** (required by R13): The current Reports page has no date filter. Since R13 requires filter support, add a simple `DateRangePicker` or two-date-input filter. This becomes a shared component for the Reports page.
- **Render path schedules inline rather than navigating to a Study Schedule page** (R3 deviation): The requirements specify navigation to "the Study Schedule page filtered to this path's items," but no Study Schedule page exists in the app -- the StudySchedule infrastructure is widget + editor components (`StudyScheduleWidget`, `StudyScheduleEditor`, `StudyScheduleSummary`) with no dedicated route. Building a full Study Schedule page is out of scope for this plan. Instead, render schedules in an inline collapsible list on the path detail page (Unit 5). A dedicated Study Schedule page is deferred to a separate task.
- **Accept partial creation for batch schedule writes**: `syncableWrite` has no transaction semantics -- each `addSchedule` call independently persists to Dexie and enqueues for sync. There is no way to roll back an already-committed `syncableWrite`. The batch creation will iterate and collect results: entries that succeed are persisted, entries that fail are reported. The UI shows a summary ("5 of 6 entries created") with the option to manually delete unwanted entries. This is pragmatic -- batch creation is user-initiated and infrequent, and the Plan My Week preview is editable before save.
- **Define path-specific milestone labels** distinct from `CHALLENGE_TIER_CONFIG`: The existing `CHALLENGE_TIER_CONFIG` uses generic labels ("25% Complete", "Challenge Complete", "Almost There") that served general challenge progress but do not match the path milestone requirements ("First Steps", "Halfway There", "Almost Done", "Path Complete"). The plan defines a new `PATH_MILESTONE_TIER_CONFIG` with path-specific labels while reusing the same icon, gradient, and confetti infrastructure from the existing config. The `getChallengeTierConfig` function remains unchanged for existing challenge types.
- **Use path-membership-based filtering for StudySession queries** (Reports + cumulative hours): `StudySession` has `courseId` and `contentItemId` but no `learningPathId` FK. To filter sessions by path, look up the current `LearningPathEntry` set for the path, extract the `courseId` list, and query study sessions by those course IDs. This is lossy in two ways: (a) sessions for courses that were later removed from the path will be included, and (b) sessions for courses added to the path after those sessions occurred will be excluded. For analytics purposes, this lossiness is acceptable. Adding a `learningPathId` FK to `StudySession` (tagging sessions at creation time from path context) is a future enhancement for precision.
- **Avoid reconstructing historical point-in-time completion percentages** (Reports date range): The `usePathProgress` hook computes current completion state from `contentProgress`/`progress` tables, which are point-in-time snapshots of the present. Reconstructing what completion percentage a path had on a past date would require replaying StudySession records through the progress model, which is complex, fragile, and not justified for analytics use. The stacked bar chart and stats table in the Reports tab will show current completion only -- the date range filter applies to the cumulative study hours line chart (naturally filterable via `StudySession.startTime`) and to the "last activity" column in the stats table. The stacked bar chart remains unfiltered and represents the current state.

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
        PlanMyWeekButton.tsx          # NEW: Plan My Week button + schedule preview trigger
        PlanMyWeekPreview.tsx         # NEW: Editable multi-entry schedule preview dialog/sheet
        PathScheduleList.tsx          # NEW: Inline list of path schedules
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
    types.ts                          # MODIFY: Add 'pathMilestone' to ChallengeType, optional pathId to Challenge
```

## Implementation Units

### Phase 1: Prerequisites and Sub-Idea B (Path Milestones) -- lowest risk, ships first

- [ ] **Unit 1: Add `pathMilestone` challenge type and milestone calculator**

**Goal:** Extend the challenge type system to support path milestone challenges and add the progress calculator.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/data/types.ts` (add `'pathMilestone'` to `ChallengeType`, add optional `pathId?: string` to `Challenge`)
- Create: `src/lib/challengePathMilestones.ts` (path milestone progress calculator and tier config)
- Modify: `src/lib/challengeProgress.ts` (add `pathMilestone` case to `calculateProgress` dispatch)
- Create: `src/lib/__tests__/challengePathMilestones.test.ts`

**Approach:**
- Add `'pathMilestone'` to the `ChallengeType` union in `src/data/types.ts` (currently `'completion' | 'time' | 'streak' | 'books' | 'pages'`)
- Add optional `pathId?: string` field to the `Challenge` interface in `src/data/types.ts` -- used by `pathMilestone` challenges to associate the challenge with a specific learning path for duplicate detection and progress lookups
- Create `calculatePathMilestoneProgress` in `src/lib/challengePathMilestones.ts`: accepts a `pathId` and queries progress data against Dexie to compute aggregate path progress. Returns a percentage (0-100) as the progress value. Follows the same logic as `usePathProgress` (catalog + imported course progress sources).
- Define `PATH_MILESTONE_TIER_CONFIG` in the same file: a `Record<25 | 50 | 75 | 100, ChallengeTierConfig>` with path-specific labels ("First Steps", "Halfway There", "Almost Done", "Path Complete"). Reuses icons, gradients, and confetti colors from `CHALLENGE_TIER_CONFIG` where appropriate, overriding only the `label` and `message` fields.
- Wire into `calculateProgress` dispatch so `refreshAllProgress` can compute it generically
- The challenge's `targetValue` is 100 (representing 100% completion). The same `CHALLENGE_MILESTONES = [25, 50, 75, 100]` thresholds are reused; `detectChallengeMilestones` is unchanged.

**Patterns to follow:**
- `src/lib/challengeProgress.ts` -- existing calculator dispatch pattern
- `src/lib/challengeMilestones.ts` -- existing milestone detection (CHALLENGE_MILESTONES = [25, 50, 75, 100]) and `ChallengeTierConfig` interface

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
- `PathMilestoneCard`: Renders a challenge card specific to path milestones showing path name, milestone %, progress bar, and badge/icon using a new `PATH_MILESTONE_TIER_CONFIG` with path-specific labels ("First Steps", "Halfway There", "Almost Done", "Path Complete") that override the generic `CHALLENGE_TIER_CONFIG` labels while reusing the same icon, gradient, and confetti infrastructure.
- `PathMilestoneTimeline`: Renders the 4 milestone tiers as a mini timeline with checkmarks (completed) and progress indicators (current). Uses path-specific milestone labels.
- `Challenges.tsx` modification: Detect `pathMilestone` type challenges and render `PathMilestoneCard` instead of generic challenge card

**Patterns to follow:**
- `src/app/hooks/usePathProgress.ts` -- hook pattern with reactive progress tracking
- `src/lib/challengeMilestones.ts` -- `CHALLENGE_TIER_CONFIG` for milestone icon/gradient/confetti config
- `src/app/components/challenges/CreateChallengeDialog.tsx` -- existing challenge creation UI

**Test scenarios:**
- Happy path: Completing 25% of a path creates a pathMilestone challenge with progress 25 and fires "First Steps" milestone
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
- Add `addSchedules(schedules: Array<Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>>)` -- batches creation of multiple schedules via sequential `addSchedule` calls. Each call independently persists through `syncableWrite` (which has no transaction semantics -- there is no way to roll back an already-committed `syncableWrite`).
- **Partial failure strategy:** Collect success/failure per entry. Return a result object `{ created: StudySchedule[], failed: { input: Omit<StudySchedule, ...>, error: string }[] }`. The caller (Unit 4) is responsible for showing a summary toast ("5 of 6 entries created") and offering a way to delete unwanted entries.
- Fills `learningPathId` on each created schedule entry

**Patterns to follow:**
- `src/stores/useStudyScheduleStore.ts` -- existing `addSchedule`, `getSchedulesForCourse` patterns
- `src/lib/sync/syncableWrite.ts` -- syncable write pattern for persistence

**Test scenarios:**
- Happy path: `addSchedules` with 3 entries creates 3 schedules, returns `{ created: [3 entries], failed: [] }`
- Happy path: `getSchedulesForPath('p1')` returns only schedules with `learningPathId === 'p1'`
- Edge case: `addSchedules` with empty array is a no-op, returns `{ created: [], failed: [] }`
- Error path: One schedule fails to persist -- previously created ones remain, result shows `{ created: [2 entries], failed: [1 entry with error] }`

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

- [ ] **Unit 5: Schedule list for path schedules (inline, R3 deviation)**

**Goal:** Provide an inline view of schedules created for a specific learning path, accessible via the "View Schedule" link from Plan My Week. Rendered as a collapsible section on the path detail page rather than navigating to a separate Study Schedule page (which does not exist in the app -- the StudySchedule infrastructure is widget + editor components without a dedicated route).

**Requirements:** R3 (deviation justified -- see Key Technical Decisions: "Render path schedules inline")

**Dependencies:** Unit 3, Unit 4

**Files:**
- Create: `src/app/components/learning-path/PathScheduleList.tsx`
- Modify: `src/app/pages/LearningPathDetail.tsx` (integrate list or toggle)

**Approach:**
- `PathScheduleList`: Simple card list displaying schedule entries for the path
  - Fetches via `useStudyScheduleStore.getSchedulesForPath(pathId)` (memoized)
  - Each entry shows: title, course name, day(s), start time, duration
  - Rendered inline on the path detail page (collapsible section) rather than a separate route -- a dedicated Study Schedule page does not exist in the app, and building one is deferred to a separate task (see Scope Boundaries > Deferred to Separate Tasks)
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
  - **Date range scope:** The date range filter does not attempt to reconstruct historical point-in-time completion percentages (which would require replaying StudySession records through the progress model -- complex, fragile, and not justified for analytics). Instead:
    - **Stacked bar chart and stats table:** Show current completion only. The date range filter does not affect these visualizations. They always represent the present state.
    - **Line chart (cumulative hours):** Naturally filterable. Query `db.studySessions` filtered by `startTime` within the date range, then aggregate hours by date. Since `StudySession` has no `learningPathId` FK, filter by courseId list derived from current path entries (path-membership-based filtering -- lossy but adequate for analytics; see Key Technical Decisions).
    - **Stats table "last activity" column:** Filters to sessions within the date range to compute last activity date per path. Falls back to the most recent session across all time when the date range is "All time."
  - Three visualizations:
    1. **Stacked bar chart** (R11a): Groups paths into 4 completion buckets (0-25%, 25-50%, 50-75%, 75-100%) based on current completion. Not affected by date range filter. Uses recharts `BarChart` with multiple `<Bar stackId="a">` elements. Follows existing `ChartContainer` pattern from Reports study tab.
    2. **Line chart** (R11b): Cumulative study hours over time within the date range. Computed by: (a) extract courseId set from current `LearningPathEntry` rows for each path, (b) query `db.studySessions` filtered by `courseId` in that set AND `startTime` between date range bounds, (c) group by date and aggregate `duration` as hours. Uses recharts `LineChart` (already used in the codebase at `src/app/components/quiz/ScoreTrajectoryChart.tsx`).
    3. **Stats table** (R11c): Renders a sortable table with columns: path name (link to detail), courses completed/total (current), hours spent (from StudySession queries within date range), estimated remaining (current), last activity date (most recent session `startTime` within range). Uses shadcn/ui `Table` component or simple card-based layout.
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
- Happy path: Stacked bar chart shows correct bucket distribution (current completion, not filtered by date range)
- Happy path: Line chart shows cumulative hours increasing over time within the date range, filtered by courseIds from path entries
- Happy path: Table rows link to correct path detail pages
- Happy path: Date range filter changes limit cumulative hours line chart and last activity column; stacked bar chart and completion columns remain current
- Edge case: No learning paths exist -- tab shows empty state
- Edge case: Paths exist but no progress -- shows 0% across all visualizations
- Edge case: Single path with 100% completion -- shows correctly in 75-100% bucket
- Edge case: Path entries changed (courses added/removed) since sessions were recorded -- some sessions for removed courses appear, sessions for newly added courses before they were added do not appear (documented limitation)
- Integration: Switching to "Learning Paths" tab updates URL search params
- Integration: Chart tooltips and legend toggles work

**Verification:**
- New tab appears in Reports navigation
- All 3 visualizations render with real path data
- Date range filter affects cumulative hours line chart and last activity column; stacked bar chart and completion columns show current state (not filtered)
- Path links navigate to correct detail pages

## Open Questions

### Resolved During Planning

- **Date-range-filtered path progress in Reports (R13):** How to show path progress within a date range when progress is computed from current state, not historical snapshots? Resolution: Do not attempt to reconstruct point-in-time completion percentages. The stacked bar chart and completion columns show current state only. The cumulative hours line chart is naturally filterable via `StudySession.startTime`. The "last activity" column filters to sessions within the date range.
- **R3 "Study Schedule page" navigation target:** The requirements specify navigating to a dedicated Study Schedule page, but no such page exists in the app. Resolution: Render schedules inline as a collapsible list on the path detail page. Building a dedicated Study Schedule page is deferred to a separate task.
- **Batch schedule rollback with syncableWrite:** `syncableWrite` has no transaction semantics -- how to handle partial failures? Resolution: Accept partial creation. The `addSchedules` method returns success/failure per entry; the caller shows a summary toast and offers deletion of unwanted entries.
- **Milestone labels:** Requirements specify "First Steps" (25%), "Halfway There" (50%), "Almost Done" (75%), "Path Complete" (100%) but `CHALLENGE_TIER_CONFIG` uses different labels. Resolution: Define a new `PATH_MILESTONE_TIER_CONFIG` with the path-specific labels, reusing icon/gradient/confetti from the existing config.
- **StudySession FK for path filtering:** `StudySession` has `courseId` but no `learningPathId` FK -- how to filter study activity by path? Resolution: Use path-membership-based filtering (extract courseId set from current `LearningPathEntry` rows). Acknowledge lossiness for courses added/removed after sessions occurred. Adding `learningPathId` FK to `StudySession` is deferred to a separate task.

### Deferred to Implementation

- Exact shape of the shared progress utility extracted from `usePathProgress` for the challenge calculator
- Whether `PATH_MILESTONE_TIER_CONFIG` is defined as a full `Record<25 | 50 | 75 | 100, ChallengeTierConfig>` or as label-only overrides merged with `CHALLENGE_TIER_CONFIG` at runtime
- Whether the date range filter component reuses existing `DatePicker` (if available) or uses native `<input type="date">` elements
- The exact Dexie query patterns for cumulative study hours aggregation (single query vs. per-path queries -- decided after measuring performance with real data volumes)

## System-Wide Impact

- **Interaction graph:** Path progress hooks (`usePathProgress`, `useMultiPathProgress`) already exist and are consumed by path detail and list pages. This plan adds new consumers but no new providers.
- **Error propagation:** Challenge milestone creation failures surface via toast (existing pattern). Schedule creation failures roll back via store error handling. Reports tab uses per-section error states following the existing `InlineSectionError` pattern.
- **State lifecycle risks:** Path milestone challenge creation is idempotent (checks for existing challenge before creating). Schedule batch creation uses sequential `addSchedule` calls via `syncableWrite` which has no transaction semantics; partial failure leaves already-created entries (accepted -- the UI reports which entries failed and offers manual deletion of unwanted entries).
- **API surface parity:** `ChallengeType` union gains `'pathMilestone'` -- any code matching exhaustively on `ChallengeType` must be updated (TypeScript compiler will enforce this). `Challenge` interface gains optional `pathId` -- existing challenge code ignores the new field; only `pathMilestone` type challenges populate it.
- **Integration coverage:** Cross-layer scenarios (e.g., "create path -> complete courses -> milestone fires -> schedule created -> reports show stats") span 3 subsystems. Unit tests cover each subsystem; an end-to-end test covering the full flow should be written separately.
- **Unchanged invariants:** Existing challenge types (`completion`, `time`, `streak`, `books`, `pages`) behavior is unchanged. Existing Reports tabs (`study`, `quizzes`, `ai`) are unchanged. Study Schedule store's single-entry `addSchedule` behavior is unchanged (batch adds a new method, not a modification).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `pathMilestone` challenge calculator needs Dexie queries that match `usePathProgress` logic | Follow the exact same logic as `usePathProgress` in the calculator; extract a shared utility function that both `usePathProgress` and `calculatePathMilestoneProgress` can call |
| Reports page has no existing date range filter -- R13 assumes one | Plan includes Unit 6 to build the filter. If R13 is de-scoped, Unit 7 still ships without date filtering |
| Batch schedule creation via sequential `addSchedule` calls could fail partway -- `syncableWrite` has no transaction semantics, so rollback is impossible after each call commits | Accept partial creation as the pragmatic approach. The batch method returns which entries succeeded and failed. The caller (Unit 4) shows a summary toast and offers a way to delete unwanted entries |
| Date range filter cannot reconstruct historical point-in-time completion percentages (StudySession records track activity, not completion state at past dates) | Stacked bar chart and stats table show current completion only -- not affected by date range. Line chart (cumulative hours) is naturally filterable via `StudySession.startTime`. Document limitation explicitly in the plan |
| `StudySession` has no `learningPathId` FK -- filtering by path requires looking up courseIds from current `LearningPathEntry` rows, which is lossy for courses added/removed after sessions occurred | Path-membership-based filtering is adequate for analytics. The lossiness is documented. Adding `learningPathId` FK to `StudySession` is deferred to a separate task |
| `ChallengeType` union change requires exhaustive match updates | TypeScript compiler enforces this at build time; no runtime risk |
| No existing `LineChart` usage in Reports (only `AreaChart` and `BarChart`) | `LineChart` is a recharts component and follows the same API as `AreaChart`; just swap the component name |
| No dedicated Study Schedule page exists in the app -- R3 specifies navigation to one, but the infrastructure is widget + editor components without a route | Implement an inline collapsible schedule list on the path detail page instead. Building a full Study Schedule page is deferred to a separate task |

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
