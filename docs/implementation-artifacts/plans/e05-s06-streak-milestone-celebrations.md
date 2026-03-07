# E05-S06: Streak Milestone Celebrations — Implementation Plan

## Context

Epic 5's final story. Stories 5-1 through 5-5 are all `done`. The streak system uses localStorage via `src/lib/studyLog.ts` with a `study-log-updated` CustomEvent for cross-component reactivity. `canvas-confetti` and Sonner are already installed and patterned in the codebase (`AchievementBanner.tsx`, `CompletionModal.tsx`).

**Goal**: When a learner's streak reaches 7, 30, 60, or 100 days, show a celebratory Sonner toast with a milestone badge and confetti animation. Persist milestones so they can be viewed in a gallery. Support repeat milestones after streak resets. Respect `prefers-reduced-motion`.

## Implementation Tasks

### Task 1: Streak milestone data layer
**Files**: `src/lib/streakMilestones.ts` (new), `src/data/types.ts`

- Add `StreakMilestone` type to `src/data/types.ts`:
  ```ts
  interface StreakMilestone {
    id: string           // UUID
    milestoneValue: number // 7, 30, 60, 100
    earnedAt: string     // ISO 8601
    streakId: number     // which streak instance (1st, 2nd, etc.)
  }
  ```
- Create `src/lib/streakMilestones.ts` — localStorage-based (consistent with all other streak data):
  - Storage key: `streak-milestones`
  - `getMilestones(): StreakMilestone[]`
  - `addMilestone(value: number): StreakMilestone`
  - `getUnceledMilestones(currentStreak: number): number[]` — returns milestone values reached by current streak that haven't been celebrated in this streak instance
  - `checkAndCelebrate(currentStreak: number): void` — detects uncelebrated milestones, fires toasts + confetti, persists
  - Streak instance tracking: increment `streakId` counter each time streak resets to 0 (compare current streak's start with milestone dates)

**Design decision**: Use localStorage instead of Dexie/IndexedDB because:
1. All other streak data (log, pause, freeze, longest) uses localStorage
2. Milestone data is small (max ~20 records ever)
3. Simpler read/write — no async, no schema migration
4. Consistent with the parse-once pattern in `studyLog.ts`

### Task 2: Milestone detection hook
**Files**: `src/lib/streakMilestones.ts`, `src/app/components/StudyStreakCalendar.tsx`

- In `StudyStreakCalendar.tsx`, hook into the existing `study-log-updated` event listener
- After `refreshSnapshot()`, call `checkAndCelebrate(snapshot.currentStreak)`
- Also check on mount (initial load) to catch milestones from the current session
- The `checkAndCelebrate` function handles:
  1. Get current streak from snapshot
  2. Determine which milestones are reached (7, 30, 60, 100)
  3. Check if each has been celebrated in the current streak instance
  4. For uncelebrated ones: fire toast + confetti, persist milestone

### Task 3: Celebration toast with milestone badge
**Files**: `src/app/components/celebrations/StreakMilestoneToast.tsx` (new)

- Custom Sonner toast via `toast.custom()` with a React component
- Badge design per tier:
  - 7 days: Bronze/copper theme, flame icon
  - 30 days: Silver theme, star icon
  - 60 days: Gold theme, trophy icon
  - 100 days: Diamond/purple theme, crown icon
- Each badge gets `data-testid="milestone-badge-{value}"`
- Toast duration: 8 seconds (longer than default — celebration should be savored)
- Reuse existing gradient patterns from `AchievementBanner.tsx`

### Task 4: Confetti animation
**Files**: `src/app/components/celebrations/StreakMilestoneToast.tsx`

- Use `canvas-confetti` (already installed) — follow `AchievementBanner.tsx` pattern:
  ```ts
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!prefersReducedMotion) {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: [...] })
  }
  ```
- Scale intensity by tier (7d = modest, 100d = spectacular)
- No animation when `prefers-reduced-motion: reduce` — badge still shows in toast

### Task 5: Milestone collection gallery
**Files**: `src/app/components/MilestoneGallery.tsx` (new), `src/app/components/StudyStreakCalendar.tsx`

- Gallery component showing all 4 milestones (7, 30, 60, 100):
  - Earned: full color badge + date achieved (may have multiple dates for repeats)
  - Unearned: dimmed/locked placeholder with `data-testid="milestone-badge-{value}-locked"`
- Access point: button/link in `StudyStreakCalendar.tsx` near the streak counter
  - `data-testid="milestone-collection-trigger"`
  - Opens a Dialog/Popover with the gallery
- For repeated milestones: show all achievement dates

## Key Files

| File | Action |
|------|--------|
| `src/data/types.ts` | Add `StreakMilestone` interface |
| `src/lib/streakMilestones.ts` | New — milestone storage + detection logic |
| `src/app/components/celebrations/StreakMilestoneToast.tsx` | New — custom toast badge component |
| `src/app/components/MilestoneGallery.tsx` | New — collection view component |
| `src/app/components/StudyStreakCalendar.tsx` | Add milestone check + gallery trigger |
| `tests/e2e/story-e05-s06.spec.ts` | Already created (ATDD) |

## Reusable Code

- `canvas-confetti` pattern: `src/app/components/AchievementBanner.tsx:50-58`
- Sonner custom toast: `import { toast } from 'sonner'` + `toast.custom()`
- `getStreakSnapshot()`: `src/lib/studyLog.ts:352` — parse-once for current streak
- `study-log-updated` event: already listened in `StudyStreakCalendar.tsx`
- Dialog component: `src/app/components/ui/dialog.tsx`
- Badge component: `src/app/components/ui/badge.tsx`
- Gradient card styling: `AchievementBanner.tsx:76` (amber/orange gradients)

## Verification

1. `npm run build` — no TypeScript errors
2. `npx playwright test tests/e2e/story-e05-s06.spec.ts --project chromium` — all ATDD tests pass
3. Manual: seed study-log with 7+ consecutive days, reload Overview → toast + confetti appears
4. Manual: set `prefers-reduced-motion: reduce` in DevTools → toast appears, no confetti
5. Manual: click milestone collection trigger → gallery shows earned + locked badges
