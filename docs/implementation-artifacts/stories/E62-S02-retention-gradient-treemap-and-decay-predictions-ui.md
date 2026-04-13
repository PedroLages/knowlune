---
story_id: E62-S02
story_name: 'Retention Gradient Treemap and Decay Predictions UI'
status: complete
started: 2026-04-14
completed: 2026-04-14
reviewed: true
review_started: 2026-04-14
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, bundle-analysis, code-review, code-review-testing, design-review, performance-benchmark, security-review, exploratory-qa, openai-code-review, glm-code-review]
burn_in_validated: false
---

# Story 62.2: Retention Gradient Treemap and Decay Predictions UI

## Story

As a learner viewing my Knowledge Map,
I want treemap cells colored by a continuous retention gradient with decay prediction tooltips,
so that I can visually identify which topics are fading and when I need to review them.

## Acceptance Criteria

**Given** the treemap renders with topics having aggregateRetention values of 90%, 50%, and 20%
**When** cells are displayed
**Then** cell background colors show a continuous gradient (green-ish for 90%, yellow-ish for 50%, red-ish for 20%) rather than only 3 discrete tier colors

**Given** a topic with no flashcards (aggregateRetention is null)
**When** its treemap cell renders
**Then** it falls back to the existing discrete tier coloring based on score (success/warning/destructive)

**Given** a treemap cell for a topic with `predictedDecayDate` 5 days from now
**When** the user hovers over the cell
**Then** the tooltip includes "Fading in 5 days" with destructive-colored text

**Given** a treemap cell for a topic with `predictedDecayDate` 45 days from now
**When** the user hovers over the cell
**Then** the tooltip includes "Stable until [Month Day]" with success-colored text

**Given** a treemap cell for a topic with `predictedDecayDate` 15 days from now
**When** the user hovers over the cell
**Then** the tooltip includes "Fading by [Month Day]" with warning-colored text

**Given** treemap cells with gradient colors in dark mode
**When** rendered
**Then** text labels maintain WCAG AA contrast (4.5:1 for normal text) by using white text on dark fills and dark text on light fills

**Given** the TopicDetailPopover opens for a topic with aggregateRetention 45% and predictedDecayDate in 3 days
**When** the decay section renders
**Then** it shows the retention percentage, a "Fading in 3 days" label, and a destructive badge

**Given** the TopicDetailPopover opens for a topic with no flashcards
**When** the popover renders
**Then** the "Memory Decay" section is not shown (hidden, not showing empty/null values)

## Tasks / Subtasks

- [ ] Task 1: Add `getRetentionColor()` to TopicTreemap (AC: 1, 2, 6)
  - [ ] 1.1 Create `getRetentionColor(retention: number | null, score: number): string`
  - [ ] 1.2 When retention is not null: interpolate HSL between success (>= 85), warning (~50), destructive (<= 20)
  - [ ] 1.3 When retention is null: fall back to `getTierColor(score)` discrete logic
  - [ ] 1.4 Read HSL values from CSS custom properties via `getComputedStyle()` for dark/light mode
  - [ ] 1.5 Cache computed color values to avoid per-render DOM reads
  - [ ] 1.6 Add `getTextColor(bgColor: string): string` for adaptive foreground color based on luminance

- [ ] Task 2: Update custom cell renderer to use gradient colors (AC: 1, 2)
  - [ ] 2.1 Replace `getTierColor(topic.score)` with `getRetentionColor(topic.aggregateRetention, topic.score)` in cell fill
  - [ ] 2.2 Use `getTextColor()` for cell label foreground color

- [ ] Task 3: Enhance treemap cell tooltip with decay prediction (AC: 3, 4, 5)
  - [ ] 3.1 Check `topic.predictedDecayDate` presence
  - [ ] 3.2 Calculate days until decay from now
  - [ ] 3.3 < 7 days: "Fading in [N] days" with destructive text color
  - [ ] 3.4 7-30 days: "Fading by [Month Day]" with warning text color
  - [ ] 3.5 > 30 days: "Stable until [Month Day]" with success text color
  - [ ] 3.6 Use `formatDistanceToNow` from date-fns for relative format, `format(date, 'MMM d')` for absolute

