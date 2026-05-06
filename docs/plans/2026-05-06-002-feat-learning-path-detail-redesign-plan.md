---
title: feat: Redesign learning-path detail page
type: feat
status: active
date: 2026-05-06
---

# feat: Redesign learning-path detail page

## Overview

Redesign the `/learning-paths/:pathId` page (`LearningPathDetail.tsx`) to match a new design provided via HTML mockup. The redesign replaces the current flat course list and hero card with a glass-panel summary strip, a bento-style "Continue Learning" hero, a vertical roadmap timeline, and a redesigned right sidebar with Control Center, Plan My Week, and AI toggles. All existing functionality (drag-and-drop reordering, AI ordering, gap resolution, progress tracking, editable metadata, import wizard, delete with undo) is preserved.

The mockup serves as the visual target — colors, spacing, and typography are adapted to Knowlune's design token system (light/dark/vibrant/clean/apple schemes).

## Problem Frame

The current `LearningPathDetail` page groups a flat course list, a hero card, and a FocusPanel sidebar. It works functionally but lacks visual hierarchy and polish. The new design introduces:

- A summary stats glass panel at the top for at-a-glance progress
- A bento-style "Continue Learning" card with gradient accent and thumbnail
- A vertical timeline roadmap replacing the flat course list
- A restructured right sidebar with Control Center, Plan My Week commitment selector, and AI toggle

The underlying data model (paths, entries, progress) does not change. The redesign is purely presentational with some component extraction to make the page maintainable.

## Requirements Trace

- R1. Summary stats panel shows progress %, lessons completed, courses done, and estimated remaining time
- R2. "Continue Learning" hero card shows the current in-progress course with thumbnail, progress bar, and action buttons
- R3. Vertical timeline roadmap shows all courses in sequence with status indicators (in progress, locked, completed)
- R4. Right sidebar: Control Center ("Up Next" list + Focus Session button), Plan My Week (commitment selector), AI Course Ordering toggle, Study Tip
- R5. Existing functionality preserved: DnD reorder, AI order suggestion, gap entry resolution, import wizard integration, editable name/description, delete with undo
- R6. All colors use Knowlune design tokens — works across light, dark, vibrant, clean, and apple schemes
- R7. Responsive at mobile (375px), tablet (768px), and desktop (1440px)

## Scope Boundaries

- No changes to the data model (`LearningPath`, `LearningPathEntry` types)
- No changes to the store (`useLearningPathStore`)
- No changes to the progress hook (`usePathProgress`)
- No new backend endpoints or Supabase changes
- The HTML mockup uses "phases" grouping — phases are not in the Knowlune data model. The plan adapts the timeline UI without hard-coded phases; entries are displayed sequentially with visual status markers

### Deferred to Separate Tasks

- Phase grouping support (add `phase` or `group` field to `LearningPathEntry` with UI to edit phases): future iteration
- "Focus session" timer functionality: separate feature story

## Context & Research

### Relevant Code and Patterns

- **Page**: [src/app/pages/LearningPathDetail.tsx](src/app/pages/LearningPathDetail.tsx) (1240 lines) — the monolithic page to restructure
- **Components**: [src/app/components/learning-path/FocusPanel.tsx](src/app/components/learning-path/FocusPanel.tsx) (197 lines) — right-rail widget
- **Components**: [src/app/components/learning-path/RoadmapListView.tsx](src/app/components/learning-path/RoadmapListView.tsx) (239 lines) — flat course list
- **Components**: [src/app/components/learning-path/PlanMyWeekButton.tsx](src/app/components/learning-path/PlanMyWeekButton.tsx) — existing Plan My Week trigger
- **Components**: [src/app/components/learning-path/PlanMyWeekPreview.tsx](src/app/components/learning-path/PlanMyWeekPreview.tsx) — existing Plan My Week content
- **Store**: [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts) — Zustand store, no changes needed
- **Hook**: [src/app/hooks/usePathProgress.ts](src/app/hooks/usePathProgress.ts) — progress computation, no changes needed
- **Theme**: [src/styles/theme.css](src/styles/theme.css) — design tokens for all schemes
- **UI library**: [src/app/components/ui/](src/app/components/ui/) — shadcn/ui components (Card, Button, Badge, etc.)
- **Icons**: lucide-react (Play, Lock, Check, Clock, Sparkles, etc.) — no Material Symbols
- **Motion**: motion/react (framer-motion) for staggered animations
- **DnD**: @dnd-kit/core + @dnd-kit/sortable for course reordering
- **Tests**: [src/app/pages/__tests__/LearningPathDetail.test.tsx](src/app/pages/__tests__/LearningPathDetail.test.tsx) — unit tests to update

