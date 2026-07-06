---
title: "feat: Surface Continue-Learning primitives on Learning Tracks page"
type: feat
status: active
date: 2026-07-06
confidence: 90
---

# feat: Surface Continue-Learning primitives on Learning Tracks page

## Overview

The Learning Tracks page (`/learning-tracks`) renders a flat grid of `LearningPathCard` components with no sort order and no "continue learning" affordance above the fold. The infrastructure to fix this already exists — `ContinueLearningPathSection` (rendered on `Overview.tsx`), `useMultiPathProgress` (computes `estimatedRemainingHours`, `completedCourses`, `totalLessons`), and `useNextBestCourse` (returns `entry`, `course`, `action`, `targetLessonId`) — but none of it is wired to this page. This plan adds four surgical changes totaling ~30 lines to transform the page from a track gallery into a learning dashboard.

## Problem Frame

A user lands on `/learning-tracks` and sees a grid of cards. In-progress tracks are visually indistinguishable from untouched ones (identical card layout, no sort order). The page answers "What tracks do I have?" but not "Where should I continue?" The `+{n}` badge on avatar stacks (`+13`, `+65`) reads as a notification count rather than "N more course thumbnails."

All the data and components needed to fix this are already built and tested — they just aren't rendered on this page.

## Requirements Trace

- **R1.** Render `ContinueLearningPathSection` between the header and the track grid on `LearningTracks.tsx` — identical to how `Overview.tsx` renders it. The component already handles: empty state (renders null), primary path card, expandable secondary paths, progress bars, and "Continue"/"Start" CTAs.
- **R2.** Sort the track grid: in-progress (1-99%) first, then not-started (0%), then completed (100%). Within each tier, sort by `updatedAt` descending.
- **R3.** Show a one-line "Next: {courseName}" label on the `LearningPathCard` — data already flows through `useNextBestCourse` inside `TrackCard` but is only used for CTA button text.
- **R4.** Replace the `+{courseCount - 3}` avatar-overflow badge with readable text: `+{n} more` — or remove it entirely since the course count badge already says `{n} courses`.
- **R5.** All styling must use design tokens from `src/styles/theme.css`. Zero hardcoded Tailwind colors.

## Scope Boundaries

- `ContinueLearningPathSection` is rendered as-is — no modifications to the component itself
- Grid card visual design (gradient header, progress ring, CTA button) is preserved — no redesign
- No new hooks, no new data model changes, no new Dexie queries
- No changes to `Overview.tsx` or the Dashboard page
- No "Discover / Organize" section with three panels — the existing collapsible template section stays
- No `difficulty`, `lessonCount`, or `lastStudiedAt` on the grid card — those belong on the detail page

### Out of Scope

- Card redesign (density, layout, visual refresh)
- "Discover / Organize" multi-panel section
- Sidebar improvements
- Responsive card variants
- Page-level stats row (can be added later using `useMultiPathProgress` data already available)

## Context & Research

### Relevant Code and Patterns

- **`src/app/components/ContinueLearningPathSection.tsx`** — 270-line component with `PathResumeCard`, expandable "N more paths" list, `useMultiPathProgress`, and `deriveNextCourse` helper. Already handles empty states (renders null). Currently only rendered on `Overview.tsx` line 238.
- **`src/app/pages/LearningTracks.tsx`** — 530-line page component. Uses `useMultiPathProgress` (line 192) but only extracts `completionPct` from the result (line 201). Uses `useNextBestCourse` inside `TrackCard` (line 59) but only for CTA button text. Grid renders `filteredPaths` with no sort order (line 398-416).
- **`src/app/components/learning-path/LearningPathCard.tsx`** — 250-line card component. `+{courseCount - 3}` badge on line 205 is the avatar overflow. No "next item" line rendered despite `action.courseName` being available in the parent.
- **`src/app/hooks/usePathProgress.ts`** — `PathProgressSummary` already includes `estimatedRemainingHours`, `completedCourses`, `totalCourses`, `totalLessons`, `completedLessons`. Only `completionPct` is consumed on the Learning Tracks page.
- **`src/app/hooks/useNextBestCourse.ts`** — Returns `{ entry, course, action, targetLessonId }`. `course.name` is available but not rendered as "Next:" text.
- **`src/data/types.ts`** — `LearningPath` already has `difficultyLabel`, `estimatedHours`, `updatedAt`. `createdAt` available for sorting.
- **`src/styles/theme.css`** — Design token system: `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-brand`, `text-brand-foreground`, `border-border`, `bg-muted`. ESLint `design-tokens/no-hardcoded-colors` blocks hardcoded colors at save-time.

