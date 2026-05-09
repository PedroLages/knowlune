---
title: "feat: Redesign LearningPathDetail page with hero banner and progress sidebar"
type: feat
status: active
date: 2026-05-08
---

# feat: Redesign LearningPathDetail page with hero banner and progress sidebar

## Overview

Redesign the `/learning-paths/:pathId` detail page to adopt the visual structure from the DevOps `/devops-roadmap` reference design: a full-width hero banner with gradient, an overlapping content area, and a sticky progress sidebar. All existing functionality (DnD reordering, AI order suggestions, gap entry resolution, import wizard, Plan My Week) is preserved — this is a visual restructuring, not a feature rebuild.

## Problem Frame

The current LearningPathDetail page is functionally rich but visually plain — an editable title, a percentage stat, and a flat list of course cards. There is no visual anchor (hero), no persistent progress overview in the sidebar, and no clear visual hierarchy separating "what is this path" from "what's in it." The DevOps reference design solves these problems with a gradient hero banner, sticky progress card with SVG ring, and a syllabus timeline with status nodes.

## Requirements Trace

- R1. Hero banner with gradient, back link, metadata badges (course count, difficulty), path title, description, CTA button, and learner avatar stack
- R2. Content area overlapping the hero (negative top margin) with a 2-column (8+4) grid layout
- R3. Sticky right-sidebar progress card with SVG progress ring, modules completed stat, estimated time remaining, skills tags, and certificate/completion reward card
- R4. All existing functionality preserved: editable title/description, DnD reordering, AI order suggestions, gap entry resolution, import wizard, Plan My Week, focus sessions
- R5. Responsive behavior at mobile (375px), tablet (768px), and desktop (1440px) breakpoints
- R6. All colors use design tokens (`--brand`, `--brand-soft`, etc.) — no hardcoded colors
- R7. Dark mode and color scheme (.vibrant, .clean, .apple) compatibility

## Scope Boundaries

- The `/learning-paths` listing page is NOT in scope (already has `LearningPathCard` with gradient headers)
- The `PathTimeline`, `ContinueLearningBento`, and `ControlCenter` sub-components keep their existing functionality but may receive minor visual polish
- Certificate issuance logic is NOT in scope — the sidebar shows a decorative certificate card, not real certificate functionality
- Avatar stack shows course thumbnail images, not real user avatars

### Deferred to Separate Tasks

- Real certificate issuance and download: requires backend integration
- Social learner avatars: requires social features infrastructure

## Context & Research

### Relevant Code and Patterns

