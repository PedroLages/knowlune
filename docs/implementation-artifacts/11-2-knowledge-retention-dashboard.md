---
story_id: E11-S02
story_name: "Knowledge Retention Dashboard"
status: done
started: 2026-03-15
completed: 2026-03-15
reviewed: true
review_started: 2026-03-15
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 11.2: Knowledge Retention Dashboard

## Story

As a learner,
I want to see my knowledge retention status per topic and be alerted when my engagement is declining,
So that I can identify weak areas and re-engage before knowledge fades.

## Acceptance Criteria

**Given** a learner has reviewed notes across multiple topics
**When** they view the knowledge retention dashboard
**Then** each topic displays a retention level of strong, fading, or weak based on review history
**And** each topic shows the time elapsed since the last review

**Given** a topic has not been reviewed within the expected interval
**When** the retention dashboard is rendered
**Then** the topic's retention level degrades from strong to fading to weak as time passes
**And** the visual indicator (color and label) updates to reflect the current retention state

**Given** a learner's study frequency drops below 50% of their 2-week rolling average
**When** the system evaluates engagement metrics
**Then** an engagement decay alert is displayed on the dashboard
**And** the alert identifies frequency decline as the contributing factor

**Given** a learner's session duration declines more than 30% over 4 weeks
**When** the system evaluates engagement metrics
**Then** an engagement decay alert is displayed indicating declining session duration

**Given** a learner's completion velocity is negative for 3 or more consecutive weeks
**When** the system evaluates engagement metrics
**Then** an engagement decay alert is displayed indicating stalled progress
**And** the alert includes a suggestion to revisit incomplete material

**Given** no engagement decay conditions are met
**When** the learner views the dashboard
**Then** no decay alerts are shown and the engagement status displays as healthy

## Tasks / Subtasks

- [ ] Task 1: Create retention level calculation logic (AC: 1, 2)
  - [ ] 1.1 Define RetentionLevel type (strong | fading | weak)
  - [ ] 1.2 Implement retention degradation algorithm based on review intervals
  - [ ] 1.3 Calculate time elapsed since last review per topic
- [ ] Task 2: Create engagement decay detection (AC: 3, 4, 5, 6)
  - [ ] 2.1 Calculate 2-week rolling average study frequency
  - [ ] 2.2 Detect session duration decline over 4 weeks
  - [ ] 2.3 Detect negative completion velocity for 3+ consecutive weeks
  - [ ] 2.4 Generate decay alerts with contributing factors
- [ ] Task 3: Build Knowledge Retention Dashboard UI (AC: 1, 2, 6)
  - [ ] 3.1 Create topic retention cards with color-coded indicators
  - [ ] 3.2 Display time elapsed since last review
  - [ ] 3.3 Show healthy engagement status when no decay detected
- [ ] Task 4: Integrate engagement decay alerts into dashboard (AC: 3, 4, 5)
  - [ ] 4.1 Display frequency decline alert
  - [ ] 4.2 Display session duration decline alert
  - [ ] 4.3 Display stalled progress alert with suggestion
- [ ] Task 5: Write unit tests for retention and decay logic
- [ ] Task 6: Write E2E tests for dashboard rendering and interactions

## Design Guidance

### Layout Structure (Mirror Reports.tsx)

```
┌─────────────────────────────────────────────────┐
│  Knowledge Retention                            │
├─────────────────────────────────────────────────┤
│  Stat Card 1 | Stat Card 2 | Stat Card 3       │  (1→2→3 cols responsive)
├──────────────┬──────────────────────────────────┤
│  Retention   │  Retention Trend Chart (2/3)     │  (1→1:2 split)
│  Ring/Donut  │  (AreaChart over 14 days)        │
├──────────────┴──────────────────────────────────┤
│  Topic Retention Cards (full width grid)        │  (1→2→3 cols responsive)
├─────────────────────────────────────────────────┤
│  Engagement Decay Alerts (full width)           │  (stacked Alert components)
└─────────────────────────────────────────────────┘
```

