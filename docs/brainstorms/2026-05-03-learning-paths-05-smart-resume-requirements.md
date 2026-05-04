---
date: 2026-05-03
topic: learning-paths-smart-resume
parent: docs/ideation/2026-05-03-learning-paths-creation-ideation.md
---

# Smart Resume — The Path-to-Learning Bridge

## Problem Frame

Learning paths currently function as a management destination — users create and organize paths, but the path system doesn't actively guide them back to learning. A user who creates a path, adds courses, and leaves the detail page has no lightweight re-entry point. They must navigate to the path list, open the detail page, find the right course, and click "Start" — 4 steps to resume learning. The data to solve this already exists: `usePathProgress` computes per-path completion, `useMultiPathProgress` computes cross-path stats, and `LearningPathEntry.position` defines the canonical order. What's missing is the "Continue" primitive that bridges path organization and course consumption.

## Requirements

### Next Best Course Hook

- **R1.** Create `useNextBestCourse(pathId: string)` hook that returns: the earliest in-progress course (progress > 0% and < 100%), or the next unstarted course in position order, or `null` if the path is complete. Return shape: `{ entry: LearningPathEntry | null, course: Course | null, action: 'resume' | 'start' | 'complete' }`.
- **R2.** The hook must reactively update when course progress changes — if the user completes a course in the player and returns to a surface showing "Continue", the button should now point to the next course.

### Overview Dashboard Surface

- **R3.** Add a "Continue Learning" section to the Overview dashboard that shows the next best course from the user's most recently active path. Display: path name (small, muted), course title (prominent), progress percentage (if in-progress), and a "Continue" button.
- **R4.** If the user has multiple paths with in-progress courses, show the most recently active path first, with a "N more paths in progress" link that expands to show all.
- **R5.** The Overview section uses the existing dashboard card pattern (`Card` component, consistent spacing) and appears in a logical position (near the top, alongside streak/activity summary).

### Path List Card Surface

- **R6.** On the path list page (`LearningPaths.tsx`), each `PathCard` that has an in-progress or next-unstarted course shows a "Continue" button in the card footer. The button label adapts: "Continue 'Course Name'" (in-progress) or "Start 'Course Name'" (unstarted).
- **R7.** Clicking "Continue" navigates directly to the lesson player for that course, bypassing the path detail page. This is the key UX shortcut: 1 click instead of 4.
- **R8.** Path cards for fully completed paths show a "Review" button instead of "Continue", linking to the path detail page with a completion summary.

### Post-Completion Continuity

- **R9.** After completing a course in the lesson player (celebration modal → auto-advance or manual dismiss), if the course belongs to a path, show a "Next in path: [Course Name]" suggestion below the celebration content. Clicking it navigates to that course.
- **R10.** If the completed course was the last in its path, show "Path complete! View your achievement" linking to the path detail with completion stats.

### Cross-Path Resume (Stretch)

- **R11.** Create `useNextBestPath(userId: string)` hook that ranks all in-progress paths by: recent activity (last opened), proximity to completion (closest to 100%), and total path length. Returns the single best path to resume.
- **R12.** Surface the cross-path recommendation on the Overview dashboard (the primary "Continue" card) and as the first item in the path list (pinned to top with a "Resume" badge).

## Success Criteria

- A user who pauses mid-course in a path can resume that exact course from the Overview dashboard in 1 click
- The "Continue" button on a path card navigates directly to the lesson player, not the path detail page
- After completing a course in the player, the next path course is suggested within the celebration modal
- `useNextBestCourse` returns a result in under 10ms (pure computation from existing store data, no network)
- The Overview "Continue Learning" section gracefully handles: no paths, all paths complete, and multiple in-progress paths
- Path card "Continue" button updates immediately when course progress changes (reactive store subscription)

## Scope Boundaries

- `useNextBestCourse` is a read-only hook — it does not modify path or course state
- The Overview dashboard surface is a new section, not a redesign of the entire dashboard
- No changes to how progress is computed (`usePathProgress` and `useMultiPathProgress` are consumed as-is)
- The lesson player's post-completion behavior is extended, not redesigned — the celebration modal gets an additional suggestion row
- Cross-path resume (R11-R12) is stretch scope — can be deferred to a follow-up without blocking the core feature

## Key Decisions

- **Position-order as the default heuristic:** "Next best" defaults to the earliest in-progress or unstarted course by `position` order. This is simple, predictable, and matches the path creator's intent. Alternative heuristics (time-estimate-based, difficulty-based) can be added later as user preferences.
- **Direct navigation to player (bypass detail page):** The "Continue" button goes straight to the course player. The path detail page is for management (editing, reordering, AI suggestions). The "Continue" button is for learning. This separation keeps each surface focused.
- **Single-path focus over cross-path:** The core UX is per-path "Continue." Cross-path ranking (R11-R12) is useful but adds complexity (ranking algorithm, staleness, user confusion about which path they're resuming). Start with per-path and evaluate demand.
- **Overview section placement:** Near the top, alongside or just below the streak/activity summary. Not above critical metrics, not buried at the bottom.

## Dependencies / Assumptions

- `usePathProgress` computes `completionPct` per course — verified in existing tests
- `useMultiPathProgress` returns per-path aggregates — verified in existing tests
- `LearningPathEntry.position` is maintained correctly by the store (no gaps, no duplicates)
- The Overview dashboard page (`Overview.tsx`) has a defined component structure where a new section can be inserted
- The lesson player's celebration modal (`CourseCompletedModal` or equivalent) has a known render point for the "next in path" suggestion
- React Router navigation to the lesson player accepts course ID and optionally path ID as params

## Outstanding Questions

### Resolve Before Planning

- None yet — ideation provides sufficient clarity.

### Deferred to Planning

- [Affects R1] How should `useNextBestCourse` handle courses where progress is >0% but the user hasn't touched them in weeks? Should there be a "stale" threshold that skips to the next unstarted course?
- [Affects R3] What is the exact design for the Overview "Continue Learning" section? Does it use a horizontal card carousel (multiple paths) or a single prominent card (best path only)?
- [Affects R6] On the path list page, should the "Continue" button replace the existing path card footer content, or sit alongside existing actions?
- [Affects R9] Should the post-completion "next in path" suggestion auto-advance (with a countdown, like the existing auto-advance) or be a static link the user clicks at their own pace?
- [Affects R11] Cross-path ranking: which factors matter most? Recent activity, completion %, total remaining time, or path creation date?

## Next Steps

-> Ready for `/ce:plan`. Low complexity, high confidence — the data pipeline already exists, this is a UI composition task.
