---
story_id: E11-S03
story_name: "Study Session Quality Scoring"
status: in-progress
started: 2026-03-15
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 11.3: Study Session Quality Scoring

## Story

As a learner,
I want to receive a quality score after each study session based on my engagement,
So that I can understand how effectively I studied and improve my habits over time.

## Acceptance Criteria

**Given** a learner completes a study session
**When** the session ends
**Then** the system calculates a quality score from 0 to 100 based on active time ratio (40% weight), interaction density (30% weight), session length (15% weight), and breaks taken (15% weight)
**And** the score is displayed to the learner with a breakdown of each factor's contribution

**Given** a study session has a high active time ratio and frequent interactions
**When** the score is calculated
**Then** the score reflects strong engagement with values in the upper range
**And** the active time and interaction density factors show high individual scores

**Given** a study session is very short with minimal interaction
**When** the score is calculated
**Then** the score reflects low engagement
**And** the breakdown clearly shows which factors contributed to the low score

**Given** a learner has completed multiple sessions
**When** they view their session history
**Then** each session displays its quality score alongside date, duration, and course name
**And** a trend indicator shows whether session quality is improving, stable, or declining

**Given** a learner is in an active study session
**When** the session is ongoing
**Then** the system tracks active time, interactions, and breaks in real time without displaying the score until the session concludes

## Tasks / Subtasks

- [ ] Task 1: Quality score calculation engine (AC: 1, 2, 3)
  - [ ] 1.1 Define quality score types and interfaces
  - [ ] 1.2 Implement weighted scoring formula (active time 40%, interaction density 30%, session length 15%, breaks 15%)
  - [ ] 1.3 Add unit tests for scoring edge cases (zero duration, no interactions, all high scores)
- [ ] Task 2: Real-time session tracking enhancements (AC: 5)
  - [ ] 2.1 Track active time vs idle time during sessions
  - [ ] 2.2 Track interaction events (video seeks, note edits, page changes)
  - [ ] 2.3 Track break periods
- [ ] Task 3: Score display after session end (AC: 1)
  - [ ] 3.1 Create quality score breakdown component
  - [ ] 3.2 Show score with factor contributions on session end
- [ ] Task 4: Session history with quality scores and trends (AC: 4)
  - [ ] 4.1 Extend session history to show quality scores
  - [ ] 4.2 Calculate and display trend indicator (improving/stable/declining)
- [ ] Task 5: Persist quality scores in database (AC: 1, 4)
  - [ ] 5.1 Add quality score fields to study session schema
  - [ ] 5.2 Save scores on session end

## Design Guidance

### Aesthetic Direction

**Tone**: Refined analytical — clean data visualization with warm educational feel, matching LevelUp's existing Reports page patterns (Cards, Recharts, motion/react stagger animations).

**Differentiation**: The quality score is a **personal coaching moment** — not just a number. The breakdown tells a story about *how* the learner studied. Use visual weight and hierarchy to make the score feel meaningful without being judgmental.

### Component 1: Quality Score Summary (Post-Session Dialog)

**Trigger**: Shown as a `Dialog` overlay when a study session ends (navigating away from lesson player or explicit session end).

**Layout**:
```
┌──────────────────────────────────────────┐
│           Session Complete               │
│                                          │
│         ┌─────────────┐                  │
│         │     78      │  ← Large score   │
│         │  /100       │    in circular   │
│         │  Good       │    progress ring │
│         └─────────────┘                  │
│                                          │
│  ┌──────────┬──────────┬────────┬──────┐ │
│  │ Active   │ Interact │ Length │Breaks│ │
│  │  85/100  │  72/100  │ 68/100│82/100│ │
│  │   40%    │   30%    │  15%  │ 15%  │ │
│  └──────────┴──────────┴────────┴──────┘ │
│                                          │
│            [Continue]                    │
└──────────────────────────────────────────┘
```

**Design tokens**:
- Card: `bg-card rounded-[24px]` with `shadow-warm`
- Score ring: SVG circle using `stroke: var(--brand)` for fill, `var(--muted)` for track
- Score label thresholds: `text-success` (≥70), `text-warning` (40-69), `text-destructive` (<40)
- Factor cards: `bg-surface-sunken rounded-xl` with individual mini-progress bars
- Factor weight labels: `text-muted-foreground text-xs`
- Typography: Score number in `font-heading text-4xl font-bold`, label in `font-body text-sm`

**Score labels**: "Excellent" (≥85), "Good" (≥70), "Fair" (≥50), "Needs Improvement" (<50)