### Institutional Learnings

- Design token enforcement: `design-tokens/no-hardcoded-colors` ESLint rule blocks hardcoded Tailwind colors — all new components must use tokens (`bg-brand`, `text-muted-foreground`, etc.)
- Button variants: Use `variant="brand"`, `variant="brand-outline"`, `variant="brand-ghost"` for brand CTAs — never `className="bg-brand"` on `<Button>`
- Glass panel pattern already exists in the app (audiobook player) via `--surface-glass` token

### External References

- HTML mockup provided by user — dark-themed DevOps Roadmap Dashboard
- Knowlune shadcn/ui components: 50+ components available in `src/app/components/ui/`
- Tailwind CSS v4 with `@tailwindcss/vite` plugin

## Key Technical Decisions

- **Extract components, don't condense**: The current page is 1240 lines. Extract new focused components (`PathSummaryPanel`, `ContinueLearningBento`, `PathTimeline`, `ControlCenter`) into `src/app/components/learning-path/` to keep the page manageable
- **Vertical timeline without phases**: The HTML mockup groups courses into labeled phases ("Phase 1: Foundations", etc.), but Knowlune's data model has no phase concept. The timeline will show all courses sequentially with status indicators (completed check, in-progress play, locked padlock) along a vertical connector line. Phase support is deferred
- **Use existing PlanMyWeek components**: The Plan My Week section already exists as `PlanMyWeekButton` and `PlanMyWeekPreview` — reuse these rather than rebuilding
- **Icons: lucide-react, not Material Symbols**: The mockup uses Material Symbols (`auto_stories`, `dashboard`, `terminal`, etc.). Map to lucide-react equivalents (`BookOpen`, `LayoutDashboard`, `Terminal`, etc.) — these are sidebar icons that already exist in Knowlune's Layout
- **Glass panel via CSS**: Use `backdrop-blur` + semi-transparent background via design tokens rather than hardcoded `rgba(22, 23, 27, 0.7)`. The `--surface-glass` token from theme.css provides a glass surface that works across themes

## Open Questions

### Resolved During Planning

- Should phases be implemented? No — not in data model, deferred to future iteration
- Are the sidebar and header part of the redesign? No — Knowlune's global Layout already provides these; the HTML mockup includes them for standalone context but the page-level work focuses on the main content area
- What happens to the DnD reorder list? It remains available via a toggle, same as the current "View Full Curriculum" toggle
- What about gap entries? Gap entries remain and are rendered within the timeline with their existing resolution actions

### Deferred to Implementation

- Exact vertical connector line styling (gradient stop positions, glow effects) — will be tuned visually during implementation
- Whether the timeline should auto-scroll to the current in-progress entry — Yes, implement auto-scroll on page load: after data loads, scroll the current in-progress entry into view with a small top offset
- Glass panel border color — use `border-border` token; may need a subtle variant token depending on how it looks across themes

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Page Layout (desktop)