- [ ] Task 4: Add "Memory Decay" section to TopicDetailPopover (AC: 7, 8)
  - [ ] 4.1 Conditionally render section only when `aggregateRetention` is not null
  - [ ] 4.2 Show aggregate retention as percentage with inline Progress component
  - [ ] 4.3 Show predicted decay date with relative formatting
  - [ ] 4.4 Show urgency Badge: `variant="destructive"` if < 7 days, warning if < 30, success if > 30
  - [ ] 4.5 Follow existing score breakdown layout pattern

## Design Guidance

**Layout approach:**

- Treemap cells: gradient fill replaces discrete tier fill, same cell dimensions
- Tooltip: existing tooltip structure extended with one additional line for decay prediction
- TopicDetailPopover: new "Memory Decay" row added to the score breakdown section, between existing score factors and the action buttons

**Component structure:**

- `getRetentionColor()` and `getTextColor()` are utility functions within TopicTreemap.tsx (not exported)
- TopicDetailPopover receives `aggregateRetention` and `predictedDecayDate` via the existing `ScoredTopic` prop

**Design system usage:**

- Gradient base colors: `var(--success)`, `var(--warning)`, `var(--destructive)` from theme.css
- Tooltip text colors: `text-destructive`, `text-warning`, `text-success` design tokens
- Urgency badges: Badge component with `variant="destructive"`, `variant="default"` (warning), `variant="outline"` (success)
- Inline progress bar: Progress component at small height (h-2)
- No hardcoded colors — all via design tokens and CSS custom properties

**Responsive strategy:**

- Gradient colors work identically on desktop/tablet/mobile treemap
- Mobile list fallback (< 640px): uses tier badges (not gradient), no change needed
- TopicDetailPopover: same on all viewports (shadcn/ui Popover handles positioning)

**Accessibility:**

- Text labels use adaptive foreground (white/dark) based on background luminance — not just tier
- Tier badge text still present in labels (color is not the only information channel)
- Tooltip decay text uses semantic color tokens, not hardcoded
- All existing keyboard navigation preserved (no changes to cell interaction)

## Implementation Notes

**Key files to modify:**

- `src/app/components/knowledge/TopicTreemap.tsx` — gradient coloring, tooltip enhancement, text contrast
- `src/app/components/knowledge/TopicDetailPopover.tsx` — Memory Decay section

**Key files to reference:**

- `src/styles/theme.css` — design token CSS custom properties
- `src/app/components/ui/badge.tsx` — Badge component variants
- `src/app/components/ui/progress.tsx` — Progress component for inline retention bar

**Color interpolation approach:**

- Read `--success`, `--warning`, `--destructive` CSS custom properties
- Parse to HSL components
- Interpolate H, S, L independently based on retention percentage
- Consider OKLCH via CSS `color-mix()` for perceptually uniform gradients (modern browsers)

## Testing Notes

- E2E tests handle visual verification (Story 62.4)
- Unit test for `getRetentionColor()` at key retention values: 0, 20, 50, 85, 100 (Story 62.3)
- Manual verification: dark mode gradient quality, midpoint colors not muddy
- Test tooltip content at boundary values (6 days, 7 days, 29 days, 30 days, 31 days)

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

1. **CSS variable resolution for SVG fills**: Recharts SVG `<rect>` elements cannot use CSS variables directly for gradient interpolation. Solved by creating a temporary DOM element to resolve `var(--success)` etc. to computed RGB values, with a MutationObserver to invalidate the cache on theme class changes.

2. **Duplicated decay formatting logic**: The decay date formatting logic (`getDecayInfo` / `formatDecayPrediction`) is duplicated between `TopicDetailPopover.tsx` and `TopicTreemap.tsx` with slightly different return types (badgeVariant vs colorClass). A shared utility in `src/lib/` would reduce drift risk.

3. **WCAG contrast on gradient backgrounds**: Using continuous color interpolation means text contrast must be calculated dynamically per-cell rather than using pre-defined foreground tokens. Implemented `getRelativeLuminance` + threshold check to switch between white and `var(--foreground)` text.
