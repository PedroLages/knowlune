# Learning Track Detail — Motivational Feedback UX Improvement Plan

**Date:** 2026-07-03 (revised 2026-07-03 after codebase audit)
**Status:** Plan → Implementation
**Scope:** Single focused feature — sessionStorage-based motivational feedback after lesson completion.

---

## Pre-Implementation Audit

A codebase audit on 2026-07-03 confirmed that **~90% of the original plan** was already implemented:

| Feature | Status | Location |
|---|---|---|
| Progression mode toggle ("Free navigation" / "Sequential") | ✅ Built | `src/app/components/learning-path/ProgressionModeToggle.tsx` |
| Progress sidebar with explicit labels + weekly card | ✅ Built | `src/app/components/learning-path/PathProgressSidebar.tsx` |
| ContinueLearningBento with next lesson title, remaining time | ✅ Built | `src/app/components/learning-path/ContinueLearningBento.tsx` |
| Lesson type icons + current lesson highlighting | ✅ Built | `src/app/components/learning-path/TimelinePrimitives.tsx` |
| Multi-section progress sidebar (4 sections) | ✅ Built | `src/app/components/learning-path/PathProgressSidebar.tsx` |
| Tabbed navigation (Overview/Roadmap/Syllabus/Projects/Notes) | ✅ Built | `src/app/pages/LearningTrackDetail.tsx` (lines 670-710) |
| RoadmapPhases component (phase cards, course pills) | ✅ Built | `src/app/components/learning-path/RoadmapPhases.tsx` |
| "Why This Matters" justification expander | ✅ Built | `src/app/components/learning-path/PathTimeline.tsx` (lines 316-324) |
| Hero CTA with "Resume {courseName}" + next lesson subtitle | ✅ Built | `src/app/components/learning-path/PathHeroBanner.tsx` |
| **Motivational feedback with sessionStorage tracking** | ❌ **NOT built** | **This plan** |

**Two minor wiring gaps also identified:**

| Gap | Impact | Included in plan? |
|---|---|---|
| `weeklyStudyMinutes`/`weeklyGoalMinutes` not passed from `LearningTrackDetail` to `PathProgressSidebar` | "This Week" card never shows actual data | Yes — Phase 2 (quick win) |
| Static motivation message (one-liner, no sessionStorage state) | Placeholder only | Yes — Phase 1 (core feature) |

---

## Implementation Plan

### Phase 1: Motivational Feedback with sessionStorage Tracking

**File:** `src/app/pages/LearningTrackDetail.tsx`

#### 1.1 Session-level lesson completion tracking

Create a custom hook `useMotivationalFeedback` that:
- Reads/writes to `sessionStorage` keyed by track ID
- Tracks daily lesson completion counts (reset at midnight)
- Tracks total lessons completed in this session
- Computes appropriate motivational message based on context

**sessionStorage structure** (`knowlune_motivation_{trackId}`):
```json
{
  "date": "2026-07-03",
  "dailyCount": 3,
  "sessionTotal": 5,
  "lastCourseName": "Linux Basics",
  "lastLessonCompletedAt": "2026-07-03T14:30:00Z",
  "trackStartDate": "2026-07-03",
  "streakDays": 1
}
```

#### 1.2 Motivational message variants

Replace the static `<div>` motivation message (current lines ~740-750 in LearningTrackDetail.tsx) with context-aware variants:

| Context | Message template | Icon |
|---|---|---|
| First visit, no lessons done | "Welcome to {trackName}. Your first goal: complete 3 lessons in {currentCourseName}." | `Sparkles` |
| 1 lesson completed today | "Great start! You completed 1 lesson today. Keep the momentum going." | `Zap` |
| 2-4 lessons completed today | "On a roll! You completed {count} lessons today. Next up: {nextLessonTitle}." | `Flame` |
| 5+ lessons completed today | "You're unstoppable! {count} lessons today. Time for a quick break?" | `Trophy` |
| Course recently completed | "Course complete! {courseName} is done. Next: {nextMilestoneName}." | `PartyPopper` or `CheckCircle2` |
| Returning after 1+ days gap | "Welcome back! You last studied {daysAgo} days ago. Pick up where you left off." | `Clock` |
| Returning, streak > 1 day | "{streakDays}-day streak! Keep it going." | `Flame` |

#### 1.3 Message display location

Keep the message in its current position (below ContinueLearningBento, above the grid bottom in the Overview tab). Use the existing `<div className="bg-card rounded-2xl border border-border/50 p-4 shadow-card-ambient">` wrapper.

#### 1.4 Data source

All data computed from existing sources — no new API calls or database stores:
- `currentCourseName`, `nextLessonTitle`: already computed in LearningTrackDetail
- `nextMilestoneName`: already computed
- Lesson completion events: detected by polling `useContentProgressStore.statusMap` changes
- Daily counts: sessionStorage only (cleared on browser close or at midnight)

---

### Phase 2: Wire Weekly Study Data to Sidebar

**File:** `src/app/pages/LearningTrackDetail.tsx`

#### 2.1 Compute weekly study minutes

