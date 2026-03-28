---
story_id: E55-S05
story_name: "Streak Header Upgrade"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 55.5: Streak Header Upgrade

## Story

As a learner motivated by streaks,
I want a large, prominent streak counter with flame icon and a "Longest Streak" trophy badge,
So that my streak achievement is visually celebrated and motivates continued daily study.

## Acceptance Criteria

**Given** the StudyStreakCalendar component header area
**When** rendered (in either view mode)
**Then** it displays a large streak counter: `Flame` icon (in an orange-to-red gradient circular container) + bold "N Day Streak" text (large heading size, e.g. `text-3xl font-black`)

**Given** the current streak is 0
**When** the header renders
**Then** it shows "0 Day Streak" with the flame icon in a muted/inactive state (`text-muted-foreground`)

**Given** the current streak is > 0
**When** the header renders
**Then** the flame icon uses a warm gradient background (`from-warning to-destructive` or equivalent design tokens) and the text uses `text-foreground`

**Given** the streak header
**When** rendered
**Then** below the calendar (in the footer area), a "Longest Streak: N Days" badge is displayed with a `Trophy` icon, using warm/gold design tokens (`bg-gold-muted text-gold-soft-foreground`)

**Given** the current streak equals or exceeds the longest streak
**When** the header renders
**Then** the longest streak badge shows a "New Record!" label or animation to celebrate the achievement

**Given** the existing freeze token display
**When** the header is upgraded
**Then** freeze tokens remain visible in the header area (card with `Snowflake` icon + count), positioned to the right of the streak counter

**Given** the upgraded header
**When** viewed on mobile (< 640px)
**Then** the layout stacks vertically: streak counter on top, freeze tokens below, maintaining touch target sizes >= 44x44px

**Given** all design tokens
**When** the header is implemented
**Then** no hardcoded Tailwind colors are used (enforced by ESLint `design-tokens/no-hardcoded-colors` rule)

## Tasks / Subtasks

- [ ] Task 1: Redesign streak header section (AC: 1, 2, 3, 6)
  - [ ] 1.1 Replace current compact streak badge with large header layout
  - [ ] 1.2 Create flame icon container: circular, gradient background (`from-warning to-destructive`)
  - [ ] 1.3 Large "N Day Streak" text: `text-3xl font-black`
  - [ ] 1.4 Muted state when streak = 0: `text-muted-foreground` for icon and text
  - [ ] 1.5 Position freeze token card to the right of streak counter
  - [ ] 1.6 Freeze token card: `bg-surface-sunken rounded-2xl` with `Snowflake` icon + count
- [ ] Task 2: Create "Longest Streak" trophy badge in footer (AC: 4, 5)
  - [ ] 2.1 Footer area below calendar: "Longest Streak: N Days" with `Trophy` icon
  - [ ] 2.2 Style: `bg-gold-muted text-gold-soft-foreground rounded-full px-5 py-2.5 font-bold`
  - [ ] 2.3 "New Record!" label when currentStreak >= longestStreak (and > 0)
  - [ ] 2.4 Optional subtle animation (pulse or glow) for new record state
- [ ] Task 3: Responsive layout (AC: 7)
  - [ ] 3.1 Desktop: horizontal layout (flame+text left, freeze tokens right)
  - [ ] 3.2 Mobile (<640px): stacked layout, streak counter full width, freeze tokens below
  - [ ] 3.3 Touch targets >= 44x44px on all interactive elements
- [ ] Task 4: Design token compliance (AC: 8)
  - [ ] 4.1 Verify no hardcoded colors (run `npm run lint` to check)
  - [ ] 4.2 Use only tokens from theme.css: `--warning`, `--destructive`, `--gold-muted`, `--gold-soft-foreground`, `--muted-foreground`, etc.
- [ ] Task 5: Verify both view modes render header identically (AC: 1)
  - [ ] 5.1 Header renders above both heatmap and month-view
  - [ ] 5.2 Footer renders below both views

## Design Guidance

**Design reference:** Stitch `streak-calendar.html` — Variation A header (Section 2, lines 200-217) and close-ups (Section 4: Heat Counter, Milestone Badge)

**Header layout (from Stitch):**
```
┌──────────────────────────────────────────────────────────┐
│  [🔥 gradient circle]  26 Day Streak         [❄️ FREEZE] │
│                         You are in the top 2%!  TOKENS: 2│
└──────────────────────────────────────────────────────────┘
```

**Footer layout:**
```
┌──────────────────────────────────────────────────────────┐
│  [🏆] Longest Streak: 42 Days              [❄️] [❄️]    │
└──────────────────────────────────────────────────────────┘
```

**Flame icon container:**
- 64x64px (w-16 h-16) rounded-2xl
- Gradient: `from-warning to-destructive` (maps Stitch's orange-to-red gradient)
- Icon: `Flame` (Lucide), white, large (`text-4xl` equivalent)

**Trophy badge:**
- `Trophy` icon (Lucide) — maps Material Symbols `emoji_events`
- Badge: pill-shaped, `bg-gold-muted text-gold-soft-foreground rounded-full font-bold`

**Lucide icon mapping:**
- local_fire_department -> `Flame`
- emoji_events -> `Trophy`
- ac_unit -> `Snowflake`

**Design tokens:**
- Flame active bg: gradient `from-warning to-destructive` (orange->red)
- Flame inactive: `bg-muted text-muted-foreground`
- Streak text: `text-foreground text-3xl font-black`
- Trophy badge: `bg-gold-muted text-gold-soft-foreground`
- Freeze card: `bg-surface-sunken text-freeze-day-text`

## Implementation Notes

**Files to modify:**
- `src/app/components/StudyStreakCalendar.tsx` — redesign header and add footer section

**Data source:** Uses existing `StreakSnapshot` from `studyLog.ts` which already provides `currentStreak`, `longestStreak`, and `freezeDays`. No new data fetching needed.

**Existing components preserved:**
- `FreezeDaysDialog` — unchanged
- `MilestoneGallery` — unchanged
- `ConfettiExplosion` — unchanged

## Testing Notes

- E2E: verify large streak counter renders with correct number
- E2E: verify muted state when streak = 0
- E2E: verify trophy badge shows correct longest streak
- E2E: verify "New Record!" appears when current >= longest
- E2E: verify freeze token count displays correctly
- E2E: verify responsive layout on mobile viewport
- Visual regression: compare header with Stitch reference

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
