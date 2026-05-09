---
title: "feat: Align learning path detail page design with DevOps roadmap reference"
type: feat
status: active
date: 2026-05-07
---

# feat: Align learning path detail page design with DevOps roadmap reference

## Overview

Redesign the `/learning-paths/:pathId` page to match the visual design of the DevOps reference page (standalone version at `~/Desktop/devops/devops-roadmap/index.html`). The current Knowlune page has diverged from the cleaner, more focused DevOps layout — particularly in the syllabus section, timeline styling, progress sidebar, and overall content organization. This plan aligns the visual design while preserving all existing Knowlune-specific functionality (gap resolution, AI ordering, DnD reorder, import wizard, study planning).

## Problem Frame

The current learning path detail page has accumulated multiple sections (ContinueLearningBento, Completed Courses strip, loose "Course Timeline" heading, ControlCenter) that create visual clutter compared to the DevOps reference. The DevOps page demonstrates a cleaner pattern:

- **Syllabus section**: A white card container with a clear "Syllabus" heading + module count, containing timeline entries with clean status dots and focused module cards
- **Progress sidebar**: A single sticky card with ring, stats, skills, and certificate — no extra widgets competing for attention
- **Content hierarchy**: Hero → Syllabus (2/3) + Progress (1/3) — nothing else

The goal is to bring this clarity to Knowlune while keeping all functional features. The DevOps reference design was chosen because its syllabus-card + progress-sidebar layout directly addresses the key usability issues observed in the current page: (a) a single scrolling syllabus container reduces cognitive load compared to multiple independently-scrolling sections, (b) the sticky progress sidebar keeps completion status visible without competing widgets, and (c) the hero-to-content overlap pattern creates a clear visual entry point that anchors the user before they explore the timeline. These patterns are well-established in learning platforms (Coursera, Udemy, Pluralsight all use left-aligned syllabus + right progress rail) and translate naturally to Knowlune's course-based learning path model.

## Requirements Trace

### Visual Design Alignment

- R1. The syllabus/timeline section must use a white card container with "Syllabus" heading and course count, matching DevOps
- R2. Timeline status dots must visually match DevOps: green check (completed), blue ringed dot (in-progress), grey dot (locked), dashed warning (gap)
- R3. Timeline entry cards must follow DevOps card layout: position number badge, status badge, title, description, metadata row, action button
- R4. Progress sidebar must match DevOps: centered ring, stat rows with icons, skills tags, certificate CTA card
- R5. Content area must use the same hero-overlap pattern and grid proportions as DevOps

### Functional Preservation

- R6. All existing functionality (gap resolution, AI ordering, DnD reorder, import wizard, course picker, study planning, milestones) must remain functional

### Technical Quality

- R7. Design tokens must be used throughout (no hardcoded colors) — the DevOps page uses hardcoded Tailwind colors; Knowlune must translate these to design tokens
- R8. Responsive behavior must work at mobile (375px), tablet (768px), and desktop (1440px). Note: these are device-testing targets, not CSS breakpoints. The project's CSS breakpoints (640px, 1024px, 1536px from Tailwind config) govern responsive behavior.

## Scope Boundaries

- This plan covers visual redesign of the `/learning-paths/:pathId` page
- It does NOT change the `/learning-paths` listing page or any other route
- It does NOT change data fetching, state management, or business logic
- It does NOT remove any existing functional features (gap resolution, AI order, DnD, import wizard, course picker, study planning, milestones, edit/delete)

### Deferred to Separate Tasks

- Learning path listing page card redesign: [docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md](docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md)
- Progress ring refactor: [docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md](docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md)

## Context & Research

### Relevant Code and Patterns

**Reference design (DevOps):**
- `app/path/[id]/page.tsx` — Full detail page with hero, syllabus card, progress sidebar
- Hero: `bg-gradient-to-br from-indigo-600 to-purple-800` with `pt-8 pb-20` / content `-mt-10`
- Syllabus: `bg-white rounded-2xl shadow-sm border p-8` with `border-l-2 border-slate-100` timeline
- Timeline dots: `-left-[17px]` positioned, `border-4 border-white` ring, 32px (w-8 h-8)
- Module cards: `rounded-2xl p-6 border`, module N + status badge + title + description + metadata + action button
- Progress sidebar: `sticky top-6`, white card with `shadow-lg`, centered ring, stat rows, hr dividers, skills tags, dark cert CTA card

**Current Knowlune implementation:**
- `src/app/pages/LearningPathDetail.tsx` — Page orchestrator (1131 lines)
- `src/app/components/learning-path/PathTimeline.tsx` — Timeline with connector column, StatusCircle, GapTimelineEntry, CourseTimelineEntry
- `src/app/components/learning-path/PathProgressSidebar.tsx` — Sticky sidebar with PathProgressRing, stats, skills, cert card
- `src/app/components/learning-path/PathHeroBanner.tsx` — Already close to DevOps hero (gradient, back link, badges, title, desc, CTA, avatars)
- `src/app/components/learning-path/ContinueLearningBento.tsx` — Current course highlight (no DevOps equivalent)
- `src/app/components/learning-path/ControlCenter.tsx` — Right-rail extras: Up Next, Focus Session, Plan My Week, AI Ordering, Study Tip

### Terminology Note

In the DevOps reference, learning content is organized as "modules" within a "roadmap." In Knowlune, the equivalent concept is "courses" within a "learning path." Throughout this plan, "course" and "module" are used interchangeably when describing the timeline entries — both refer to a `LearningPathEntry` pointing to a course. The DevOps heading "N Modules" maps to Knowlune's course count for the path.

### Institutional Learnings

- Design token enforcement: all colors must use design tokens (`bg-brand`, `text-muted-foreground`, `border-border`) — never hardcoded Tailwind colors. The DevOps reference uses hardcoded colors (`slate-*`, `indigo-*`, `blue-*`); these must be translated to Knowlune tokens.
- `docs/solutions/best-practices/` contains patterns for component extraction and visual consistency.

## Key Technical Decisions