```
┌──────────────────────────────────────────────────────────────┐
│  Breadcrumb: Learning Paths > DevOps                         │
├──────────────────────────────────────────────────────────────┤
│  Title + Progress Badge  │  Description                      │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────┬─────────┬─────────┬─────────┐                   │
│  │   1%    │ 3 / 142 │  0 / 4  │ ~120.5h │  Glass Panel     │
│  │Progress │ Lessons │ Courses │Remaining│                   │
│  └─────────┴─────────┴─────────┴─────────┘                   │
│  [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 1% progress bar         │
├──────────────────────────┬───────────────────────────────────┤
│  8 cols (left)           │  4 cols (right, sticky)           │
│                          │                                   │
│  ┌────────────────────┐  │  ┌─────────────────────────────┐ │
│  │ Continue Learning  │  │  │ Control Center              │ │
│  │ Bento Card         │  │  │  Up Next list               │ │
│  │ w/ thumbnail,      │  │  │  Focus Session button       │ │
│  │ progress, actions  │  │  └─────────────────────────────┘ │
│  └────────────────────┘  │                                   │
│                          │  ┌─────────────────────────────┐ │
│  ┌────────────────────┐  │  │ Plan My Week                │ │
│  │ Vertical Timeline   │  │  │ Commitment selector         │ │
│  │                     │  │  │ Create plan button          │ │
│  │  ●── Course 1 (4%)  │  │  └─────────────────────────────┘ │
│  │  │                  │  │                                   │
│  │  ○── Course 2 🔒   │  │  ┌─────────────────────────────┐ │
│  │  │                  │  │  │ AI Course Ordering toggle   │ │
│  │  ○── Course 3 🔒   │  │  │ Review suggested order link │ │
│  │  │                  │  │  └─────────────────────────────┘ │
│  │  ○── Course 4 🔒   │  │                                   │
│  │                     │  │  ┌─────────────────────────────┐ │
│  └────────────────────┘  │  │ Study Tip card               │ │
│                          │  └─────────────────────────────┘ │
└──────────────────────────┴───────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Extract PathSummaryPanel component**

**Goal:** Replace the current inline header stats with a glass-panel summary strip showing 4 key metrics and a progress bar.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `src/app/components/learning-path/PathSummaryPanel.tsx`
- Modify: `src/app/pages/LearningPathDetail.tsx` (replace inline stats in header)
- Test: `src/app/components/learning-path/__tests__/PathSummaryPanel.test.tsx`

**Approach:**
- New component receives `PathProgressSummary` as props
- Renders a glass-panel card (`backdrop-blur-xl`, semi-transparent bg via `bg-[var(--surface-glass)]`, `border border-border`) with a 4-column grid inside
- Columns: Overall Progress (%), Lessons Completed (X / Y), Courses (X / Y), Est. Time Remaining (~Xh)
- Below the grid: a thin progress bar (`h-1`) with brand fill and glow shadow
- On mobile, grid collapses to 2×2

**Patterns to follow:**
- Glass panel pattern from audiobook player (`--surface-glass` token, `backdrop-blur-xl`)
- Card component from shadcn/ui for structure
- Use `--brand` for progress bar fill, `--border` for divider lines

**Test scenarios:**
- Happy path: Renders all 4 stats correctly from progress data
- Happy path: Progress bar width matches completion percentage
- Edge case: Zero progress (0% — all stats show 0, progress bar empty)
- Edge case: Full completion (100% — all courses done, remaining time 0h)
- Edge case: Single course, partial completion
- Edge case: No courses (0 total — handles division by zero gracefully)

**Verification:**
- Component renders correctly at desktop, tablet, and mobile widths
- All colors use design tokens (verify with ESLint `design-tokens/no-hardcoded-colors`)
- Progress bar animates smoothly on progress updates

---

- [ ] **Unit 2: Extract ContinueLearningBento component**

**Goal:** Replace the current "Now Learning" hero card with a bento-style card featuring gradient accent, thumbnail with play overlay, and action buttons.

**Requirements:** R2

**Dependencies:** None (can run parallel to Unit 1)

**Files:**
- Create: `src/app/components/learning-path/ContinueLearningBento.tsx`
- Modify: `src/app/pages/LearningPathDetail.tsx` (replace hero card section)
- Test: `src/app/components/learning-path/__tests__/ContinueLearningBento.test.tsx`

**Approach:**
- Receives the current in-progress course entry, its info, thumbnail URL, and click handlers
- Dark card surface (`bg-card border border-border rounded-xl overflow-hidden`)
- Gradient overlay from top-left (`bg-gradient-to-br from-brand-soft/20 to-transparent`)
- Left side: thumbnail with `mix-blend-luminosity` effect, centered play button overlay
- Right side: course name, author, time remaining, progress %, "Continue lesson" brand button + "View curriculum" outline button
- On mobile, stacks vertically
- Exported with optional `className` for layout flexibility

**Patterns to follow:**
- Existing hero card in `LearningPathDetail.tsx` (lines 859-918) for data wiring
- Use `aspect-video` for thumbnail container
- `group-hover:` utilities for hover effects on play button

**Test scenarios:**
- Happy path: Renders course name, author, progress, and thumbnail
- Happy path: "Continue lesson" button links to correct course URL
- Happy path: "View curriculum" button triggers the expected callback
- Edge case: No thumbnail URL — shows placeholder with BookOpen icon
- Edge case: Course with 0% progress (just started)
- Edge case: Course at 99% progress (almost complete)

**Verification:**
- Gradient overlay is visible but doesn't obscure content
- Play button is centered on thumbnail and scales on hover
- All colors use design tokens
- Responsive: stacks vertically on mobile

---

- [ ] **Unit 3: Extract PathTimeline component (replace RoadmapListView)**

**Goal:** Replace the flat `RoadmapListView` with a vertical timeline showing course sequence with a connector line and status indicators.

**Requirements:** R3, R5 (preserves gap resolution, DnD reorder access)

**Dependencies:** None (can run parallel to Units 1-2)

**Files:**
- Create: `src/app/components/learning-path/PathTimeline.tsx`
- Modify: `src/app/pages/LearningPathDetail.tsx` (replace RoadmapListView usage)
- Modify: `src/app/components/learning-path/RoadmapListView.tsx` (may keep for reorder mode or deprecate)
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**
- Receives sorted course entries, `courseInfoMap`, `thumbnailUrls`, gap entries, and callbacks (onGapResolve, onCourseClick)
- Renders a vertical timeline: a left-aligned connector line (thin vertical bar with gradient from brand at top to muted at bottom) with course cards positioned to the right
- Each entry gets a status circle on the line:
  - Completed (100%): green check circle with brand border
  - In progress (>0%, <100%): numbered circle with brand border + glow
  - Locked (0%): numbered circle with muted border
  - Gap entry: dashed border with warning styling
- Course cards show: course name, author, time remaining, mini progress bar
- Gap entries retain their Import/Match/Replace resolution buttons
- Clicking a course navigates to the course page
- The "View Full Curriculum" toggle from the right panel shows the full reorder list (existing DnD functionality)
- DnD reorder is accessible via toggle (same pattern as current `showReorderList` state)

**Execution note:** Keep existing DnD wiring from `LearningPathDetail.tsx` — the PathTimeline is the default view; the reorder list toggle switches to the existing `SortableCourseRow`-based reorder UI (preserved from current code).

**Patterns to follow:**
- Current `RoadmapListView` for course info rendering and gap resolution
- Vertical connector line: `bg-gradient-to-b from-brand via-border to-border` (gradient fades from brand to neutral)
- Status circles: `rounded-full`, 32×32px visual circle with transparent padding to reach 44×44px minimum touch target (WCAG 2.5.5). The entire timeline row is also a tap target, not just the circle

**Test scenarios:**
- Happy path: Renders all course entries in position order
- Happy path: Completed course shows check icon on circle
- Happy path: In-progress course shows brand-colored circle with play icon
- Happy path: Locked course shows muted circle with lock icon
- Happy path: Clicking a course calls onCourseClick
- Edge case: Empty path — shows empty state (handled by parent)
- Edge case: Single course in path
- Edge case: Gap entries render with dashed border and resolution actions
- Edge case: First entry is in-progress (gradient line starts at brand)
- Edge case: Last entry is locked (gradient line ends at muted)

**Verification:**
- Vertical connector line renders correctly at all lengths
- Status circles align with the connector line
- Gap entries are visually distinct from real courses
- All colors use design tokens

---

- [ ] **Unit 4: Redesign right sidebar (ControlCenter, Plan My Week, AI toggle, Study Tip)**

**Goal:** Replace the current `FocusPanel` with restructured right-rail sections matching the mockup layout.

**Requirements:** R4

**Dependencies:** None (can run in parallel with Units 1-3). Coordinates with Units 1-3 on shared LearningPathDetail.tsx changes

**Files:**
- Create: `src/app/components/learning-path/ControlCenter.tsx`
- Modify: `src/app/components/learning-path/FocusPanel.tsx` (significant restructure or replace)
- Modify: `src/app/pages/LearningPathDetail.tsx` (replace FocusPanel with new sections)
- Test: `src/app/components/learning-path/__tests__/ControlCenter.test.tsx`

**Approach:**
- **ControlCenter section**: Card with "Control Center" header, "Up Next" list (top 3 upcoming courses with status icons), and a "Start focus session" button. The focus session button calls `requestFocus()` from `@/lib/focusModeEvents` to activate the existing Pomodoro timer and focus mode. Reuses the existing Up Next logic from FocusPanel but restyles it
- **Plan My Week section**: Reuses existing `PlanMyWeekButton` and `PlanMyWeekPreview` components; adds a commitment selector (Casual 5h / Steady 8h / Intense 12h) as radio-style buttons. The commitment selector is new but lightweight
- **AI Course Ordering section**: Glass panel with toggle switch and "Review suggested order" link. Reuses existing `isOrderSuggestionAvailable()` check and `handleSuggestOrder` callback. The toggle controls whether AI ordering is active for the path
- **Study Tip section**: Card with lightbulb icon, "Study Tip" label, and a study tip drawn from a static array of 5-7 tips. Tips are path-specific when possible (e.g., "You're over 50% through this path" at >50%, "Only 2 courses left" near completion). One tip is displayed per page visit (random pick on mount from applicable tips, no auto-rotation timer). Replaces the current single hardcoded tip

**Patterns to follow:**
- Current `FocusPanel.tsx` for data wiring and callbacks
- Existing `PlanMyWeekButton` and `PlanMyWeekPreview` for plan integration
- `Switch` component from shadcn/ui (already in `src/app/components/ui/switch.tsx`) for AI toggle

**Test scenarios:**
- Happy path: Up Next shows correct upcoming courses
- Happy path: Focus session button is clickable and triggers callback
- Happy path: Commitment selector highlights selected option
- Happy path: AI toggle reflects current state and toggles on click
- Happy path: "Review suggested order" link triggers suggest order callback
- Edge case: No upcoming courses — Up Next section shows appropriate message
- Edge case: AI ordering not available — toggle is hidden or disabled
- Edge case: Path fully completed — sections show completion state

**Verification:**
- All sections render as cards with consistent styling
- Plan My Week commitment selector integrates with existing plan creation flow
- AI toggle is accessible (keyboard operable, ARIA label)
- Study tip content is helpful and non-repetitive

---

- [ ] **Unit 5: Restructure LearningPathDetail page layout**

**Goal:** Wire the new components into the page and restructure the overall layout to match the mockup's 12-column grid.

**Requirements:** R1-R7

**Dependencies:** Units 1, 2, 3, 4

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx` (major restructure)
- Update: `src/app/pages/__tests__/LearningPathDetail.test.tsx` (update for new component tree)