### Stat Cards (top row)
- "Notes at Risk" — count of notes with retention <50%, `text-destructive`
- "Due Today" — count from `isDue()`, `text-warning`
- "Avg Retention" — mean retention %, color by threshold
- Pattern: `StatsCard` with `NumberFlow` animation, optional sparkline

### Retention State Color Mapping
| State | Token | Threshold |
|-------|-------|-----------|
| Strong | `text-success` / `bg-success-soft` | ≥80% retention |
| Fading | `text-warning` / `bg-warning/10` | 50-79% retention |
| Weak | `text-destructive` / `bg-destructive/10` | <50% retention |

Reuse `getRetentionBadgeClasses()` from `ReviewCard.tsx`.

### Topic Retention Cards
- shadcn `Card` with `rounded-[24px]`, `p-6`
- Icon + topic name in `CardHeader`
- Retention `Badge variant="outline"` with color from mapping
- "Last reviewed: X days ago" in `text-xs text-muted-foreground`
- Progress bar or mini ring showing retention %

### Engagement Decay Alerts
- Use shadcn `Alert` component with appropriate variant
- Frequency decline → `variant="default"` with warning styling
- Duration decline → `variant="default"` with warning styling
- Stalled progress → `variant="destructive"` with suggestion text
- Healthy state → no alerts, show `Badge` "Engagement: Healthy" in `text-success`

### Motion
- Wrap sections in `motion.div` with `fadeUp` variants
- Use `staggerContainer` for sequential card reveals
- Duration: 300-500ms, easing: `[0.16, 1, 0.3, 1]`

### Key Existing Components to Reuse
- `src/app/components/StatsCard.tsx` — hero metric cards
- `src/app/components/figma/ReviewCard.tsx` — retention color patterns
- `src/app/components/ui/card.tsx` — card structure
- `src/app/components/ui/alert.tsx` — decay alert banners
- `src/app/components/ui/badge.tsx` — retention level badges
- `src/app/components/ui/chart.tsx` — Recharts wrapper
- `src/lib/spacedRepetition.ts` — `predictRetention()`, `isDue()`

### Responsive Breakpoints
- Mobile: single column, stacked cards
- Tablet (640px): 2-column grid for stat cards and topic cards
- Desktop (1024px): 3-column stat cards, 1:2 split for ring+chart