Use existing `src/lib/studyGoals.ts` (`computeWeeklyProgress`) to derive `weeklyStudyMinutes` and `weeklyGoalMinutes` from the user's study log. Pass these as props to `PathProgressSidebar`.

**Implementation approach:**
- Import `getStudyGoal` and `computeWeeklyProgress` from `@/lib/studyGoals`
- Use `useStudyLogStore` (or equivalent) to get study log entries
- Compute weekly minutes and goal minutes in a `useMemo`
- Pass `weeklyStudyMinutes` and `weeklyGoalMinutes` to `<PathProgressSidebar>`

#### 2.2 Add "Set weekly goal" handler

Wire `onSetWeeklyGoal` to navigate to Settings or open a goal-setting dialog (defer to existing `StudyGoalsWidget` component pattern).

---

## Acceptance Criteria

### AC-1: Session tracking initializes on first visit
**Given** a user navigates to `/learning-tracks/:trackId` for the first time in a browser session
**When** the page loads
**Then** sessionStorage is initialized with `date` set to today, `dailyCount: 0`, `sessionTotal: 0`, `trackStartDate` set to today, and `streakDays: 1`
**And** the motivation message shows the "first visit" variant with the track and course name

### AC-2: Daily counter increments after lesson completion
**Given** a user has completed 0 lessons today
**When** the user completes a lesson (contentProgress status changes to 'completed' for a lesson in the current track)
**Then** `dailyCount` increments to 1
**And** the motivation message updates to the "1 lesson completed today" variant

### AC-3: Daily counter resets at midnight
**Given** a user completed 3 lessons on 2026-07-03, stored in sessionStorage
**When** the user returns to the page on 2026-07-04
**Then** `dailyCount` resets to 0
**And** `date` updates to 2026-07-04
**And** `streakDays` increments to 2
**And** the motivation message shows the returning-user variant

### AC-4: Returning user after gap
**Given** a user's `date` in sessionStorage is 2+ days old
**When** the user returns to the page
**Then** `streakDays` resets to 1
**And** the motivation message shows "Welcome back! You last studied {N} days ago."

### AC-5: Motivation message disappears when no courses remain
**Given** all courses in the track are completed
**When** the page renders
**Then** the motivation message section is not shown (the "All courses completed!" Trophy banner is shown instead, which already exists)

### AC-6: sessionStorage is scoped per track
**Given** a user has `dailyCount: 5` for track A
**When** the user navigates to track B
**Then** track B's sessionStorage is initialized independently (dailyCount starts at 0 for track B)
**And** returning to track A preserves the original `dailyCount: 5`

### AC-7: Weekly study data appears in sidebar (Phase 2)
**Given** a user has completed lessons this week
**When** the page renders
**Then** the "This Week" card shows actual study minutes and progress bar (not the placeholder text "Start studying to track your time.")

### AC-8: All messages use design tokens
**Given** any motivation message variant is displayed
**When** inspecting the DOM
**Then** no hardcoded Tailwind colors (e.g., `text-blue-600`, `bg-green-500`) are present
**And** all colors use design tokens (`text-brand`, `text-success`, `bg-brand-soft`, etc.)

---

## Accessibility Requirements (WCAG 2.1 AA+)

| Requirement | Implementation |
|---|---|
| **1.3.1 Info and Relationships** | Motivation message uses semantic `<section>` with `aria-label="Learning progress"` |
| **1.4.1 Use of Color** | Icons accompany all message variants — color alone does not convey meaning |
| **1.4.3 Contrast (Minimum)** | All text in motivation card meets 4.5:1 contrast ratio against `bg-card` background in both light and dark modes |
| **1.4.10 Reflow** | Message card reflows at 320px width without horizontal scroll |
| **2.1.1 Keyboard** | No interactive elements in the motivation card itself (display-only) |
| **4.1.2 Name, Role, Value** | Icons use `aria-hidden="true"`; message text is in a live region with `aria-live="polite"` so screen readers announce updates |

### Screen Reader Announcements

When the motivation message changes (e.g., after completing a lesson), the update must be announced:
```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="bg-card rounded-2xl border border-border/50 p-4 shadow-card-ambient"
>
  {/* message content */}
</div>
```

### Motion Sensitivity

All icon animations (sparkle, flame, etc.) must respect `prefers-reduced-motion`:
```tsx
const prefersReducedMotion = useReducedMotion()
// Use motion-safe: prefix on animation classes, or skip animation entirely
```

---

## Responsive Design Specs

| Breakpoint | Motivation card behavior |
|---|---|
| **Mobile (< 640px)** | Full width, stacked vertically below ContinueLearningBento. Icon above text, `text-sm` for message. Padding: `p-3`. |
| **Tablet (640px-1023px)** | Full width, horizontal icon+text layout. `text-sm` for message. Padding: `p-4`. |
| **Desktop (≥ 1024px)** | Spans the left 2/3 column (alongside sidebar). Horizontal icon+text. `text-sm` body, `text-base` for bold parts. Padding: `p-4`. |
| **All breakpoints** | Icon: `size-5` (20px). No horizontal scroll. Message text wraps naturally. |

### Card layout for all breakpoints:

```html
<div class="flex items-start gap-3">
  <icon class="size-5 flex-shrink-0 mt-0.5" />
  <p class="text-sm text-foreground/85">
    <strong>Bold lead-in:</strong> rest of message.
  </p>
</div>
```

---

## Files to Modify

| File | Changes |
|---|---|
| `src/app/pages/LearningTrackDetail.tsx` | Add `useMotivationalFeedback` hook, replace static motivation message, wire `weeklyStudyMinutes`/`weeklyGoalMinutes` to sidebar |
| `src/app/hooks/useMotivationalFeedback.ts` | **NEW** — sessionStorage-backed hook for daily lesson counts and message variants |

**No changes needed** (already feature-complete):
- `src/app/components/learning-path/ProgressionModeToggle.tsx`
- `src/app/components/learning-path/ContinueLearningBento.tsx`
- `src/app/components/learning-path/PathTimeline.tsx`
- `src/app/components/learning-path/TimelinePrimitives.tsx`
- `src/app/components/learning-path/PathProgressSidebar.tsx`
- `src/app/components/learning-path/RoadmapPhases.tsx`
- `src/app/components/learning-path/PathHeroBanner.tsx`

---

## Test Scenarios

### Unit Tests (`src/app/hooks/__tests__/useMotivationalFeedback.test.ts` — **NEW**)

| Test | Description |
|---|---|
| `initializes sessionStorage on first visit` | Hook creates the expected key structure when no prior data exists |
| `increments dailyCount when lesson completes` | Calling the increment function bumps dailyCount by 1 |
| `resets dailyCount when date changes` | If stored date ≠ today, dailyCount resets to 0 |
| `maintains streak across consecutive days` | Date differs by exactly 1 day → streakDays increments |
| `resets streak when gap > 1 day` | Date differs by 2+ days → streakDays resets to 1 |
| `scopes storage per track ID` | Different trackId → different sessionStorage key |
| `returns correct message variant for each context` | First visit, 1 done, 2-4 done, 5+ done, returning, streak |
| `returns null message when all courses complete` | All courses at 100% → no message rendered |

### E2E Tests (extend `tests/e2e/learning-track-detail.spec.ts`)

| Test | Description |
|---|---|
| `shows first-visit motivation message on initial load` | Navigate to track → verify "Welcome to" message appears |
| `motivation message updates after completing a lesson` | Mark a lesson complete → verify message changes to reflect count |
| `motivation message persists across tab navigation` | Complete lesson → switch to Roadmap tab → switch back → message preserved |
| `motivation message resets after browser restart simulation` | Set sessionStorage → reload page with cleared sessionStorage → verify first-visit message |

### Accessibility Tests (extend `tests/e2e/learning-track-detail.spec.ts`)

| Test | Description |
|---|---|
| `motivation card has aria-live region` | Verify `role="status"` and `aria-live="polite"` attributes |
| `all icons in motivation card are aria-hidden` | Verify `aria-hidden="true"` on all `<svg>` elements in the card |
| `motivation card meets contrast ratio in dark mode` | Set `.dark` on `<html>`, verify text contrast ≥ 4.5:1 |

---

## Engineering Constraints

1. **No data model changes** — all state is in sessionStorage (perishable, not persisted to IndexedDB)
2. **Design tokens only** — all colors use `text-brand`, `text-success`, `bg-brand-soft`, `text-foreground`, `text-muted-foreground` from `src/styles/theme.css`
3. **Preserve dark mode** — motivation card uses `bg-card` + `text-foreground/85` (adapts to `.dark` automatically via theme variables)
4. **No hero height reduction** — motivation card lives below hero, no hero changes
5. **React 19, TypeScript** — hook uses standard React patterns, no legacy APIs
6. **Safe fallbacks** — if sessionStorage is unavailable (SSR, private browsing), hook degrades gracefully to static "Keep going!" message
7. **Existing shadcn/ui icons** — use `lucide-react` icons already in the project (Sparkles, Zap, Flame, Trophy, Clock, PartyPopper, CheckCircle2)
8. **No new dependencies**

---

## Design Token Reference

All colors must reference tokens defined in `src/styles/theme.css`:

| Element | Token | Light mode | Dark mode |
|---|---|---|---|
| Card background | `bg-card` | White | Gray-900 |
| Card border | `border-border/50` | 50% opacity border | 50% opacity border |
| Primary text | `text-foreground` | Near-black | Near-white |
| Secondary text | `text-muted-foreground` | Gray-500 | Gray-400 |
| Brand accent (icons) | `text-brand` | Purple-blue | Lighter purple-blue |
| Success accent | `text-success` | Green | Green |
| Success soft bg | `bg-success-soft` | Light green | Dark green |

---

## Success Criteria

After implementation:
1. **First visit**: User sees "Welcome to {trackName}. Your first goal: complete 3 lessons in {courseName}."
2. **After lessons**: Message updates in real-time to reflect daily count
3. **Returning**: Message acknowledges time away or streak
4. **Completion**: No message when all courses are done (Trophy banner suffices)
5. **Weekly data**: "This Week" sidebar card shows real study minutes
