# E06-S03: Challenge Milestone Celebrations — Implementation Plan

## Context

E06-S01 created learning challenges with a `celebratedMilestones: number[]` field reserved for this story. E06-S02 added progress tracking via `refreshAllProgress()`. This story adds celebratory feedback (toasts, confetti, visual state transitions) when challenges cross 25%, 50%, 75%, and 100% thresholds.

The existing streak milestone system (E05-S06) provides a proven pattern: `streakMilestones.ts` → `StreakMilestoneToast.tsx` → called from `StudyStreakCalendar.tsx`.

## Tasks

### Task 1: Challenge milestone detection logic
**File:** `src/lib/challengeMilestones.ts` (new)

- Define `CHALLENGE_MILESTONES = [25, 50, 75, 100]`
- Define tier config for each threshold (label, icon, colors, confetti config):
  - 25%: "25% Complete" — Sprout/seedling theme (green tones)
  - 50%: "Halfway There" — Star theme (blue tones)
  - 75%: "Almost There" — Rocket theme (amber tones)
  - 100%: "Challenge Complete" — Trophy theme (gold/purple tones, high particle count)
- `detectChallengeMilestones(challenge: Challenge, newProgress: number): number[]` — compares `(newProgress / targetValue) * 100` against thresholds, filters out already-celebrated milestones from `challenge.celebratedMilestones`

### Task 2: Challenge milestone toast component
**File:** `src/app/components/celebrations/ChallengeMilestoneToast.tsx` (new)

Mirror `StreakMilestoneToast.tsx`:
- Accept `{ challengeName, milestone, tierConfig }` props
- Render gradient card with icon, label, and supportive message
- Fire `confetti()` in `useEffect` (gated by `prefers-reduced-motion`)
- Use `data-testid="challenge-milestone-badge-{percent}"` for test targeting

### Task 3: Integrate milestone detection into store
**File:** `src/stores/useChallengeStore.ts` (modify)

In `refreshAllProgress()`, after calculating new progress for each challenge:
1. Call `detectChallengeMilestones(challenge, currentProgress)` to get uncelebrated thresholds
2. If milestones detected, update `celebratedMilestones` array on the challenge object
3. Return milestone data so the caller (Challenges page) can fire toasts
4. Add new method: `refreshAllProgressWithMilestones()` → returns `Map<string, number[]>` (challengeId → newMilestones)

Alternatively (simpler): modify `refreshAllProgress()` to return the milestone data directly, and have the page fire toasts.

### Task 4: Fire toasts from Challenges page
**File:** `src/app/pages/Challenges.tsx` (modify)

After `refreshAllProgress()` completes:
1. Check returned milestone data
2. For each challenge with new milestones, fire `toast.custom()` with `ChallengeMilestoneToast`
3. Stagger sequential toasts with `setTimeout` delays (500ms between) for simultaneous milestones
4. Use `sessionStorage` guard to prevent re-firing on same page session (pattern from `StudyStreakCalendar.tsx`)

### Task 5: Completed challenge visual treatment
**File:** `src/app/pages/Challenges.tsx` (modify `ChallengeCard`)

When `challenge.completedAt` is set:
- Add gold accent border/background (e.g., `border-amber-400 bg-amber-50/30`)
- Show checkmark overlay on the progress area
- Move completed challenges to a "Completed" section (new collapsible section, similar to "Expired")

Update the grouping logic: `active` | `completed` | `expired`

### Task 6: Reduced-motion support
Already handled by the confetti guard in ChallengeMilestoneToast (`prefers-reduced-motion` check). No extra work — toast content remains visible, only confetti is suppressed.

## Key Files

| File | Action |
|------|--------|
| `src/lib/challengeMilestones.ts` | **Create** — detection logic + tier config |
| `src/app/components/celebrations/ChallengeMilestoneToast.tsx` | **Create** — toast component |
| `src/stores/useChallengeStore.ts` | **Modify** — return milestone data from `refreshAllProgress` |
| `src/app/pages/Challenges.tsx` | **Modify** — fire toasts, add completed section, gold accent on completed cards |
| `tests/e2e/story-e06-s03.spec.ts` | Already created (ATDD tests) |

## Reuse

- `canvas-confetti` — already installed
- `sonner` toast — already configured
- `prefers-reduced-motion` pattern — copy from `StreakMilestoneToast.tsx`
- `TierConfig` interface — reuse structure from `streakMilestones.ts`
- `persistWithRetry` — for DB writes
- `ChallengeCard` styling patterns — extend existing component

## Verification

1. `npm run build` — no type errors
2. `npx playwright test tests/e2e/story-e06-s03.spec.ts --project=chromium` — ATDD tests pass
3. Manual testing: create challenge, seed progress to cross thresholds, verify toasts appear
4. Test reduced-motion: `Cmd+Shift+P` → "Emulate CSS prefers-reduced-motion" in DevTools
5. Test simultaneous: progress jump from 0% to 80% should show 25%, 50%, 75% toasts sequentially