- **Keep PathTimeline as the base, restyle it**: Rather than creating a new Syllabus component, update `PathTimeline` and its subcomponents to match DevOps visual style. This preserves all existing functionality (gap entries, auto-scroll, simplified mode, keyboard navigation) while changing only the visual layer.
- **Wrap timeline in a Syllabus card in the page**: The white card container with heading and module count is a page-level layout concern, not a component concern. Add it in `LearningPathDetail.tsx` around the `PathTimeline`.
- **Position ContinueLearningBento above the syllabus card, with timeline deduplication**: The DevOps design has no separate "continue learning" section — the current module is simply the highlighted entry in the syllabus. Keep `ContinueLearningBento` as a separate component positioned above the syllabus card, styled to flow naturally. To avoid showing the same course twice, skip the current in-progress entry from `PathTimeline` when `ContinueLearningBento` is rendered (controlled via a `skipEntryId` prop). When the path is 100% complete and `ContinueLearningBento` is not rendered, show all entries in the timeline normally. The gap between hero and syllabus card at 100% completion is filled by a "Path Complete" status banner (see Unit 1 approach).
- **Keep ControlCenter but reorganize by usage priority**: The DevOps page only has the progress card in the right column. Keep ControlCenter sections since they provide real functionality, but reorder them by likely usage frequency: Up Next and Plan My Week (most-used, top) → Focus Session and AI Ordering (mid) → Study Tip (least-used, bottom). Group lower-priority sections into a collapsible card so they don't force excessive scrolling. Use the existing shadcn/ui `Collapsible` component: Focus Session and AI Ordering each get an independent `Collapsible` with a Chevron toggle that expands/collapses their content. Study Tip is a standalone `Collapsible` collapsed by default. The three groups maintain their vertical order with `space-y-4` between groups.
- **Translate DevOps hardcoded colors to design tokens**: The DevOps page uses `slate-50`, `slate-100`, `slate-200`, `indigo-600`, `blue-600`, etc. Map these to Knowlune tokens: `bg-card` for white cards, `border-border` for borders, `bg-brand` for primary accent, `text-muted-foreground` for secondary text, `bg-muted` for inactive states.

## Open Questions

### Resolved During Planning

- **Should we remove ContinueLearningBento?** No — keep it as a quick-resume affordance above the syllabus, but style it to feel like part of the same visual system.
- **Should we remove ControlCenter sections?** No — Up Next, Focus Session, Plan My Week, AI Ordering, and Study Tip all serve real user needs. Move them below the progress sidebar.
- **Do we use a white card container like DevOps?** Yes — wrap the syllabus section in a card matching DevOps (`bg-card rounded-2xl shadow-sm border p-8`).

### Deferred to Implementation

- Exact mapping of DevOps spacing values to Knowlune design tokens — see Unit 5 for the approach to audit and align during implementation
- Whether the `PathProgressRing` should increase from 96px to 128px (requiring a new `xl` entry in the `SIZES` constant or a raw numeric `size={128}`)

## Implementation Units

- [ ] **Unit 1: Syllabus Card Container & Section Heading**

**Goal:** Wrap the timeline area in a white card container with "Syllabus" heading and module count, matching the DevOps syllabus section.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`
- Test: `src/app/pages/__tests__/LearningPathDetail.test.tsx`

**Approach:**
- Replace the standalone `<h2>Course Timeline</h2>` heading with a card wrapper around the timeline section
- The card wrapper: `bg-card rounded-2xl shadow-sm border border-border p-6 lg:p-8`
- Card header row: "Syllabus" heading (`font-display text-2xl font-bold`) + course count (`text-muted-foreground text-sm`: "N Courses")
- Position `ContinueLearningBento` above the syllabus card (outside it), styled to visually connect
- Remove the standalone "Completed Courses" horizontal strip. The aggregate completion count is already available in the progress sidebar's "Modules Completed X/Y" stat row, and per-course completion is visible via timeline status dots. The horizontal strip was redundant with both of these.
- When the path is 100% complete (no `currentEntry` and therefore no `ContinueLearningBento`), render a "Path Complete" status banner in the space between hero overlap and syllabus card. The banner uses a subdued success variant (`bg-success-soft border border-success/20 rounded-2xl p-4`) with a trophy/check icon and "All courses completed" message.
- Pass a `skipEntryId` prop to `PathTimeline` so the current course shown in `ContinueLearningBento` is not duplicated as a timeline entry inside the syllabus card.

**Patterns to follow:**
- DevOps `app/path/[id]/page.tsx` lines 77-81 (syllabus section header)
- Knowlune `PathTimeline.tsx` — the component itself doesn't change in this unit, only its container

**Test scenarios:**
- Happy path: Syllabus card renders with heading "Syllabus" and correct course count when courses exist
- Happy path: Current in-progress course appears in ContinueLearningBento above the syllabus card but is skipped in the PathTimeline (no duplicate)
- Edge case: At 100% completion, ContinueLearningBento is not rendered and a "Path Complete" banner fills the space above the syllabus card
- Edge case: Syllabus card adapts to mobile (reduced padding, single column)
- Integration: The progress sidebar's "Modules Completed X/Y" stat row shows the same aggregate count previously shown by the removed completed courses strip

**Verification:**
- The page shows a white card container around the timeline with "Syllabus" heading and course count
- No course appears twice on the page (once in ContinueLearningBento and again in timeline)
- The visual structure matches DevOps: hero → content overlap → grid (2/3 syllabus card + 1/3 sidebar)

---

- [ ] **Unit 2: Timeline Visual Refresh**

**Goal:** Update PathTimeline subcomponents (StatusCircle, CourseTimelineEntry, GapTimelineEntry, EntryActionButton) to match DevOps visual style. Add `skipEntryId` prop to support deduplication with ContinueLearningBento.

**Requirements:** R2, R3

**Dependencies:** Unit 1 (syllabus card provides the container context; `skipEntryId` prop contract defined)

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx`
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**

**New prop: `skipEntryId?: string`**
- When provided, the timeline skips rendering the entry whose `courseId` matches this value. Used by the page to prevent the current course from appearing both in `ContinueLearningBento` and in the timeline. Position numbering (`Module N`) displays the entry's ordinal position from the data array, which remains unchanged when `skipEntryId` excludes an entry from rendering — skipped entries do not occupy a position number, and remaining entries retain their original data-ordinal positions.

**StatusCircle changes:**
- Increase size from `size-7` (28px) to `size-8` (32px) to match DevOps
- Add `border-4 border-card` ring around each dot (the card background color creates the "floating dot" effect). **In simplified/mobile mode**, the connector column is hidden so there is no card-background line behind the dots. For simplified mode, reduce the dot to `size-6` (24px) without the border ring, or render a compact inline status badge instead of a standalone dot.
- Completed: `bg-success text-success-foreground` with white checkmark
- In-progress: `bg-brand text-brand-foreground` with `ring-4 ring-brand-soft` blue glow (remove the separate pulse ring div — make it part of the dot)
- Locked: `bg-muted` with grey inner dot
- Gap: keep the dashed warning style but update size

**Connector line changes:**
- Replace the current per-entry gradient connector with a single `border-l-2 border-border` running the full height (like DevOps `border-l-2 border-slate-100`)
- Adjust dot positioning to `-left-[17px]` (half of 32px + border offset)