### Accessibility
- WCAG 2.1 AA+ contrast on all retention indicators
- ARIA labels on color-coded badges (don't rely on color alone)
- Semantic headings for screen readers
- Keyboard navigable topic cards

## Implementation Plan

See [plan](../../.claude/plans/playful-doodling-balloon.md) for implementation approach.

## Implementation Notes

- **Pure function architecture**: All retention and decay logic lives in `src/lib/retentionMetrics.ts` as pure functions accepting `now: Date` for deterministic testing. No side effects — the dashboard component handles data loading and passes `now` down.
- **Reuse of spaced repetition engine**: `predictRetention()` and `isDue()` from `src/lib/spacedRepetition.ts` drive the per-topic retention calculations, avoiding duplication of the exponential decay formula.
- **Topic grouping strategy**: Notes are grouped by their first tag (`tags[0]`), falling back to "General". Topics with zero review records are excluded since they haven't entered the spaced repetition system.
- **Component decomposition**: `TopicRetentionCard` and `EngagementDecayAlerts` are standalone components in `src/app/components/figma/`, keeping the page component thin (~150 lines).
- **Design token compliance**: All retention level colors use semantic tokens (`text-success`, `text-warning`, `text-destructive`) with soft backgrounds, matching the pattern from `ReviewCard.tsx`.
- **No new dependencies added** — uses existing shadcn/ui components (Card, Badge, Alert), Framer Motion, and Lucide icons.

## Testing Notes

- **Unit tests**: 100% branch coverage on `retentionMetrics.ts` — tests cover empty inputs, single/multiple topics, boundary values at 50%/80% thresholds, and all three decay alert types.
- **E2E tests**: 7 tests across 6 ACs using `page.clock.install()` for deterministic time. Each test seeds specific IndexedDB data (notes, reviewRecords, studySessions) to trigger the exact retention/decay scenario.
- **Test data design**: Review records are crafted with specific `reviewedDaysAgo` and `intervalDays` to produce predictable `predictRetention()` outputs (e.g., `e^(-1/7) = 87%` for strong, `e^(-14/3) ≈ 1%` for weak).
- **Edge case: velocity stall detection** — requires sessions older than 21 days to produce 3 consecutive zero-session weeks in the weekly bucket calculation.

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

**Report**: `docs/reviews/design/design-review-2026-03-15-e11-s02.md`

### Blockers
1. "Fading" badge text contrast 3.63:1 (needs 4.5:1) — `TopicRetentionCard.tsx:16`
2. "Weak" badge text contrast 4.05:1 (needs 4.5:1) — `TopicRetentionCard.tsx:16`
3. `text-muted-foreground` on white cards 3.88:1 — `TopicRetentionCard.tsx:42-48, 64-66, 87-89`

### High
4. Heading hierarchy skips H2 (H1 → H3) — `RetentionDashboard.tsx:113, 133`
5. `<section>` elements missing accessible names — `RetentionDashboard.tsx:110, 130`
6. Raw emoji `💡` in alert text — `EngagementDecayAlert.tsx:55`

## Code Review Feedback

**Report**: `docs/reviews/code/code-review-2026-03-15-e11-s02.md`

### High
1. Inline `style={{ width }}` on progress bar — `TopicRetentionCard.tsx:76` — add ESLint disable comment
2. `now` captured once on mount, never updates — `RetentionDashboard.tsx:20` — document trade-off
3. Silent `.catch(() => {})` in E2E afterEach — `story-e11-s02.spec.ts:104`

### Medium
4. `fourWeekAvg` relies on `NaN || 0` coercion — `retentionMetrics.ts:212-213`
5. Redundant `s.endTime` filter in helpers — `retentionMetrics.ts:154-156, 169-171`
6. `new Date()` in hot loop for `lastReviewedAt` — `retentionMetrics.ts:98-100`

## Web Design Guidelines Review

### High
1. `<section>` landmarks missing accessible names — `RetentionDashboard.tsx:110, 130` (dedupe with design review #5)
2. Healthy status not in live region — `EngagementDecayAlert.tsx:22-35`
3. Heading hierarchy skips H2 (dedupe with design review #4)

### Medium
4. Progress bar fill lacks `motion-reduce:transition-none` — `TopicRetentionCard.tsx:71`

## Challenges and Lessons Learned

- **Engagement decay algorithm design**: The three decay detectors (frequency, duration, velocity) each need different time windows and thresholds. The weekly bucket approach (`getWeeklySessionCounts`/`getWeeklyAvgDurations`) keeps the logic readable while supporting all three ACs. Key insight: the "2-week rolling average" in AC3 maps to comparing two 2-week sums, not a sliding window average.
- **E2E test data precision**: Getting E2E tests to trigger specific decay conditions required careful session placement in time. For example, the velocity stall test needs sessions older than 21 days but recent enough to count as "completed sessions exist" — without this, `detectEngagementDecay` returns early.
- **Pure function testability**: Accepting `now: Date` as a parameter across all metric functions made unit tests trivial and E2E tests deterministic via `page.clock.install()`. This pattern (from E11-S01) continues to pay dividends.
- **Empty state handling**: The dashboard needs to handle the case where a user has notes but no review records — these topics are excluded from the retention grid rather than shown with 0% retention, since they haven't entered the spaced repetition system yet.