- [src/app/pages/LearningPathDetail.tsx](src/app/pages/LearningPathDetail.tsx) — the page being redesigned (~1182 lines, rich functionality)
- [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — existing SVG circular progress ring (configurable size, status-based colors)
- [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx) — gradient banner component with hash-based gradient selection
- [src/app/components/learning-path/PathSummaryPanel.tsx](src/app/components/learning-path/PathSummaryPanel.tsx) — glass-panel stats strip (4 metrics + progress bar)
- [src/app/components/learning-path/PathTimeline.tsx](src/app/components/learning-path/PathTimeline.tsx) — vertical timeline with status circles
- [src/app/components/learning-path/ContinueLearningBento.tsx](src/app/components/learning-path/ContinueLearningBento.tsx) — hero card for current course
- [src/app/components/learning-path/ControlCenter.tsx](src/app/components/learning-path/ControlCenter.tsx) — right sidebar (up next, focus session, plan my week, AI ordering, study tips)
- [src/app/components/learning-path/LearningPathCard.tsx](src/app/components/learning-path/LearningPathCard.tsx) — card used on listing page (gradient header + progress ring overlap pattern)
- [src/styles/theme.css](src/styles/theme.css) — design tokens (brand, success, warning, gold, etc.)

### Institutional Learnings

- [learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md) — Progress ring sizing: `md` (72px) sweet spot in fixed-height cards. Gradient presets live in `src/data/pathCoverGradients.ts` as single source of truth — hero gradient should use the same preset module or a deterministic hash fallback.
- [ce-pipeline-visual-redesign-interactions-2026-05-06.md](docs/solutions/workflow-issues/ce-pipeline-visual-redesign-interactions-2026-05-06.md) — Visual redesigns need 2-3 review rounds. Type assertions in extracted component callbacks are the most common silent failure. Budget for test coverage gaps discovered in R1.
- [reports-page-redesign-patterns-2026-05-02.md](docs/solutions/best-practices/reports-page-redesign-patterns-2026-05-02.md) — Zone-based layout: hero zone at top, self-contained sections below. New components should load data via props (not store calls) for independent testability.

### Reference Design

- `/Volumes/SSD/Dev/Apps/DevOps/app/path/[id]/page.tsx` — DevOps devops-roadmap page (Next.js, hardcoded colors)
- Key design elements: hero banner (indigo→purple gradient), overlapping content area, syllabus timeline, sticky progress sidebar with SVG ring

## Key Technical Decisions

- **Create new components rather than modifying existing ones**: `PathHeroBanner` and `PathProgressSidebar` are new components that compose into `LearningPathDetail`. This keeps the page component focused on orchestration and preserves the existing sub-components untouched.
- **Reuse `PathProgressRing`**: The existing SVG ring component already handles configurable sizing, stroke-width, status colors, and accessibility attributes. The sidebar progress card wraps it rather than duplicating.
- **Use `--brand`/`--brand-hover` gradient (not hardcoded indigo/purple)**: The DevOps design uses `from-indigo-600 to-purple-800`. Knowlune's brand token (`--brand: #5e6ad2`) is a purple-blue, so the hero gradient uses `bg-gradient-to-br from-brand to-brand-hover` which adapts across color schemes (.vibrant, .clean, .apple).
- **Grid layout changes from 12-col to 3-col (8+4)**: The current `lg:grid-cols-12` layout maps to the same visual ratio as `lg:grid-cols-3` (8/12 = 2/3), but the new layout is simplified to `lg:grid-cols-3` for clarity, matching the reference design.
- **Content area uses `-mt-10` negative margin**: Overlaps the hero banner bottom, visually connecting the gradient to the white content cards.

## Implementation Units

- [ ] **Unit 1: PathHeroBanner component**

**Goal:** Create a gradient hero banner for the top of the path detail page.

**Requirements:** R1, R6, R7

**Dependencies:** None

**Files:**
- Create: `src/app/components/learning-path/PathHeroBanner.tsx`
- Test: `src/app/components/learning-path/__tests__/PathHeroBanner.test.tsx`

**Approach:**
- Full-width container with `bg-gradient-to-br from-brand to-brand-hover` (adapts across schemes; in Professional scheme this renders ~#5e6ad2→#4d57b5, which is analogous to the DevOps `from-indigo-600 to-purple-800`)
- Subtle radial highlight overlay: `bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)] opacity-20` (mirrors `PathCardHeader` pattern)
- Content constrained to `max-w-6xl mx-auto` with generous vertical padding (`pt-8 pb-20 px-8 lg:px-12`)
- Back link: `<Link to="/learning-paths">` with `ArrowLeft` class `size-4` + "Back to Learning Paths" in `text-white/80 hover:text-white`
- Metadata row (matches DevOps layout exactly):
  - Difficulty/category badge: `px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-widest`
  - Separator/clock icon + total duration: `flex items-center gap-1.5 text-white/80 text-sm font-medium`
- Title: `<h1>` in `font-display text-4xl lg:text-5xl font-bold tracking-tight mb-4` with `text-brand-foreground` (white on brand)
- Description: `<p>` in `text-white/80 text-lg leading-relaxed mb-8` (matches DevOps `text-indigo-100`)
- CTA button: `bg-card text-brand px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-soft transition-colors shadow-lg`
  - Icon: `PlayCircle` class `size-5`
  - Text: "Start Learning" (0% complete) or "Continue Learning" (>0%)
- Avatar stack: overlapping circles (4 thumbnails + overflow) with `ring-2 ring-brand` and `hover:scale-110 hover:z-20` transition
  - Overflow badge: `size-10 rounded-full bg-white/20 border-2 border-brand flex items-center justify-center text-xs font-bold`
- Props: `path`, `courseEntries`, `courseInfo`, `pathProgress`, `thumbnailUrls`, `onEdit`, `onDelete`

**Patterns to follow:**
- [LearningPathCard.tsx](src/app/components/learning-path/LearningPathCard.tsx) — avatar stack pattern (lines 184-205)
- [PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx) — gradient + radial highlight pattern
- [ContinueLearningBento.tsx](src/app/components/learning-path/ContinueLearningBento.tsx) — brand gradient overlay pattern

**Test scenarios:**
- Happy path: renders path title, description, course count, CTA button with correct link
- Happy path: renders avatar stack from thumbnail URLs (up to 4) with overflow count
- Happy path: when path has no course in progress, CTA says "Start Learning" linking to first course
- Happy path: when path has a course in progress, CTA says "Continue Learning" linking to current course
- Edge case: empty path (0 courses) — renders gracefully with 0 course count
- Edge case: no thumbnail URLs — renders placeholder icons in avatar positions
- Dark mode: gradient uses dark-brand tokens, text uses correct foreground tokens

**Verification:**
- Component renders in `LearningPathDetail` at top of page
- Gradient adapts across light/dark and color schemes
- All text passes 4.5:1 contrast on gradient background (white text on brand)

---

- [ ] **Unit 2: PathProgressSidebar component**

**Goal:** Create a sticky right-sidebar card showing path progress with SVG ring, stats, skills tags, and a completion reward card.

**Requirements:** R3, R6, R7

**Dependencies:** None (uses `PathProgressRing` from existing codebase)

**Files:**
- Create: `src/app/components/learning-path/PathProgressSidebar.tsx`
- Test: `src/app/components/learning-path/__tests__/PathProgressSidebar.test.tsx`

**Approach:**
- White card (`bg-card border border-border rounded-[var(--card-radius)]`) with `sticky top-24` positioning
- SVG progress ring: reuses `PathProgressRing` with `size="lg"` (96px), center shows "% Complete"
- Stats: "Modules Completed X/Y", "Estimated Time Left ~Xh" — computed from props
- Skills tags: `flex-wrap gap-2` of small badges using `bg-muted text-muted-foreground border border-border`
- Certificate card: dark decorative card at bottom with gold trophy icon, "Earn a Certificate" heading, description text, "View details" link
  - Uses `bg-gradient-to-br from-foreground to-foreground/80` (dark card) with `text-background` for contrast
  - Trophy icon from `Award` (lucide-react) with `text-gold`
- Props: `progress` (PathProgressSummary), `skillTags` (string[]), `totalModules`, `completedModules`, `estimatedTimeLeft` (string)

**Patterns to follow:**
- [PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — existing SVG ring (reused directly)
- [ControlCenter.tsx](src/app/components/learning-path/ControlCenter.tsx) — sidebar card layout pattern
- DevOps reference [page.tsx:166-232] — progress card + skills + certificate layout

**Test scenarios:**
- Happy path: renders progress ring with correct percentage, modules completed text, estimated time
- Happy path: renders skill tags from props
- Happy path: certificate card renders with trophy icon and description
- Happy path: 0% progress — ring shows empty arc, stats show 0/N
- Happy path: 100% progress — ring shows full arc in success color
- Edge case: empty skill tags — section renders without tags (or hidden)
- Edge case: 0h estimated time — renders "0h"
- Dark mode: card background and text tokens correct
- Sticky behavior: card stays in viewport while main content scrolls

**Verification:**
- Sidebar card visible on the right side of the detail page
- SVG ring animates with progress value
- Certificate card shows correctly in all color schemes

---

- [ ] **Unit 3: Restructure LearningPathDetail layout**

**Goal:** Integrate the hero banner and progress sidebar into the existing page, restructuring the layout while preserving all functionality.

**Requirements:** R2, R4, R5

**Dependencies:** Unit 1 (PathHeroBanner), Unit 2 (PathProgressSidebar)

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`
- Test: `src/app/pages/__tests__/LearningPathDetail.test.tsx`
- Test: `tests/e2e/learning-path-detail.spec.ts` (update if exists)

**Approach:**
- Replace the current header block (editable title, description, percentage, delete button) with `PathHeroBanner`
  - Move `InlineEditableField` controls into the hero banner component or keep them accessible via edit button in dropdown
  - Move delete button into dropdown menu in hero banner
- Restructure main content grid from `lg:grid-cols-12` to `lg:grid-cols-3` (8+4 equivalent)
  - Left (col-span-2): `ContinueLearningBento` + `PathTimeline` + gap entry summary
  - Right (col-span-1): `PathProgressSidebar` + rest of `ControlCenter` content
- Content area wrapper gets `-mt-10` negative margin to overlap hero banner bottom
- Keep all existing sub-component rendering logic intact:
  - Template banner (forkedFrom)
  - Gap entry summary
  - ContinueLearningBento
  - Completed courses strip
  - PathTimeline / reorder list
  - InlineCoursePicker (collapsible)
  - Import button
  - ControlCenter (up next, focus session, plan my week, AI ordering, study tips)
  - Delete confirmation dialog
  - AI order suggestion dialog
- Mobile: hero banner stacks vertically, sidebar moves below timeline

**Patterns to follow:**
- [LearningPathDetail.tsx](src/app/pages/LearningPathDetail.tsx) — current layout structure (preserved)
- DevOps reference [page.tsx:24-236] — hero + -mt-10 + 8/4 grid pattern

**Test scenarios:**
- Happy path: page renders hero banner at top, timeline on left, progress sidebar on right
- Happy path: back link navigates to /learning-paths
- Happy path: course list renders all entries with correct status indicators
- Happy path: all interactive elements work: edit title, delete, add course, reorder, suggest order
- Edge case: path with 0 courses — renders empty state without timeline or sidebar
- Edge case: path not found — renders EmptyState component
- Edge case: path from template — renders template banner below hero
- Responsive: at 375px, sidebar stacks below timeline, hero stacks vertically
- Dialog flows: delete confirmation, AI order suggestion, import wizard all functional
- E2E: user can navigate to path detail, see hero, interact with course list, and return to listing

**Verification:**
- Build passes with `npm run build`
- All existing tests pass
- Visual parity with DevOps reference design achieved (hero + overlapping content + sidebar)

---

- [ ] **Unit 4: Visual polish for PathTimeline cards**

**Goal:** Tweak the existing PathTimeline card styling to better match the DevOps syllabus card design (module number, status badge, description, metadata row, action button).

**Requirements:** R2

**Dependencies:** Unit 3 (layout restructured)

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx`

**Approach:**
- Module position number badge: `text-xs font-bold text-muted-foreground uppercase tracking-widest` (e.g., "MODULE 1")
- Status badge moved to prominent position next to module number:
  - Completed: `px-2 py-0.5 bg-success-soft text-success text-[10px] font-bold rounded-full uppercase tracking-wider` with checkmark icon
  - Up Next: `px-2 py-0.5 bg-brand-soft text-brand-soft-foreground text-[10px] font-bold rounded-full uppercase tracking-wider` with pulse dot
- Course title: `text-xl font-bold` (matches DevOps `h3` sizing)
- Course description: `text-sm text-muted-foreground leading-relaxed mb-4` (when available from `courseInfo.description` or course metadata)
- Metadata row: `flex items-center gap-6 text-sm text-muted-foreground font-medium` with:
  - Clock icon + estimated duration
  - Video/book icon + lesson count (if available from course metadata)
- Action button aligned right:
  - In-progress (next): `bg-brand hover:bg-brand-hover text-brand-foreground px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm` — "Start Module" with `PlayCircle` icon
  - Completed: `bg-muted hover:bg-muted/80 text-foreground px-5 py-2.5 rounded-xl text-sm font-bold` — "Review"
  - Locked: `bg-muted/50 text-muted-foreground px-5 py-2.5 rounded-xl text-sm font-bold cursor-not-allowed` — "Locked"
- Timeline node styling (enhanced from current):
  - Completed: `bg-success` with `Check` icon inside
  - In-progress (next): `bg-brand ring-4 ring-brand-soft` with pulsing dot
  - Locked: `bg-muted border-2 border-border` with small dot
  - Node position: `absolute -left-[17px]` (matches DevOps exact offset)
- These are visual additions — the existing click-to-navigate behavior is preserved
- `simplified` mode (mobile) omits the metadata row, action button, and timeline connector column

**Test scenarios:**
- Happy path: module cards show number, status badge, title, description, metadata, action button
- Happy path: next-in-line card shows "Start Module" brand button
- Happy path: completed card shows "Review" outline button
- Happy path: locked card shows "Locked" disabled state
- Simplified mode: cards show minimal content without metadata/action button

**Verification:**
- Timeline cards visually match the DevOps syllabus section layout
- No functional regressions in card click, gap entry resolution, or DnD

---

- [ ] **Unit 5: E2E tests for hero banner and progress sidebar**

**Goal:** Add E2E test coverage for the new visual elements on the path detail page.

**Requirements:** R1, R3

**Dependencies:** Unit 3

**Files:**
- Modify: `tests/e2e/learning-path-detail.spec.ts` (or create if absent)

**Approach:**
- Test: navigates to a learning path detail page, verifies hero banner is visible
- Test: verifies progress sidebar renders with SVG ring and stats
- Test: verifies back link returns to learning paths listing
- Test: verifies responsive layout at mobile breakpoint
- Test: verifies dark mode rendering

**Test scenarios:**
- Happy path: hero banner contains path title, description, course count, CTA
- Happy path: progress sidebar shows ring, modules stat, skills tags
- Navigation: clicking back link goes to /learning-paths
- Navigation: clicking CTA goes to current course
- Responsive: sidebar stacks at mobile viewport
- Dark mode: hero gradient and card backgrounds adapt correctly

**Verification:**
- E2E tests pass on Chromium
- Visual regression snapshot matches expected layout

## System-Wide Impact

- **Interaction graph:** Hero CTA links to `/courses/:courseId` — same navigation pattern as existing `ContinueLearningBento`. No new callback chains.
- **Error propagation:** Hero and sidebar are presentation-only; all data loading errors are already handled in `LearningPathDetail` via existing try/catch + toast error patterns.
- **State lifecycle risks:** No new state — hero and sidebar derive from existing store selectors (`useLearningPathStore`, `usePathProgress`, `useCourseImportStore`).
- **API surface parity:** No API changes. All data comes from existing stores.
- **Integration coverage:** The hero↔timeline↔sidebar interaction is a page-level layout concern — E2E tests in Unit 5 cover this cross-component integration.
- **Unchanged invariants:** Store interfaces (`useLearningPathStore`, `usePathProgress`, `useCourseImportStore`) are untouched. All existing dialog flows (delete, AI order, import) are unchanged. `PathTimeline`, `ContinueLearningBento`, and `ControlCenter` component interfaces are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Hero gradient may not achieve 4.5:1 contrast with white text in some color schemes (.clean, .apple) | Test contrast in all 4 schemes; if needed, add explicit per-scheme gradient tokens or overlay |
| Negative margin overlap may clip or z-index conflict with existing components | Use `relative z-10` on content area, test across breakpoints |
| Mobile layout may need different treatment than desktop (no overlapping hero) | Use responsive classes — no negative margin on mobile, stack vertically |
| Editable title/description currently in header — moving to hero may complicate inline editing | Keep `InlineEditableField` in hero with same props; delete action moves to dropdown menu |

## Sources & References

- **DevOps reference design:** `/Volumes/SSD/Dev/Apps/DevOps/app/path/[id]/page.tsx`
- **Current page:** [src/app/pages/LearningPathDetail.tsx](src/app/pages/LearningPathDetail.tsx)
- **Progress ring:** [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx)
- **Card header:** [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx)
- **Design tokens:** [src/styles/theme.css](src/styles/theme.css)
