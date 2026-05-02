# E99-S03 List View — Requirements Brief

**Story file**: `docs/implementation-artifacts/stories/E99-S03-list-view.md`
**Status**: ready-for-dev
**Date**: 2026-04-25

## Title

List View for Courses page — dense, scannable alternative to Grid view.

## Goal / Why

Power users with many courses need a denser layout that surfaces more rows per screen with rich metadata, so they can scan their entire library without excessive scrolling.

## Acceptance Criteria (verbatim from story)

1. **List rendering** — When `courseViewMode === 'list'`, courses display in a vertical list (one course per row). Each row shows: thumbnail (small, left), title, author/source, progress bar, tag badges, status, last-played timestamp, overflow menu. Min row height 72px; fully tappable.
2. **Hover state** — `bg-muted/50` highlight on hover; `cursor: pointer`.
3. **Click navigation** — Clicking the row body (not buttons/menu) navigates to the course detail page (same destination as the Grid card click).
4. **Keyboard navigation** — Row is focusable; Enter (and Space) activates navigation; visible focus indicator (WCAG 2.4.13, E66-S05 compliant).
5. **Overflow menu parity** — Same actions as Grid card (edit title, change status, delete, etc.), wired to the same handlers.
6. **Fallback thumbnail** — When the thumbnail image is missing, render the same placeholder as `ImportedCourseCard`.
7. **Mobile responsive** — On `< sm`: thumbnail + title on first line, metadata stacked/truncated below. Min row height 44px (WCAG 2.5.8). Overflow menu remains reachable.

## Context / Existing Code

- **`src/app/components/figma/ImportedCourseCard.tsx`** — source of truth for metadata fields, handlers, fallback thumbnail logic, and overflow menu actions.
- **`src/app/pages/Courses.tsx`** — page that renders the courses; will branch on `courseViewMode`.
- **`src/app/components/library/BookList.tsx`** (via `SmartGroupedView.tsx`) — structural precedent for a list layout in this codebase.
- **`courseViewMode` store** — provided by E99-S01 (blocker dependency, already shipped).
- **Design tokens** — Tailwind v4 + `theme.css`. No hardcoded colors.

## Dependencies

- **Blocked by**: E99-S01 (`courseViewMode` in store). Already done.
- **Not blocked by**: E99-S02 (grid column control). Column control is hidden in list mode.

## Files to Create / Modify

- **New** — `src/app/components/figma/ImportedCourseListRow.tsx`
- **New (if dup-scan flags)** — `src/app/components/figma/CourseThumbnail.tsx`, `src/app/components/figma/CourseOverflowMenu.tsx`
- **Modify** — `src/app/pages/Courses.tsx` (conditional render)
- **New** — `tests/e2e/e99-s03-list-view.spec.ts`
- **New** — `src/app/components/figma/ImportedCourseListRow.test.tsx`

## Out of Scope

- Arrow-key roving focus between rows (story marks this optional polish — skip).
- Sortable column headers (this is a row-list, not a data table).
- Virtualized rendering — defer until library size warrants it.
- Bulk-select / multi-action toolbar.
- Persisting per-user list density preference beyond `courseViewMode`.
- Changes to the Grid card itself beyond extracting shared helpers.

## Key Constraints

- **DRY**: List row and Grid card MUST call the exact same edit/delete/status handlers. Do not re-implement business logic.
- **Navigation parity**: Row click must navigate to the same URL as Grid card click.
- **Click bubbling**: Overflow menu trigger must `stopPropagation` so menu clicks don't fire row navigation.
- **Design tokens only**: no hardcoded colors; ESLint rule `design-tokens/no-hardcoded-colors` will catch.
- **Accessibility**: WCAG 2.1 AA+. Keyboard activation, focus-visible ring, 44px min touch target on mobile.
- **Fallback thumbnail**: missing thumbnails are common; do not skip the fallback.
- **Reduce visual weight**: lists are dense — no card-like shadows.

## Design Guidance

- Row height: 72px desktop, 60px mobile (with 44px min tappable on small viewports).
- Padding: `p-4` horizontal, `py-3` vertical.
- Thumbnail: 64×64 desktop / 48×48 mobile, `rounded-lg`, `object-cover`.
- Progress bar: thin (≈2px), inline with metadata.
- Hover: `bg-muted/50`.
- Focus: `focus-visible:ring-2 focus-visible:ring-ring`.
- Layout: `flex gap-4 p-4 rounded-xl`.

## Test Plan

- **Unit (`ImportedCourseListRow.test.tsx`)**: renders title/author/progress/badges/timestamp; falls back when thumbnail missing; clicking row fires onClick; clicking overflow menu does NOT fire row onClick; Enter/Space activate row.
- **E2E (`tests/e2e/e99-s03-list-view.spec.ts`)**: seed courses, set `courseViewMode = 'list'`, assert rows render, click a row, assert navigation to course detail URL. Assert keyboard Enter activates from focused row.
- **Visual/responsive**: spot-check at mobile (< sm), tablet (sm-lg), desktop (lg+).

## Risks

- **Handler duplication drift**: if we copy-paste handlers from `ImportedCourseCard` instead of importing, list and grid will silently diverge. Mitigation: extract `CourseOverflowMenu` (or import handlers) on the first pass.
- **Click target ambiguity**: if the overflow trigger isn't fully covered by `stopPropagation`, users will accidentally navigate. Mitigation: e2e test for overflow click.
- **Thumbnail layout shift**: if fallback isn't sized identically to the loaded image, list will jitter as images load. Mitigation: fixed 64×64 thumbnail container.