**CourseTimelineEntry card content simplification (UX trade-off):**
- **Decision**: Remove `CourseThumbnail` and author name from the card metadata row. This is a content simplification, not purely visual — it reduces at-a-glance identification affordances (visual thumbnail scan, author-name recognition).
- **Trade-off**: Cleaner, less dense cards matching the DevOps reference vs. losing two visual signals users may rely on to locate specific courses in a long timeline.
- **Justification for removal**: Within the learning path detail page, users are browsing a **curated, ordered timeline** — not searching a catalog. The path title, module position ("Module N"), and course title together provide sufficient spatial context for identification. Users do not need thumbnail-based visual scanning because the timeline is sequential and scoped to a single path (typically 5-15 courses), not the full course library. The `CourseTypeBadge` ("Imported" / "Catalog") communicates **actionable metadata** (whether the course is available in the user's library or needs to be sourced) which is more useful in the timeline context than a decorative thumbnail. By contrast, a thumbnail's primary value is during open-ended browsing/discovery, which is not the user's task on this page.
- **Mitigation**: Keep a compact `CourseTypeBadge` ("Imported" / "Catalog") in the metadata row. If user feedback indicates the loss of thumbnails/authors is a regression, they can be restored in a follow-up as a compact inline variant (e.g., 32x32 rounded thumbnail left-aligned on the card).

**Card content structure (restructured):**
- Row 1: module number badge + status badge
- Row 2: course title
- Row 3: description (from `courseInfo` if available, otherwise omitted — not all courses have descriptions)
- Row 4 (metadata): compact `CourseTypeBadge` + duration + course count
- Row 5: right-aligned action button (Start Module / Review / Locked)

**Card styling:**
- Cards use `rounded-2xl p-6` with `hover:shadow-md` transition
- In-progress card gets `border-brand/20 ring-1 ring-brand/5` highlight
- Completed card gets subtle `border-success/20` treatment

**DnD drag handle design (Knowlune-specific addition):**
The DevOps reference does not have DnD reorder functionality. Knowlune's existing DnD must be preserved with a clear visual affordance on the restyled cards.

- Each course timeline card receives a drag handle on its **left edge**, implemented as a `GripVertical` icon from `lucide-react`.
- **Desktop**: handle is `opacity-0` by default, transitions to `opacity-100` on card hover (`group-hover:opacity-100` with `transition-opacity duration-200`). Uses `cursor-grab` (and `cursor-grabbing` when actively dragging).
- **Touch devices**: handle is always visible (`opacity-100` on any device with `hover: none` pointer, detected via a `touch-device` class or `@media (hover: none)` query).
- The handle occupies a dedicated column (approximately `w-8`) on the card's left side, separated from the card content by a subtle `border-r border-border` divider within the card. The handle area is vertically centered with `items-center self-stretch flex`.
- **Spacing impact**: The card grid layout adjusts from a single content block to `flex` with two sections: the drag handle column (`flex-shrink-0 w-8 flex items-center justify-center`) and the main content area (`flex-1`). The card's `p-6` padding is maintained on the content side; the handle column may reduce the content width by ~2rem, which is acceptable given the card's typical content load (title + description + metadata).
- **GapTimelineEntry**: Gap cards also receive the drag handle, since gaps are reorderable within the path timeline (gap resolution may involve reordering).
- **Accessibility**: The handle has `role="button"` and `aria-label="Reorder course"`. On focus-visible, it shows a `ring-2 ring-brand` outline. Keyboard reorder (via `aria-roledescription="sortable"` on the list container) is handled by the existing DnD library integration and is unaffected by the visual changes.

**Drag visual feedback during reorder:**

- When a card is being dragged, the card receives `opacity-50` (the original position shows a semi-transparent ghost) while the dragged element shows a `shadow-xl` elevated state with `rotate-1` slight tilt.
- Drop zone between cards shows a `border-t-2 border-brand` dashed line indicator (2px tall, full card width) to show exactly where the card will land.

**Timeline entry interaction states:**

All timeline entry cards share these interaction states, specified using design tokens:

| State | Visual treatment | Applied via |
| --- | --- | --- |
| **Loading** | Skeleton pulse: `animate-pulse` on a placeholder block matching the card's dimensions (`rounded-2xl h-[120px]`). Background uses `bg-muted`. Content areas (title line, description lines, metadata row) show `rounded-md bg-muted` placeholder bars. | `className="animate-pulse bg-muted rounded-2xl"` on skeleton container |
| **Error** | Card tinted with `bg-destructive/5 border-destructive/30`. An `AlertCircle` icon from `lucide-react` in `text-destructive` appears on the left, with "Failed to load" text (`text-sm text-destructive`). A "Retry" ghost button (`variant="ghost"` with `size="sm"`) sits right-aligned. | Inline error state rendered inside the card, replacing normal card content |
| **Drag active** (the card being dragged) | Elevated shadow: `shadow-xl` (replaces `shadow-sm` on the syllabus card container; entry card gets `shadow-lg`). `scale-[1.02]` transform. Blue border ring: `ring-2 ring-brand`. Card background remains `bg-card`. The original position shows a ghost with `opacity-30`. | Applied dynamically by DnD library during drag (set via `classNames` option or `onDragStart`/`onDragEnd` callbacks) |
| **Drag over** (drop target indicator between cards) | A `border-t-2 border-brand` dashed line, full card width, positioned between the two cards. Uses `border-dashed` + `border-brand`. The line is 2px tall (`border-t-2`). Combined with a subtle `bg-brand/5` highlight on the drop zone area (approximately 8px vertical). | Inserted as an `h-2 w-full` div with `border-t-2 border-dashed border-brand bg-brand/5` between cards during drag-over |
| **Hover** (desktop) | Subtle shadow elevation: `hover:shadow-md transition-shadow duration-200`. Drag handle appears (`group-hover:opacity-100`). No other visual change — card border remains stable to avoid layout shift. | `className="hover:shadow-md transition-shadow duration-200 group"` on card root |
| **Focus-visible** (keyboard) | `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` applied to the card's interactive wrapper. The drag handle also gets `focus-visible:ring-2 focus-visible:ring-brand` when focused independently. | `className="focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-2xl"` |
| **Touch tap** | No hover state (touch devices don't hover). Tap shows a brief `active:scale-[0.99]` micro-interaction (100ms `transition-transform`). Drag handle is always visible on touch. | `className="active:scale-[0.99] transition-transform duration-100"` |

**EntryActionButton changes:**
- "Start Module" (in-progress): `variant="brand"` matching DevOps blue button
- "Review" (completed): `variant="outline"` matching DevOps grey button
- "Locked": `bg-muted text-muted-foreground cursor-not-allowed`

**Patterns to follow:**
- DevOps `app/path/[id]/page.tsx` lines 83-158 (timeline loop with dots and cards)
- Knowlune design token system: `bg-card`, `border-border`, `bg-brand`, `text-muted-foreground`, `bg-success`, `bg-muted`

**Test scenarios:**
- Happy path: Completed entry shows green dot with checkmark, "Completed" badge, "Review" button
- Happy path: In-progress entry shows brand dot with pulse ring, "Up Next" badge, "Start Module" button
- Happy path: Locked entry shows grey dot, no badge, disabled "Locked" indicator
- Happy path: Gap entry shows dashed warning dot, "Not in your library" badge, resolution buttons
- Edge case: First non-gap entry when no progress exists defaults to in-progress (existing behavior, visual only)
- Edge case: Simplified mode (mobile) omits connector column but shows cards; StatusCircle uses compact variant (size-6, no border ring)
- Edge case: When `skipEntryId` is provided, the matching course entry is excluded from the timeline but position numbering continues sequentially for remaining entries
- Integration: Clicking a course card navigates to `/courses/:courseId`
- Integration: Gap resolution buttons fire correct callbacks (import, match, replace)

**Verification:**
- Timeline dots, cards, and action buttons visually match the DevOps reference
- All existing PathTimeline functionality (gap resolution, auto-scroll, keyboard nav, simplified mode) still works
- The `skipEntryId` prop correctly excludes the specified entry without affecting position numbering

---

- [ ] **Unit 3: Progress Sidebar Visual Alignment**

**Goal:** Update PathProgressSidebar to match the DevOps progress card styling exactly.

**Requirements:** R4

**Dependencies:** None (can be done in parallel with Units 1-2)

**Files:**
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx`
- Test: `src/app/components/learning-path/__tests__/PathProgressSidebar.test.tsx`

**Approach:**
- Progress card: `bg-card rounded-2xl shadow-lg border border-border p-6`
- "Your Progress" heading: `font-display text-lg font-bold mb-6`
- Centered ring: keep `PathProgressRing` at `size="lg"` (96px) or pass `size={128}` for parity with DevOps 128px ring. Note: the component's `SIZES` constant only defines `sm`/`md`/`lg` presets — a new `xl` entry or raw numeric value must be used if increasing beyond 96px.
  - **Concrete action**: Verify other `PathProgressRing` consumers before modification. If `size="lg"` is used elsewhere, add a new `size="xl"` entry (128px) rather than modifying `lg`. Add `xl: 128` to the `SIZES` constant.
  - **File search**: `grep -r "PathProgressRing" src/` to identify all consumers.
- Stat rows: icon + label on left, value on right (`ml-auto`), `text-sm font-medium`, consistent `py-1`
- Dividers between sections: `border-border` horizontal rules (matching DevOps `hr` elements)
- Skills section: "Skills you'll gain" heading → flex-wrap tags with `bg-muted border border-border rounded-md text-xs font-bold`
- Certificate card: dark gradient card (`bg-gradient-to-br from-foreground to-foreground/80`) with semi-transparent trophy overlay, gold icon, "Earn a Certificate" heading, "View details" link in gold

**Patterns to follow:**
- DevOps `app/path/[id]/page.tsx` lines 167-231 (progress card)
- Current Knowlune `PathProgressSidebar.tsx` — already structurally similar, needs visual refinements
- **Note on shadow hierarchy**: The syllabus card uses `shadow-sm` while the progress sidebar uses `shadow-lg`. This disparity mirrors the DevOps reference and creates intentional visual hierarchy — the sidebar appears elevated as a floating control panel, while the syllabus card sits flat in the content flow.

**Test scenarios:**
- Happy path: Sidebar shows progress ring, stats, skills tags, and certificate card
- Edge case: Sidebar renders correctly with 0% progress
- Edge case: Sidebar renders correctly with 100% progress
- Edge case: Sidebar handles missing skillTags gracefully (skills section hidden)
- Edge case: Sticky positioning works on scroll (desktop)
- Responsive: Sidebar stacks below content on mobile (non-sticky)

**Verification:**
- The progress sidebar visually matches the DevOps reference
- All existing data (completionPct, completedCourses, totalCourses, estimatedRemainingHours, skillTags) displays correctly

---

- [ ] **Unit 4: Right Column Reorganization**

**Goal:** Restructure the right column to position the progress sidebar first, followed by course actions and ControlCenter sections, matching the DevOps single-card pattern while preserving all functionality.

**Requirements:** R6

**Dependencies:** Unit 3

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`

**Approach:**

**Scope note (intentional expansion):** This unit extends beyond pure visual alignment into layout reorganization. The DevOps reference has only the progress card in the right column — no actions card or ControlCenter sections. To make the right column match the DevOps visual rhythm while preserving all Knowlune-specific functionality, the existing sections must be reordered and regrouped. This reorganization is a natural consequence of the design alignment work: the DevOps reference's cleaner right-column layout (single progress card) forces a reassessment of how Knowlune's additional UI sections fit into the same visual hierarchy. The scope expansion is intentional and bounded — it only changes the order and grouping of existing elements, without adding new functionality or removing existing features. See the "Deferred to Separate Tasks" section for items explicitly out of scope.

- Move `PathProgressSidebar` to the top of the right column (it's already there, keep it)
- Group "Add Course" + "Import Course" into a compact actions card below the progress sidebar. The card contains two side-by-side buttons: "Add Course" (brand variant, left) and "Import" (brand-outline variant, right). The Add Course button remains a `CollapsibleTrigger` — clicking it expands the `InlineCoursePicker` panel *below* the actions card (not inside it). The Import button visibility is unchanged (hidden when picker is open, matching existing behavior).
  - **InlineCoursePicker positioning behavior (precise specification):**
    - The picker panel renders in **normal document flow** below the actions card — NOT as an overlay or absolute-positioned element. It pushes subsequent content (ControlCenter) down when expanded.
    - The "Import" button lives inside the actions card alongside "Add Course". Its visibility follows the existing toggle: hidden when the picker panel is open, visible when closed.
    - When the picker panel is open, the "Add Course" button shows an active/selected state: `bg-brand-hover ring-2 ring-brand/30` to indicate the panel is triggered and active.
    - **Close behavior**: The panel closes via either (a) clicking the "Add Course" button again (toggle), or (b) clicking an explicit `X` button (`<X className="w-4 h-4" />` with `variant="ghost" size="icon-sm"`) positioned in the top-right corner of the picker panel header. The `X` is the primary close affordance for keyboard and screen reader users.
    - **Smooth transition**: The panel uses a height animation via `transition-all duration-300 ease-out` with `overflow-hidden` on the wrapper. When collapsed, the wrapper has `max-h-0`; when expanded, it transitions to `max-h-[500px]` (sufficient for the picker's typical content height). Content inside fades in with `transition-opacity duration-200 delay-100`.
    - **No layout shift on close**: The panel's height animates smoothly to 0 before being removed from the DOM via conditional rendering (`isOpen ? <PickerPanel /> : null` with the CSS transition wrapper).
- Position `ControlCenter` below the actions card + optional picker panel area
- Apply consistent spacing (`space-y-6`) between right column sections
- The overall order: Progress Sidebar → Actions Card → (InlineCoursePicker panel, when expanded) → ControlCenter
- ControlCenter sections are ordered by usage priority: Up Next + Plan My Week (top), Focus Session + AI Ordering (middle, collapsible), Study Tip (bottom)
- On mobile, the right column stacks naturally below the syllabus

**Patterns to follow:**
- DevOps page has only the progress card in the right column — we extend this pattern with Knowlune-specific actions below
- Current `LearningPathDetail.tsx` lines 910-973 for existing right column structure

**Test scenarios:**
- Happy path: Right column shows progress sidebar, actions card (2 side-by-side buttons), and ControlCenter in order
- Happy path: "Add Course" button in the actions card expands the InlineCoursePicker panel below the card
- Happy path: "Import Course" button opens the import wizard; button is hidden when the course picker panel is open
- Happy path: ControlCenter sections appear in usage-priority order (Up Next first, Study Tip last)
- Edge case: Empty path (no courses) shows EmptyState in content area, right column shows only progress sidebar and actions card
- Responsive: Right column stacks below syllabus on mobile, all sections accessible

**Verification:**
- Right column is organized with clear visual hierarchy
- All interactive elements (buttons, collapsible, ControlCenter sections) remain functional
- No functionality is lost or broken

---

- [ ] **Unit 5: Layout Polish & Design Token Audit**

**Goal:** Fine-tune overall page layout (hero overlap, grid spacing, max-width, padding) and ensure all colors use design tokens.

**Requirements:** R5, R7, R8

**Dependencies:** Units 1-4

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`
- Modify: `src/app/components/learning-path/PathHeroBanner.tsx`
- Modify: `src/app/components/learning-path/ControlCenter.tsx`
- Modify: `src/app/components/learning-path/ContinueLearningBento.tsx`

**Approach:**
- Verify hero uses `pt-8 pb-20` with content area `-mt-10` for proper overlap (already close, audit exact values)
- Content grid: keep `grid grid-cols-1 lg:grid-cols-3` with the existing `gap-[var(--content-gap)]` token. The `--content-gap` variable (1.5rem default, 2rem in spacious mode) is used across 30+ locations and must not be replaced with hardcoded values. DevOps uses `gap-8 md:gap-12` as a reference for overall proportions, not literal values to copy.
- Max content width: ensure `max-w-6xl mx-auto px-4 lg:px-8` consistency
- **Tablet responsive strategy (768px-1023px):** The CSS `lg:` breakpoint at 1024px means tablets see the single-column mobile layout. At 768px specifically: (a) the grid is single-column, (b) the sidebar is NOT sticky (scrolls with content), (c) the syllabus card uses `p-6` (not `p-8`), (d) `ContinueLearningBento` stacks vertically (`flex-col`), (e) PathTimeline uses simplified mode (no connector column). No additional breakpoint-specific CSS is needed — the mobile layout covers tablet adequately.
- **Design token audit scope:** Audit only the files NOT already covered by Units 2-3: `PathHeroBanner.tsx`, `ControlCenter.tsx`, and `ContinueLearningBento.tsx`. PathTimeline and PathProgressSidebar tokens were already specified in their respective units and verified by their unit tests. The page-level `LearningPathDetail.tsx` token audit focuses on the new card wrappers and layout classes added in Units 1 and 4.
- Remove any leftover references to old class names or patterns
- Verify `staggerContainer` / `fadeUp` animations still work correctly with the new layout
- Check font usage: DevOps uses `font-heading` (Manrope) for headings; Knowlune uses `font-display`. Ensure consistent application.

**Patterns to follow:**
- [src/styles/theme.css](src/styles/theme.css) — design token definitions
- [.claude/rules/styling.md](.claude/rules/styling.md) — token usage rules
- DevOps `app/path/[id]/page.tsx` — layout reference

**Test scenarios:**
- Visual: Hero overlaps content area correctly at all breakpoints
- Visual: No hardcoded colors remain in any modified file (verify via ESLint `design-tokens/no-hardcoded-colors`)
- Responsive: Layout works at 375px, 768px, 1024px, 1440px — no horizontal scroll
- Accessibility: All interactive elements maintain 4.5:1 contrast, focus indicators visible, keyboard navigation works
- Animation: `prefers-reduced-motion` respected, no jarring transitions

**Verification:**
- ESLint passes with no design-token violations in modified files
- `npm run build` succeeds
- Visual comparison between Knowlune page and DevOps reference shows clear design alignment
- All existing E2E tests pass

**Automated visual regression testing:**

To prevent regressions in the redesigned layout from going undetected, add Playwright screenshot comparison tests:

**(a) Screenshots to capture:**

| Page/State | Viewport | Selector/Full Page | Expected State |
|------------|----------|-------------------|----------------|
| Hero banner | 1440x900 | `.hero-banner` (or `#learning-path-hero`) | Gradient, back link, badges, title, description, CTA, avatars |
| Syllabus section | 1440x900 | `.syllabus-card` or `#syllabus-section` | White card with heading, module count, timeline entries |
| Timeline entry — in-progress | 1440x900 | First non-completed `.timeline-entry` | Blue dot with ring, "Up Next" badge, Start Module button |
| Timeline entry — completed | 1440x900 | First completed `.timeline-entry` | Green check dot, "Completed" badge, Review button |
| Timeline entry — locked | 1440x900 | Last `.timeline-entry` | Grey dot, Locked button |
| Progress sidebar | 1440x900 | `.progress-sidebar` or `#progress-sidebar` | Ring, stats, dividers, skills tags, certificate card |
| Right column full | 1440x900 | Right grid column | Progress sidebar + actions card + ControlCenter in order |
| Mobile layout | 375x812 | Full page | Single column, no connector, stacked sections |
| Tablet layout | 768x1024 | Full page | Single column, no sticky sidebar |
| 100% complete state | 1440x900 | Full page | "Path Complete" banner, no ContinueLearningBento |
| Empty path state | 1440x900 | Full page | Empty state in content area |
| Course picker expanded | 1440x900 | Full page | InlineCoursePicker visible below actions card |

**(b) How snapshots are stored and compared:**

- Use Playwright's `toHaveScreenshot()` (built-in pixel comparison) via `@playwright/test` expect
- Store snapshots in `tests/e2e/snapshots/` following the pattern `{spec-name}--{state-name}-{viewport}.png`
- Add a `test-visual.spec.ts` (or extend the existing learning-path E2E spec) that:
  - Seeds IndexedDB with deterministic test data (a path with 5+ courses in various states: completed, in-progress, locked, gap)
  - Navigates to `/learning-paths/:pathId`
  - Waits for the page to be fully loaded and all animations to settle (wait for `networkidle` + a brief `waitForTimeout(500)` after last render)
  - Takes screenshots at the viewports and states listed above
  - Uses the project's IndexedDB seeding fixtures (see `tests/support/fixtures/`) for deterministic data
- Run as part of the E2E test suite: `npx playwright test --grep @visual` or integrate into the existing learning-path E2E spec

**(c) Snapshot update workflow:**

When visual changes are intentionally made:
1. Run `npx playwright test --grep @visual --update-snapshots` to regenerate all baseline snapshots
2. Review the diff for each changed snapshot to confirm the change is intentional
3. Commit the updated snapshots alongside the code changes
4. If a snapshot change is unintentional, the test fails and the implementer must fix the regression before merging

## System-Wide Impact

- **Interaction graph:** The page orchestrator (`LearningPathDetail.tsx`) is the main integration point. PathTimeline, PathProgressSidebar, ContinueLearningBento, and ControlCenter are leaf components that receive props — their internal changes don't affect other consumers.
- **Error propagation:** Unchanged — error boundaries and toast notifications remain as-is
- **State lifecycle risks:** None — no state management changes. All Zustand stores, hooks, and data flow remain identical.
- **API surface parity:** PathTimeline and PathProgressSidebar props don't change (only internal styling). No breaking contract changes.
- **Integration coverage:** Timeline auto-scroll, gap resolution callbacks, course click navigation, DnD reorder, AI order dialog, import wizard integration — all remain functional and should be verified in E2E tests.
- **Unchanged invariants:** `useLearningPathStore`, `usePathProgress`, `usePathMilestones`, `useImportWizardTrigger` — no changes to any store or hook. Route definition in `routes.tsx` unchanged. `EditPathDialog` and `ImportWizardDialog` unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| PathTimeline is used on other pages (if any) — visual changes might affect them | Verify PathTimeline consumers before starting; the component is currently only used on LearningPathDetail |
| The new `skipEntryId` prop on PathTimeline could cause off-by-one errors in position numbering or auto-scroll | Keep position numbers stable regardless of skip (position is a data property, not a render index). Auto-scroll targets the correct entry by ID, not index. |
| ControlCenter sections below the progress sidebar + actions card may receive less user attention | Order sections by usage priority (Up Next + Plan My Week first); make lower-priority sections (Focus Session, AI Ordering, Study Tip) collapsible so they don't force scrolling |
| CourseThumbnail and author name removal from timeline cards may reduce at-a-glance course identification | Keep `CourseTypeBadge` as a compact visual signal. If user feedback indicates regression, restore thumbnails/authors as a compact inline variant in a follow-up. |

## Sources & References

- **Reference design (primary):** `~/Desktop/devops/devops-roadmap/index.html` — standalone HTML version of the DevOps roadmap page, accessible on the author's machine. Contains the hero banner, syllabus card, timeline, and progress sidebar in a single file.
- **Reference design (Next.js):** `/Volumes/SSD/Dev/Apps/DevOps/app/path/[id]/page.tsx` — original Next.js implementation (may not be accessible on other machines).
- **Current implementation:** [src/app/pages/LearningPathDetail.tsx](src/app/pages/LearningPathDetail.tsx)
- **Timeline component:** [src/app/components/learning-path/PathTimeline.tsx](src/app/components/learning-path/PathTimeline.tsx)
- **Progress sidebar:** [src/app/components/learning-path/PathProgressSidebar.tsx](src/app/components/learning-path/PathProgressSidebar.tsx)
- **Hero banner:** [src/app/components/learning-path/PathHeroBanner.tsx](src/app/components/learning-path/PathHeroBanner.tsx)
- **Design tokens:** [src/styles/theme.css](src/styles/theme.css)
- **Styling rules:** [.claude/rules/styling.md](.claude/rules/styling.md)

---

## Appendix: Design Reference Specifications

This appendix documents the concrete CSS, layout measurements, colors, and component structure extracted from the DevOps reference files at plan-writing time. Any implementer can reproduce the design without accessing the original files. All hardcoded colors below are the DevOps originals; the implementer must translate them to Knowlune design tokens (see `src/styles/theme.css` and `.claude/rules/styling.md`).

### A1. Hero Banner

```
┌──────────────────────────────────────────────────────────────┐
│  bg-gradient-to-br from-indigo-600 to-purple-800             │
│  pt-8 pb-20 px-8 lg:px-12                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ← Back to Learning Paths          (max-w-6xl mx-auto) │  │
│  │                                                         │  │
│  │  [Advanced]  🕐 14h 45m                                │  │
│  │                                                         │  │
│  │  DevOps Roadmap (font-heading text-4xl lg:text-5xl)    │  │
│  │  bold tracking-tight mb-4                               │  │
│  │                                                         │  │
│  │  Master the tools and practices...                      │  │
│  │  text-indigo-100 text-lg leading-relaxed mb-8           │  │
│  │                                                         │  │
│  │  [▶ Continue Learning]  [🙎🙎🙎🙎 +8k]                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                    ▲ content area ↓ -mt-10 (overlap)
```

**CSS specification:**
- `background: linear-gradient(to bottom right, #4f46e5, #7c3aed)` — maps to `bg-gradient-to-br from-brand to-brand/70` (use `bg-brand` and a darker brand variant)
- Padding: `padding: 2rem 2rem 5rem 2rem` (pt-8 pb-20 px-8), `padding-left: 3rem; padding-right: 3rem` at lg+
- Back link: `color: #e0e7ff` (`text-indigo-100`), `font-weight: 500`, `font-size: 0.875rem`, `margin-bottom: 2rem`. Icon `w-4 h-4`. Hover: `color: #ffffff`
- Level badge: `padding: 0.25rem 0.75rem`, `background: rgba(255,255,255,0.2)`, `border-radius: 9999px`, `font-size: 0.75rem`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.1em`, `backdrop-filter: blur(4px)`
- Duration badge: `color: #e0e7ff` (`text-indigo-100`), `font-size: 0.875rem`, `font-weight: 500`, `gap: 0.375rem`. Icon `w-4 h-4`
- Title: `font-size: 2.25rem` (text-4xl), `font-weight: 700`, `letter-spacing: -0.025em`, `margin-bottom: 1rem`. At lg+: `font-size: 3rem` (text-5xl)
- Description: `color: #e0e7ff`, `font-size: 1.125rem`, `line-height: 1.625`, `margin-bottom: 2rem`
- CTA button primary: `background: white`, `color: #4338ca` (`text-indigo-700`), `padding: 0.75rem 1.5rem`, `border-radius: 0.75rem`, `font-weight: 700`, `box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1)`, `gap: 0.5rem`. Hover: `background: #eef2ff`, icon `w-5 h-5`
- Avatar group: `display: flex`, `margin-left: 1rem`, `overflow: hidden`
- Individual avatar: `width: 40px`, `height: 40px`, `border-radius: 9999px`, `ring: 3px solid #4f46e5` (`ring-2 ring-indigo-600`), `object-fit: cover`
- Overflow avatar: `width: 40px`, `height: 40px`, `border-radius: 9999px`, `background: rgba(255,255,255,0.2)`, `border: 2px solid #4f46e5`, `font-size: 0.75rem`, `font-weight: 700`, `color: white`, `backdrop-filter: blur(4px)`

### A2. Content Area Layout

```
max-w-6xl mx-auto px-8 lg:px-12 -mt-10 pb-24

┌─────────────────────────────────────────────────────────────┐
│  grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12           │
│  ┌──────────────────────────┐  ┌───────────┐               │
│  │  lg:col-span-2           │  │  space-y-6│               │
│  │  space-y-12              │  │           │               │
│  │                          │  │ Progress  │               │
│  │  ┌── Syllabus Card ──┐   │  │ Sidebar   │ sticky top-6  │
│  │  │  bg-white          │   │  │ (sticky)  │               │
│  │  │  rounded-2xl       │   │  └───────────┘               │
│  │  │  shadow-sm border  │   │                              │
│  │  │  p-8               │   │                              │
│  │  └─────────────────── ┘   │                              │
│  └──────────────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

**CSS specification:**
- Content area: `max-width: 72rem` (max-w-6xl), `margin: 0 auto`, `margin-top: -2.5rem` (-mt-10), `padding: 0 2rem 6rem 2rem` (px-8 pb-24)
- Grid: `display: grid`, `grid-template-columns: 1fr`, at lg+: `grid-template-columns: 1fr 1fr 1fr`, `gap: 2rem` (gap-8), at md+: `gap: 3rem` (gap-12)
- Left column: `grid-column: span 2` (lg:col-span-2), `space-y-12` (48px gap between sections)
- Right column: `space-y-6` (24px gap between sections)
- Syllabus card: `background: white`, `border-radius: 1rem`, `box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05)`, `border: 1px solid #e2e8f0`, `padding: 2rem` (p-8)
- Card header: `display: flex`, `justify-content: space-between`, `align-items: center`, `margin-bottom: 2rem` (mb-8)
- Heading: `font-size: 1.5rem` (text-2xl), `font-weight: 700`, `color: #0f172a` (text-slate-900)
- Module count: `color: #64748b` (text-slate-500), `font-weight: 500`, `font-size: 0.875rem`

### A3. Timeline Connector and Entry Dots

```
border-l-2 border-slate-100 ml-4 space-y-8 pb-4

  Dot positions: -left-[17px] top-1
  Each dot: w-8 h-8 rounded-full border-4 border-white

  ● (green-500)       = completed    — 32px dot, border-4 border-white, <Check w-4 h-4>
  ◉ (blue-600)        = in-progress  — 32px dot, ring-4 ring-blue-100, animate-pulse inner
  ○ (slate-200)       = locked       — 32px dot, inner w-2.5 h-2.5 rounded-full slate-400
```

**Dot states CSS:**
- **Completed**: `background: #22c55e` (`bg-green-500`), inner: `<Check className="w-4 h-4 text-white" />`, position: `absolute -left-[17px] top-1`
- **In-progress** (first non-completed): `background: #2563eb` (`bg-blue-600`), `box-shadow: 0 0 0 4px #dbeafe` (`ring-4 ring-blue-100`), inner: `w-2.5 h-2.5 rounded-full bg-white animate-pulse`
- **Locked**: `background: #e2e8f0` (`bg-slate-200`), inner: `w-2.5 h-2.5 rounded-full bg-slate-400`
- **Dot ring**: `border: 4px solid white` on all dots (`border-4 border-white`)
- **Connector line**: `border-left: 2px solid #f1f5f9`, positioned on `.relative` container

### A4. Timeline Entry Cards

```
┌──────────────────────────────────────────────────────────────┐
│  border rounded-2xl p-6 hover:shadow-md                     │
│  In-progress: border-blue-200 ring-1 ring-blue-50           │
│  Default:     border-slate-100                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MODULE 1         [Completed]                        │   │
│  │  text-xs font-bold text-slate-400 uppercase          │   │
│  │  uppercase tracking-widest                            │   │
│  │                                                       │   │
│  │  Introduction to CI/CD               [Review]        │   │
│  │  text-xl font-bold mb-2                                │   │
│  │                                                       │   │
│  │  Learn the fundamentals... text-slate-600 text-sm     │   │
│  │  leading-relaxed mb-4                                  │   │
│  │                                                       │   │
│  │  🕐 2h    🎬 12 video lessons                        │   │
│  │  text-slate-500 font-medium text-sm                   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Card structure:**
- Container: `background: white`, `border: 1px solid #e2e8f0` (or `#bfdbfe` for in-progress), `border-radius: 1rem`, `padding: 1.5rem` (p-6), `transition: all 300ms`, hover: `box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1)`
- Layout inside: `display: flex`, `flex-direction: column` on mobile / `row` on md+, `justify-content: space-between`, `gap: 1rem`
- **Module number**: `font-size: 0.75rem` (text-xs), `font-weight: 700`, `color: #94a3b8` (text-slate-400), `text-transform: uppercase`, `letter-spacing: 0.1em`
- **Completed badge**: `display: inline-flex`, `align-items: center`, `gap: 0.25rem`, `padding: 0.125rem 0.5rem`, `background: #f0fdf4` (bg-green-50), `color: #15803d` (text-green-700), `font-size: 0.625rem` (text-[10px]), `font-weight: 700`, `border-radius: 9999px`, `text-transform: uppercase`
- **Up Next badge**: Same structure, `background: #eff6ff` (bg-blue-50), `color: #1d4ed8` (text-blue-700)
- **Entry title**: `font-size: 1.25rem` (text-xl), `font-weight: 700`, `margin-bottom: 0.5rem`. Completed: `color: #1e293b` (text-slate-800), Default: `color: #0f172a` (text-slate-900)
- **Description**: `color: #475569` (text-slate-600), `font-size: 0.875rem`, `line-height: 1.625`, `margin-bottom: 1rem`
- **Metadata row**: `display: flex`, `align-items: center`, `gap: 1.5rem` (gap-6), `font-size: 0.875rem`, `color: #64748b` (text-slate-500), `font-weight: 500`

**Action buttons CSS:**
- **Start Module** (in-progress): `background: #2563eb` (bg-blue-600), hover: `#1d4ed8`, `color: white`, `padding: 0.625rem 1.25rem` (px-5 py-2.5), `border-radius: 0.75rem`, `font-size: 0.875rem`, `font-weight: 700`, `box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05)`, `display: inline-flex`, `align-items: center`, `gap: 0.5rem`
- **Review** (completed): `background: #f1f5f9` (bg-slate-100), hover: `#e2e8f0`, `color: #334155` (text-slate-700), `padding: 0.625rem 1.25rem`, `border-radius: 0.75rem`, `font-size: 0.875rem`, `font-weight: 700`
- **Locked**: `background: #f8fafc` (bg-slate-50), `color: #94a3b8` (text-slate-400), `padding: 0.625rem 1.25rem`, `border-radius: 0.75rem`, `font-size: 0.875rem`, `font-weight: 700`, `cursor: not-allowed`

### A5. Progress Sidebar

```
┌─────────────────────────────────┐
│  bg-white rounded-2xl           │
│  shadow-lg border p-6           │
│  sticky top-6                   │
│                                 │
│  Your Progress (font-heading    │
│  text-lg font-bold mb-6)       │
│                                 │
│       ┌───────────┐            │
│       │    75%    │  w-32 h-32 │
│       │  Complete │  svg ring  │
│       └───────────┘            │
│                                 │
│  Modules Completed    3 / 4    │
│  Estimated Time Left  12h 45m  │
│  ───────────────────────────── │
│  Skills you'll gain            │
│  [CI/CD] [Docker] [Kubernetes] │
│  ───────────────────────────── │
│  ┌─────────────────────────┐   │
│  │ 🏆 Earn a Certificate   │   │
│  │ Complete all modules... │   │
│  │ View details →          │   │
│  │ (dark gradient card)    │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

**CSS specification:**
- Container: `background: white`, `border-radius: 1rem`, `box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1)`, `border: 1px solid #f1f5f9`, `padding: 1.5rem` (p-6), `position: sticky`, `top: 1.5rem`
- Heading: `font-size: 1.125rem` (text-lg), `font-weight: 700`, `color: #0f172a`, `margin-bottom: 1.5rem`
- **Ring assembly**:
  - Container: `width: 128px` (w-32), `height: 128px` (h-32), `display: flex`, `align-items: center`, `justify-content: center`
  - SVG: `width: 100%`, `height: 100%`, `transform: rotate(-90deg)`
  - Track circle: `stroke: #f1f5f9` (text-slate-100), `stroke-width: 8`, `r: 42`, `cx: 50`, `cy: 50`, `fill: transparent`, `stroke-linecap: round`
  - Progress circle: same as track but `stroke: #2563eb` (text-blue-600), `stroke-dasharray: 263.89`, `stroke-dashoffset: 263.89 * (1 - pct)`, `transition: all 1s ease-out`
  - Center text: `font-size: 1.5rem` (text-2xl), `font-weight: 700`, `color: #1e293b` (text-slate-800), `letter-spacing: -0.025em`
  - Sub-label: `font-size: 0.75rem` (text-xs), `font-weight: 600` (semibold), `color: #94a3b8` (text-slate-400), `text-transform: uppercase`, `letter-spacing: 0.05em`
- **Stat rows**: `display: flex`, `justify-content: space-between`, `align-items: center`, `font-size: 0.875rem`
  - Label: `color: #64748b` (text-slate-500), `font-weight: 500`
  - Value: `font-weight: 700`, `color: #0f172a` (text-slate-900)
- **Divider**: `hr`, `margin: 1.5rem 0` (my-6), `border-color: #f1f5f9` (border-slate-100)
- **Skills section**:
  - Heading: `font-size: 0.875rem` (text-sm), `font-weight: 700`, `color: #0f172a`, `margin-bottom: 0.75rem`
  - Tags container: `display: flex`, `flex-wrap: wrap`, `gap: 0.5rem`
  - Tag: `padding: 0.25rem 0.5rem` (px-2 py-1), `background: #f8fafc` (bg-slate-50), `border: 1px solid #f1f5f9`, `color: #475569` (text-slate-600), `font-size: 0.75rem` (text-xs), `font-weight: 700`, `border-radius: 0.375rem` (rounded-md)
- **Certificate card**:
  - Container: `background: linear-gradient(to bottom right, #0f172a, #1e293b)`, `border-radius: 0.75rem`, `box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05)`, `border: 1px solid #334155`, `padding: 1.25rem` (p-5), `color: white`, `position: relative`, `overflow: hidden`
  - Background trophy: `position: absolute`, `right: -1rem`, `top: -1rem`, `opacity: 0.1`, `width: 6rem`, `height: 6rem`
  - Icon container: `background: rgba(255,255,255,0.1)`, `padding: 0.625rem` (p-2.5), `border-radius: 9999px`, `backdrop-filter: blur(4px)`
  - Award icon: `width: 1.25rem` (w-5), `height: 1.25rem` (h-5), `color: #facc15` (text-yellow-400)
  - Title: `font-size: 0.875rem` (text-sm), `font-weight: 700`
  - Description: `color: #cbd5e1` (text-slate-300), `font-size: 0.75rem` (text-xs), `line-height: 1.625`
  - Link: `font-size: 0.75rem` (text-xs), `font-weight: 700`, `color: #facc15` (text-yellow-400), hover: `#fde047`, `display: inline-flex`, `align-items: center`, `gap: 0.25rem`

### A6. Spacing Reference Table

| Element | Tailwind | px (at 1rem=16px) |
|---------|----------|-------------------|
| Hero bottom padding | pb-20 | 80px |
| Content overlap | -mt-10 | -40px |
| Content bottom padding | pb-24 | 96px |
| Content horizontal padding | px-8, lg:px-12 | 32px / 48px |
| Grid gap | gap-8, md:gap-12 | 32px / 48px |
| Section spacing (left col) | space-y-12 | 48px |
| Section spacing (right col) | space-y-6 | 24px |
| Syllabus card padding | p-8 | 32px |
| Card header margin | mb-8 | 32px |
| Timeline entry spacing | space-y-8 | 32px |
| Entry card padding | p-6 | 24px |
| Content-to-action gap | gap-4 | 16px |
| Button padding | px-5 py-2.5 | 20px x 10px |
| Timeline dot size | w-8 h-8 | 32px |
| Dot ring width | border-4 | 4px |
| Dot left offset | -left-[17px] | 17px |
| Progress ring SVG | w-32 h-32 | 128px |
| Skills tag padding | px-2 py-1 | 8px x 4px |
| HR margin | my-6 | 24px |
| Certificate card padding | p-5 | 20px |
| Avatar size | h-[40px] w-[40px] | 40px |
| Avatar ring | ring-2 | 2px |
| Hero title | text-4xl / lg:text-5xl | 36px / 48px |
| Hero description | text-lg | 18px |

### A7. Component Hierarchy (DevOps Reference)

```
Page (PathDetails)
├── Sidebar (static nav, not applicable to Knowlune)
├── Header (not applicable — Knowlune has its own header)
├── Hero Banner
│   ├── Back link (← Back to Learning Paths)
│   ├── Badges row (level badge + duration badge)
│   ├── Title (font-heading text-4xl)
│   ├── Description (text-lg)
│   └── CTA row
│       ├── Continue/Start Learning button (primary white)
│       └── Avatar group (4 avatars + overflow count)
├── Content Area (max-w-6xl, -mt-10 overlap)
│   ├── Left Column (lg:col-span-2)
│   │   └── Syllabus Section
│   │       ├── Header row (h2 "Syllabus" + module count)
│   │       └── Timeline container (border-l-2 connector)
│   │           └── Timeline entries (repeated)
│   │               ├── Status dot (positioned absolute -left-[17px])
│   │               └── Entry card (border rounded-2xl p-6)
│   │                   ├── Module number + status badge
│   │                   ├── Entry title
│   │                   ├── Description
│   │                   ├── Metadata row (duration + lesson count)
│   │                   └── Action button (Start/Review/Locked)
│   └── Right Column
│       └── Progress Sidebar (sticky top-6)
│           ├── "Your Progress" heading
│           ├── SVG ring (128px, centered)
│           ├── Stat rows (modules completed, time left)
│           ├── HR divider
│           ├── Skills section (flex-wrap tags)
│           ├── HR divider
│           └── Certificate card (dark gradient, trophy bg)
```