**Animation**: Use `motion/react` — score ring animates from 0 to final value (0.8s ease-out), factor bars stagger in (100ms delay each). Matches existing `staggerContainer`/`fadeUp` patterns from Reports page.

### Component 2: Factor Breakdown Bar

**Pattern**: Horizontal mini-bar (like a progress bar) for each factor, showing individual score and weight.

```
Active Time (40%)     ████████████████░░░░  85
Interaction (30%)     ██████████████░░░░░░  72
Session Length (15%)  █████████████░░░░░░░  68
Breaks (15%)          ████████████████░░░░  82
```

**Design tokens**:
- Bar track: `bg-muted rounded-full h-2`
- Bar fill: `bg-brand rounded-full` (default), tint with factor-specific chart colors (`--chart-1` through `--chart-4`)
- Score number: `text-sm font-medium tabular-nums` (right-aligned)

### Component 3: Session History Quality Column

**Integration point**: Extend existing `SessionHistory.tsx` — add a quality score column/badge to each session row.

**Layout** (within existing session row):
```
│ Mar 15  │ React Basics │ 45m │ 🔵 78 │ ▲ Improving │
│ Mar 14  │ React Basics │ 32m │ 🟡 52 │             │
│ Mar 13  │ TypeScript   │ 60m │ 🟢 91 │             │
```

**Design tokens**:
- Score badge: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium`
- Color coding: Same thresholds as score labels — `bg-success-soft text-success` (≥70), `bg-gold-muted text-warning` (40-69), `bg-destructive/10 text-destructive` (<40)
- No score (legacy sessions): `text-muted-foreground` with "—" placeholder

### Component 4: Trend Indicator

**Calculation**: Compare average of last 5 sessions vs previous 5. Improving (>5pt increase), Declining (>5pt decrease), Stable (within ±5pt).

**Visual**:
- `TrendingUp` icon + "Improving" in `text-success`
- `Minus` icon + "Stable" in `text-muted-foreground`
- `TrendingDown` icon + "Declining" in `text-warning`
- Placed next to the latest session row or as a summary header in session history

**Icons**: Use `lucide-react` — `TrendingUp`, `TrendingDown`, `Minus`

### Responsive Strategy

| Breakpoint | Score Dialog | Factor Breakdown | Session History |
|------------|-------------|-----------------|-----------------|
| < 640px | Full-width sheet (bottom) | Stack factors vertically, 1 per row | Score badge only, no trend text |
| 640-1023px | Centered dialog, 420px max-w | 2×2 grid of factors | Score badge + compact trend icon |
| ≥ 1024px | Centered dialog, 480px max-w | 4-column row | Full score + trend text |

**Mobile-first approach**: Use `Sheet` component (bottom drawer) on mobile, `Dialog` on desktop. Both from shadcn/ui.

### Accessibility Requirements

- **Score ring**: `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Session quality score: 78 out of 100, Good"`
- **Factor bars**: Each bar needs `role="meter"` with `aria-valuenow` and `aria-label` including factor name and weight
- **Trend indicator**: `aria-label="Session quality trend: improving"` — don't rely on icon color alone
- **Color contrast**: All score labels meet 4.5:1 against their backgrounds (verified with OKLCH tokens)
- **Keyboard**: Dialog traps focus, `Escape` closes, `Tab` navigates between factors
- **Screen reader**: Score announced as "Session quality score: 78 out of 100, rated Good. Active time: 85, Interaction density: 72, Session length: 68, Breaks: 82"

### File Structure

| Component | Path | New/Modified |
|-----------|------|-------------|
| QualityScoreDialog | `src/app/components/session/QualityScoreDialog.tsx` | New |
| QualityScoreRing | `src/app/components/session/QualityScoreRing.tsx` | New |
| FactorBreakdown | `src/app/components/session/FactorBreakdown.tsx` | New |
| TrendIndicator | `src/app/components/session/TrendIndicator.tsx` | New |
| SessionHistory | `src/app/pages/SessionHistory.tsx` | Modified — add score column + trend |
| Quality score types | `src/data/types.ts` | Modified — add QualityScore interface |
| Score calculation | `src/lib/qualityScore.ts` | New — pure scoring logic |
| Session store | `src/stores/useSessionStore.ts` | Modified — trigger score calc on end |

## Implementation Plan

See [plan](plans/e11-s03-quality-scoring.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- Story setup complete. Lessons to be documented during implementation.
