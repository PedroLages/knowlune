---
title: "Learning Path Detail Page Hero Redesign — PathHeroBanner, PathProgressSidebar, and Layout Restructuring"
date: 2026-05-08
category: docs/solutions/best-practices
module: learning-paths
problem_type: best_practice
component: frontend
tags:
  - learning-paths
  - hero-banner
  - progress-sidebar
  - page-redesign
  - gradient-tokens
  - layout-overlap
  - component-consolidation
  - type-consistency
applies_when:
  - "Designing full-width hero banners that break out of Layout container padding"
  - "Positioning a CTA on a gradient background where standard button variants don't match"
  - "Consolidating a standalone summary panel into a sticky sidebar during a page restructure"
  - "Adding conditional UI sections tied to data that doesn't yet exist on the domain model"
  - "Applying cross-scheme compatible gradients using design tokens"
related_components:
  - PathHeroBanner
  - PathProgressSidebar
  - PathTimeline
  - PathProgressRing
  - PathCardHeader
  - LearningPathCard
related_docs:
  - docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md
  - docs/solutions/workflow-issues/ce-pipeline-visual-redesign-interactions-2026-05-06.md
  - docs/solutions/best-practices/reports-page-redesign-patterns-2026-05-02.md
last_updated: 2026-05-08
---

# Learning Path Detail Hero Redesign — Implementation Lessons

## Context

The LearningPathDetail page (`/learning-paths/:pathId`) had a flat, text-heavy header with inline-editable title/description and a separate `PathSummaryPanel` below the fold. The redesign added a full-width gradient hero (`PathHeroBanner`), a sticky progress sidebar (`PathProgressSidebar`), and a restructured two-column layout with overlapping content. The goal was visual hierarchy — separating "what is this path" from "what's in it" — while preserving all existing functionality (DnD reordering, AI order suggestions, gap resolution, import wizard, Plan My Week).

## Guidance

### 1. Breaking Out of Layout Container Padding

Layout's `<main>` applies `px-4 pt-4 sm:px-6 sm:pt-6`. The hero needs to be flush with viewport edges. Counteract with negative margins on a wrapper, then restore internal padding inside the hero:

```tsx
// LearningPathDetail.tsx
<div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
  <PathHeroBanner ... />
</div>
```

Inside `PathHeroBanner`, content uses its own `px-8 lg:px-12`. This keeps Layout generic while letting specific pages opt into full-width sections.

### 2. Content Overlapping the Hero with Negative Margin

Below the hero, content overlaps by 40px with `relative z-10`:

```tsx
<div className="-mt-10 relative z-10">
  {/* grid content */}
</div>
```

The hero's `pb-20` provides enough space for the overlap without cutting off text. Same pattern used in `CourseOverview`'s floating stats bar.

### 3. CTA on Gradient: Plain `<Link>` Instead of `<Button variant="brand">`

A `variant="brand"` Button renders `bg-brand text-brand-foreground` — invisible on a `from-brand to-brand-hover` gradient. Use a styled `<Link>`:

```tsx
<Link
  to={`/courses/${ctaCourseId}`}
  className="inline-flex items-center gap-2 bg-card text-brand hover:bg-brand-soft
             hover:text-brand-soft-foreground shadow-lg rounded-xl font-bold px-6 py-3
             transition-colors"
>
  <PlayCircle className="size-5" />
  {ctaLabel}
</Link>
```

`bg-card` gives maximum contrast against the gradient; `text-brand` ties it to the brand color. This pattern applies to any dialog/section on a brand background.

### 4. Actions via Dropdown Instead of Inline Editing

Editing text on a dark gradient would have contrast issues. Move editing to a dropdown with a translucent trigger:

```tsx
<Button variant="ghost" size="icon"
  className="size-11 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full">
  <MoreHorizontal className="size-4" />
</Button>
```

The existing `EditPathDialog` handles name/description editing from the dropdown — no new dialog needed.

### 5. Conditional Future-Proof Slots

The `skillTags` prop on `PathProgressSidebar` has no data source yet (`LearningPath` type has no skills field). Guard with empty-state check:

```tsx
{skillTags && skillTags.length > 0 && (
  <div>
    <h3>Skills</h3>
    <div className="flex flex-wrap gap-2">
      {skillTags.map(tag => <span key={tag}>{tag}</span>)}
    </div>
  </div>
)}
```

The section self-hides when data is absent — no code changes needed when the data source is wired later.

### 6. Default First Timeline Entry to In-Progress

When no progress data exists (fresh path), all entries appear "Locked." Default the first non-gap entry to in-progress:

```tsx
const hasAnyProgress = entries.some(e => {
  if (e.courseId === '' || gapEntryIds.has(e.id)) return false
  return (courseInfoMap.get(e.courseId)?.completionPct ?? 0) > 0
})
const firstNonGapIndex = entries.findIndex(
  e => e.courseId !== '' && !gapEntryIds.has(e.id)
)
// Per entry:
const isInProgress =
  (!hasAnyProgress && i === firstNonGapIndex) ||
  ((info?.completionPct ?? 0) > 0 && !isCompleted)
```

### 7. aria-live on Dynamic Progress Content

Progress stats change as courses complete. Screen readers need `aria-live`:

```tsx
<div aria-live="polite" aria-atomic="true">
  <PathProgressRing percentage={completionPct} size="lg" />
  {/* stats: modules completed, estimated time */}
</div>
```

### 8. Component Consolidation: Remove Redundant Panels

`PathSummaryPanel` was removed — `PathProgressSidebar` covers the same 4 metrics (progress %, completed/total modules, estimated time). Two stats displays on one page creates confusion. Consolidate before adding new components.

### 9. Design Token Gradients for Cross-Scheme Compatibility

Use `from-brand to-brand-hover` (not hardcoded indigo/purple). CSS variable-backed tokens automatically adapt across Professional, Vibrant, Clean, and Apple schemes:

```tsx
<section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-hover">
  <div className="absolute inset-0 opacity-20
    bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)]" />
</section>
```

## Why This Matters

- **Layout breakout pattern** is reusable for landing pages, feature banners, and any hero treatment without modifying Layout
- **CTA-on-gradient approach** (`bg-card text-brand`) establishes the pattern for any colored-background button
- **Sticky sidebar with two-column grid** (`lg:sticky lg:top-24`) can be reused for book detail, author detail, course detail
- **Conditional slots** prevent always-empty UI sections when the data source lags behind the component
- **Defaulting first entry** prevents the "everything is Locked" confusing initial state

## When to Apply

- Any page needing a full-width hero that escapes Layout padding
- Action buttons on brand/colored backgrounds where standard variants fail
- Detail pages with scrollable content + metadata sidebar
- Visual timelines/step indicators with status-based styling
- Components that accept data not yet available on the domain model

## Examples

**Before**: Flat header with `InlineEditableField` title, `PathSummaryPanel` below, back link as a simple arrow.

**After**: Full-width gradient hero with dropdown menu, overlapping content area, sticky progress sidebar with SVG ring, timeline with module numbers and contextual action buttons.

**Layout breakout pattern**:
```
<div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6">  {hero}  </div>
<div className="-mt-10 relative z-10">            {content}  </div>
```

**Timeline initial state guard**:
```
hasAnyProgress = false, firstNonGapIndex = 0 → first entry shows "Up Next" with "Start Module"
hasAnyProgress = true → normal status determination from completionPct
```
