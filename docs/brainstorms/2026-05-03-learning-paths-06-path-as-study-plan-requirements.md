---
date: 2026-05-03
topic: learning-paths-path-as-study-plan
parent: docs/ideation/2026-05-03-learning-paths-creation-ideation.md
---

# Path as Study Plan — Scheduling, Milestones, and Analytics

## Problem Frame

Knowlune has three mature, tested systems — Study Schedule (`StudySchedule` page, schedule CRUD), Challenges (achievement badges with progress tracking, `useChallengeStore`), and Reports (analytics dashboard with chart components) — that have no connection to learning paths. The `learningPathId` foreign key was designed for exactly this bridge but was never wired. A user who creates a path and studies diligently has no schedule integration, no achievement recognition for path progress, and no analytics view of their path-level learning patterns. Each sub-idea is independently shippable and composes existing infrastructure with path progress data.

## Requirements

### Sub-Idea A: Plan My Week (Schedule Bridge)

- **R1.** Add a "Plan My Week" button to the path detail page that reads `usePathProgress.estimatedRemainingHours` and pre-fills the Study Schedule creation form with: the path name as the schedule title, the remaining courses as scheduled items (one per day, weekdays), and estimated time per session from course duration data.
- **R2.** The pre-filled schedule is presented as an editable preview — the user can adjust days, times, and course order before saving. This is not an auto-commit; the user must explicitly confirm.
- **R3.** After saving the schedule, a "View Schedule" link replaces the "Plan My Week" button, navigating to the Study Schedule page filtered to this path's items.
- **R4.** If the path has no remaining hours (fully complete), the button shows "Path complete" and is disabled.

### Sub-Idea B: Path Milestones as Challenges

- **R5.** Define a new `pathMilestone` challenge type with 4 tiered achievements: "First Steps" (25% path completion), "Halfway There" (50%), "Almost Done" (75%), "Path Complete" (100%).
- **R6.** Milestone challenges fire automatically when `usePathProgress.completionPct` crosses each threshold. The challenge store's existing `evaluateChallenge` pipeline handles unlocking and notification.
- **R7.** Each milestone challenge card shows: the path name, milestone percentage, current progress bar, and the badge/icon awarded.
- **R8.** If a user jumps from 20% to 60% in one session, all intermediate milestones (25%, 50%) fire in sequence — no skipped achievements.
- **R9.** The challenge detail view for a path milestone shows a mini progress timeline: the 4 milestones with checkmarks for completed ones and a progress bar for the current one.

### Sub-Idea C: Path Analytics in Reports

- **R10.** Add a "Learning Paths" tab to the Reports page (`Reports.tsx`) that shows path-level analytics consuming `useMultiPathProgress` data.
- **R11.** The tab includes these visualizations (using existing chart components): (a) stacked bar chart of paths by completion % (grouped: 0-25%, 25-50%, 50-75%, 75-100%), (b) line chart of cumulative study hours across paths over time, (c) table of path completion stats (name, courses completed/total, hours spent, estimated remaining, last activity date).
- **R12.** Each path in the table links to its detail page. Each chart supports the existing chart interaction patterns (tooltips, legend toggles).
- **R13.** The Reports page's existing date range filter applies to path analytics — users can see path progress within a specific time window.

## Success Criteria

- Clicking "Plan My Week" on a path with 10 remaining hours and 5 courses pre-fills a schedule with 5 weekday sessions of ~2 hours each
- Editing and saving the pre-filled schedule creates real schedule entries visible on the Study Schedule page
- Completing 25% of a path triggers a "First Steps" challenge notification (toast + challenge badge update)
- Completing 100% of a path triggers all 4 milestones (if not already triggered) including "Path Complete"
- The Reports "Learning Paths" tab renders 3 visualizations using existing chart components with real path data
- The path analytics tab respects the Reports date range filter
- Each sub-idea is independently shippable — Plan My Week can ship without milestones, milestones without analytics

## Scope Boundaries

- Plan My Week produces a one-time schedule preview — no recurring schedule generation, no calendar sync
- Path milestones are 4 fixed tiers — no custom milestone percentages, no per-path milestone configuration
- Path analytics reuse existing chart components — no new chart types, no export-to-CSV (existing Reports export can be extended later)
- The `learningPathId` FK on schedule entries is assumed to exist in the data model — if not, it's a prerequisite migration
- No integration with external calendar systems (Google Calendar, Apple Calendar)
- No predictive analytics ("you'll finish this path by March 15") — descriptive only

## Key Decisions

- **Plan My Week as pre-fill, not auto-create:** The schedule is pre-filled for user review and edit, not auto-committed. This respects user autonomy over their schedule while reducing the friction of manual entry.
- **Path milestones as universal, not per-path:** The same 4 tiers apply to every path. This is simpler to implement and understand than per-path custom milestones. Paths with different lengths (3 courses vs. 20 courses) still have meaningful 25/50/75/100 thresholds.
- **Reports tab over separate page:** Adding a tab to the existing Reports page reuses the layout, date filter, and navigation pattern. A separate "Path Analytics" page would be disproportionate for the data volume.
- **Independent sub-ideas:** Each sub-idea (A, B, C) touches different systems (schedule, challenges, reports) and has no code dependencies on the others. They can be planned, implemented, and shipped independently.

## Dependencies / Assumptions

- `usePathProgress.estimatedRemainingHours` exists and returns a reasonable estimate (based on course video durations or PDF page counts)
- `useMultiPathProgress` returns per-path aggregates including `completionPct` and `totalHours`
- The Study Schedule store supports creating multiple entries at once (batch schedule creation)
- The Challenges store's `evaluateChallenge` pipeline accepts a `pathMilestone` type and can be triggered programmatically (not just on user action)
- `Reports.tsx` has a tabbed interface where a new tab can be added (or can be extended to support tabs)
- The existing chart components (`src/app/components/ui/chart.tsx`) support bar, line, and table visualizations

## Outstanding Questions

### Resolve Before Planning

- None yet — ideation provides sufficient clarity.

### Deferred to Planning

- [Affects R1] Does `usePathProgress.estimatedRemainingHours` exist? If not, how is it computed — sum of video durations for uncompleted courses, or a heuristic based on course metadata?
- [Affects R1] Study Schedule data model: does a schedule entry have a `learningPathId` FK, or does the bridge happen through course IDs?
- [Affects R5] Challenges data model: does the challenge store support a `pathMilestone` type with a `pathId` parameter, or does a new challenge type need to be added to the schema?
- [Affects R10] Reports tabbed interface: does `Reports.tsx` currently use tabs? If so, what's the tab component and how are tabs configured?
- [Affects R11] Does the existing chart library support stacked bar charts? If not, is a grouped bar chart an acceptable alternative?
- [Affects R11] Where does cumulative study hours data come from? Is there a `studySession` table or is it derived from course progress timestamps?

## Next Steps

-> Ready for `/ce:plan`. Medium-high complexity due to touching 3 systems, but each sub-idea is independently planned. Recommend starting with Sub-Idea B (Path Milestones) as the lowest-risk entry point, then A (Plan My Week), then C (Path Analytics).
