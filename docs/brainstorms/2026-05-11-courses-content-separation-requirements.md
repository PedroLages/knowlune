---
date: 2026-05-11
topic: courses-content-separation
---

# Courses Page — Content Separation & Filtering

## Problem Frame

The Courses page shows all imported courses in one flat list, regardless of source (local folder, YouTube) or whether they belong to a learning track. With 30+ courses, everything is mixed together and hard to navigate. YouTube courses, standalone local courses, and track-assigned courses all share the same grid with no way to separate them.

## Requirements

**Default View & Track Separation**

- R1. Courses assigned to at least one learning track are hidden from the Courses page by default. The default view shows only standalone courses — those not organized into any track.
- R2. When track courses are hidden and at least one learning track exists, a message appears above the grid: "N courses are organized in learning tracks. Show →" — clicking the link opens the sidebar with the track visibility toggle enabled.
- R3. A control bar button opens a filter sidebar that slides in from the right side of the page. On desktop (≥1024px), the sidebar pushes the course grid content to the side. On mobile, it overlays as a bottom sheet.

**Sidebar Filters**

- R4. Source filter (radio group): All Courses | YouTube. Filters within the currently visible set. Selecting "YouTube" shows only courses where `source === 'youtube'` and that are not hidden by the track visibility toggle.
- R5. Track visibility toggle: a toggle or checkbox labeled "Include courses in tracks" with a count badge. When checked, courses belonging to learning tracks appear in the grid. When unchecked (default), they are hidden.
- R6. Tag filter: a list of all tags from currently visible courses, each with a count badge and checkbox. Selecting one or more tags filters the grid to courses matching any selected tag (OR semantics). Empty selection means no tag filter is applied.
- R7. All filter options display current counts that update as other filters change.
- R8. Filter groups (source, track visibility, tags) compose as AND — a course must satisfy the active selection in every group to appear in the grid. Within the tag group, multiple selected tags compose as OR.

**Visual Feedback**

- R9. The sidebar toggle button shows a badge when any filter is active (YouTube selected, track toggle on, or tags checked).
- R10. Active filters appear as dismissible chips above the course grid, similar to the existing status filter chips. Dismissing a chip removes that filter.
- R11. When no courses match the active filters, the grid area shows an empty state with a brief message and a "Clear all filters" action.

**Persistence**

- R12. Filter state (source selection, track toggle, selected tags) persists across page navigations within the session. It does not survive a full page reload.

## Success Criteria

- User can isolate YouTube courses in one click
- Default view is uncluttered: only standalone courses visible
- Track courses remain accessible via the sidebar toggle without leaving the page
- Tags and source filter compose naturally (YouTube + "react" tag shows YouTube courses tagged with react)
- Filter counts update in real time as selections change
- User can see at a glance whether any filters are active without opening the sidebar
- User can clear any active filter in one click via a dismissible chip
- Filter state persists when navigating between pages within the same session but resets on full page reload

## Scope Boundaries

- No new routes or URL structure changes — stays within `/courses`
- No changes to the Learning Tracks page
- No changes to the import workflow (folder import, YouTube import, bulk import)
- No changes to the course detail/player pages
- The global left sidebar navigation is unchanged

## Key Decisions

- **Track courses hidden by default**: The Learning Tracks page already provides a dedicated home for track-organized courses. The Courses page becomes an inbox for standalone content, reducing noise.
- **Right sidebar over left**: User preference — keeps the global nav undisturbed and matches the mental model of "show/hide filters on demand."
- **Tags use OR semantics**: Multiple selected tags show courses matching any of them, maximizing discoverability over strict AND filtering.

## Dependencies / Assumptions

- The `ImportedCourse.source` field (`'local' | 'youtube'`) already exists and is populated correctly for all courses.
- Learning track membership is queryable via `useLearningPathStore` — confirmed from `src/app/pages/LearningTracks.tsx`.
- The existing `StatusFilter` component and filter chip pattern can be reused or adapted.

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Technical] Sidebar animation approach (CSS translate, framer-motion, or shadcn Sheet component)
- [Affects R4–R8][Technical] Filter state uses a Zustand store (URL search params contradict R12 no-reload-survival; React state is lost on SPA navigation). Which existing store to extend, or create a new one?
- [Affects R6][Design] Tag list behavior when there are many tags (scroll, search, or top-N with "show more")

## Next Steps

-> `/ce:plan` for structured implementation planning