**Approach:**
- Replace the inline header stats with `<PathSummaryPanel>`
- Replace the hero card with `<ContinueLearningBento>`
- Replace `RoadmapListView` with `<PathTimeline>`
- Replace `FocusPanel` with `<ControlCenter>`, Plan My Week section, AI toggle section, and Study Tip section
- Layout: `grid grid-cols-1 lg:grid-cols-12 gap-[var(--content-gap)]`
  - Left 8 cols: ContinueLearningBento + PathTimeline
  - Right 4 cols (sticky `top-24`): ControlCenter + PlanMyWeek + AI toggle + Study Tip
  - Gap summary banner (if gaps exist) renders full-width above the Left/Right split, between ContinueLearningBento and the timeline
- Keep existing functionality: back link, template banner, gap summary banner, DnD reorder toggle, import wizard dialog, delete confirmation dialog, AI order dialog, inline editable fields
- Keep existing state management, hooks, and store interactions unchanged
- Remove or simplify code that becomes dead after component extraction

**Execution note:** Test-first for the page-level integration. Update existing test mocks to accommodate new component structure before modifying the page.

**Patterns to follow:**
- Current `LearningPathDetail.tsx` for state management, hooks, and callback wiring
- Motion `staggerContainer` + `fadeUp` for entry animations (preserve existing animation pattern). Wrap with `useReducedMotion()` check — disable staggered animations when the user prefers reduced motion