### Institutional Learnings

- `docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md` — Original plan that built `useNextBestCourse`, `ContinueLearningPathSection`, and path card "Continue" buttons. Confirms all infrastructure exists and is tested.
- `.claude/rules/styling.md` — Design token cheat sheet. Hardcoded colors (`bg-blue-600`, `text-slate-500`) are blocked by ESLint.
- `.claude/rules/automation.md` — ESLint rules active at save-time. `design-tokens/no-hardcoded-colors` is ERROR level.

## Key Technical Decisions

- **Render the existing component, don't rebuild it.** `ContinueLearningPathSection` is tested, handles all edge cases (null when no actionable paths exist), and is already wired to the correct stores. Adding it to `LearningTracks.tsx` is a 2-line import + 3-line render block.
- **Sort in a `useMemo`, not in the store.** The sort is view-layer logic — it doesn't change the canonical path order in Zustand. A `useMemo` wrapping `filteredPaths` with a tiered sort (in-progress → not-started → completed, then `updatedAt` desc) is correct and cheap.
- **Pass `courseName` as a prop, not a new hook call.** `TrackCard` already calls `useNextBestCourse` and has `footerAction.courseName`. Add it as a prop to `LearningPathCard` rather than calling the hook again inside the card.
- **Design tokens only.** The `text-xs text-muted-foreground` approach for the "Next:" label uses semantic tokens instead of hardcoded colors.
- **No new Dexie queries, no new API calls.** Every data point used (progress, next course, path metadata) is already loaded by existing hooks.

## Implementation Units

- [ ] **Unit 1: Add `ContinueLearningPathSection` to Learning Tracks page**

**Goal:** Render the existing "Continue Learning Paths" section above the track grid, transforming the page from a flat gallery to a dashboard.

**Requirements:** R1

**Dependencies:** None (component already exists and is tested)

**Files:**
- Modify: `src/app/pages/LearningTracks.tsx`

**Approach:**
1. Add import: `import { ContinueLearningPathSection } from '@/app/components/ContinueLearningPathSection'`
2. After the header block (after the `</motion.div>` closing the header on line ~299) and inside the `userPaths.length > 0` guard, render:
   ```tsx
   {userPaths.length > 0 && (
     <motion.div variants={fadeUp}>
       <ContinueLearningPathSection />
     </motion.div>
   )}
   ```
3. The component already handles: null when no actionable paths, primary card + expandable secondary, progress bars, "Continue"/"Start" CTAs. No additional wiring needed.

**Verification:**
- Page renders the section when paths with in-progress courses exist
- Section renders nothing (null) when no paths have actionable courses
- Build + lint + typecheck pass

- [ ] **Unit 2: Sort track grid by activity**

**Goal:** Surface active tracks first so the page guides users toward their next action rather than displaying a flat unsorted list.

**Requirements:** R2

**Dependencies:** Unit 1 (no code dependency, but logical ordering — sort matters more when the Continue section is present)

**Files:**
- Modify: `src/app/pages/LearningTracks.tsx`

**Approach:**
1. Add a `sortedFilteredPaths` memo between `filteredPaths` (line 247) and the grid render (line 398):
   ```tsx
   const sortedFilteredPaths = useMemo(() => {
     return [...filteredPaths].sort((a, b) => {
       const pctA = pathStats.get(a.id)?.completionPct ?? 0
       const pctB = pathStats.get(b.id)?.completionPct ?? 0
       // Tier: in-progress (1-99) → not-started (0) → completed (100+)
       const tier = (pct: number) => pct === 0 ? 1 : pct >= 100 ? 2 : 0
       const tierDiff = tier(pctA) - tier(pctB)
       if (tierDiff !== 0) return tierDiff
       return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
     })
   }, [filteredPaths, pathStats])
   ```