**Test scenarios:**
- Happy path: Page renders with all sections visible when courses exist
- Happy path: Breadcrumb navigates back to learning paths list
- Happy path: Editable name and description fields work
- Happy path: Delete path triggers confirmation dialog
- Happy path: AI Suggest Order dialog opens and applies order
- Happy path: Import wizard opens from gap entry resolution
- Edge case: Path not found — shows empty state
- Edge case: Loading state — shows skeletons
- Edge case: Path with no courses — shows empty state with Add Course button
- Edge case: Template-forked path — shows template banner

**Verification:**
- Page renders identically at all responsive breakpoints
- All existing functionality works: DnD reorder, AI ordering, gap resolution, import wizard, delete with undo
- No regression in existing test suite
- ESLint, TypeScript, and Prettier pass cleanly
- Build succeeds

## System-Wide Impact

- **Interaction graph:** `LearningPathDetail` → `useLearningPathStore`, `useCourseImportStore`, `useAuthorStore`, `usePathProgress`, `usePathMilestones`. Store interfaces unchanged
- **Error propagation:** Errors surface via toast notifications (sonner) — same pattern preserved
- **State lifecycle risks:** New components are presentational — state lives in the page and store, no new state sources. Unchanged
- **API surface parity:** No API changes. Route `/learning-paths/:pathId` unchanged
- **Integration coverage:** Cross-layer scenarios (progress update → timeline re-render, course import → gap entry resolution) preserved via existing store subscriptions
- **Unchanged invariants:** `LearningPath` and `LearningPathEntry` types unchanged. Store API unchanged. Route unchanged. Progress computation unchanged

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Large page file (1240 lines) restructure could introduce regressions | Extract components incrementally (Units 1-4), then restructure page (Unit 5). Run existing tests after each unit |
| Timeline component might not feel "designed" enough without phase grouping | Keep the vertical connector line and status indicators visually rich (glow, gradient) to compensate for lack of phases |
| Glassmorphism effects may not look consistent across all 5 color schemes | Test with at least 3 schemes (default light, default dark, clean light) during implementation |
| Existing test file has complex mock setup | Update test file last, after new components are stable |

## Sources & References

- **Mockup:** User-provided HTML (DevOps Roadmap Dashboard, dark-themed)
- **Current page:** [src/app/pages/LearningPathDetail.tsx](src/app/pages/LearningPathDetail.tsx)
- **Current components:** [src/app/components/learning-path/](src/app/components/learning-path/)
- **Theme tokens:** [src/styles/theme.css](src/styles/theme.css)
- **Design token rules:** [.claude/rules/styling.md](.claude/rules/styling.md)
- **UI components:** [src/app/components/ui/](src/app/components/ui/)