2. Replace `filteredPaths.map(...)` with `sortedFilteredPaths.map(...)` in the grid render.

**Verification:**
- In-progress tracks appear before not-started tracks
- Completed tracks appear last
- Within each tier, recently updated tracks appear first
- Build + lint + typecheck pass

- [ ] **Unit 3: Show "Next: {courseName}" on the LearningPathCard**

**Goal:** Give users a one-line preview of what to study next without clicking into the track detail page.

**Requirements:** R3

**Dependencies:** None (data already flows through `TrackCard`)

**Files:**
- Modify: `src/app/pages/LearningTracks.tsx` (`TrackCard` function — pass `nextCourseName` prop)
- Modify: `src/app/components/learning-path/LearningPathCard.tsx` (add optional `nextCourseName` prop + render)

**Approach:**
1. Add optional `nextCourseName?: string` to `LearningPathCardProps` interface.
2. In `LearningPathCard`, render below the description (or above the separator) when `nextCourseName` is present:
   ```tsx
   {nextCourseName && (
     <p className="text-xs text-muted-foreground truncate mt-1">Next: {nextCourseName}</p>
   )}
   ```
3. In `TrackCard` (LearningTracks.tsx), pass `footerAction?.courseName` as `nextCourseName` prop — already computed in the `footerAction` memo.

**Verification:**
- Card shows "Next: Course Name" when a next course exists
- Card shows nothing when no next course (completed or empty)
- Truncation works for long course names
- Build + lint + typecheck pass (no design-token violations)

- [ ] **Unit 4: Fix `+{n}` avatar overflow badge**

**Goal:** Replace the confusing `+13`/`+65`/`+15` badges with readable text or remove them entirely.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/learning-path/LearningPathCard.tsx`

**Approach:**
Option A (recommended — simplest): Remove the overflow badge entirely. The course count badge already says `{n} courses`. The avatar stack of 3 thumbnails is decorative.
- Delete lines 203-206 (the `{courseCount > 3 && ...}` block).

Option B (if avatar stack context is desired): Replace the badge with inline text:
```tsx
{courseCount > 3 && (
  <span className="text-xs text-muted-foreground ml-1">+{courseCount - 3} more</span>
)}
```

**Verification:**
- Cards with >3 courses no longer show a tiny `+{n}` badge
- Cards with ≤3 courses are unaffected
- Build + lint + typecheck pass (no design-token violations)

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `ContinueLearningPathSection` renders poorly on the Learning Tracks page (designed for Overview dashboard context) | Low | Low | Component uses `bg-card`, `border-border/50`, `rounded-xl` — same tokens as the card grid. No Overview-specific layout assumptions. |
| Sort order regresses E2E tests that assume a specific card order | Low | Medium | E2E specs should use `data-purpose="learning-path-card"` selectors + text content matching, not positional indexing. Run `npm run test:e2e` to verify. |
| `nextCourseName` prop adds visual clutter to already-dense cards | Low | Low | One line of `text-xs text-muted-foreground` is minimal. If it feels crowded, remove without side effects — the prop is optional. |

## Verification

```bash
npm run build     # Must pass (esbuild + Tailwind)
npm run lint      # Must pass (design-tokens/no-hardcoded-colors is ERROR)
npx tsc --noEmit  # Must pass (catches type regressions esbuild misses)
npm run test:unit # Must pass
```

## Terminal Deliverable

A PR that transforms `/learning-tracks` from a flat unsorted card gallery into a dashboard with: a "Continue Learning Paths" section above the fold, activity-sorted track cards, one-line "Next:" previews, and no confusing `+{n}` badges — all using existing infrastructure with ~30 lines of new/changed code.
