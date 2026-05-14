---
title: Fix Lesson List Blocked Item Appearance on Course Detail Page
type: fix
status: active
date: 2026-05-14
deepened: 2026-05-14
---

# Fix Lesson List Blocked Item Appearance on Course Detail Page

## Overview

On the `/courses/:id` page, lessons in the course content list appear visually "blocked" or "greyed out" when `useFileStatusVerification` marks them as `'missing'` or `'permission-denied'`. The current implementation renders these items as non-navigable `<div>` elements with `opacity-50 cursor-not-allowed`. This fix replaces that treatment with navigable links that show a subtle file-status badge, matching the `LessonsTab` sidebar behavior where all items remain clickable regardless of file handle validity.

## Problem Frame

`src/app/components/course/LessonList.tsx` (used by `UnifiedCourseDetail`) has two rendering paths:

- **YouTube courses** (`renderYouTubeGroups`): All items are navigable `<Link>` elements. Non-completed index indicators use `bg-muted text-muted-foreground` (grey tones).
- **Local courses** (`renderLocalGroups`): Items whose `fileStatuses` entry is `'missing'` or `'permission-denied'` are rendered as **non-navigable** `<div>` elements with `opacity-50 cursor-not-allowed` and `aria-disabled="true"`.

The `useFileStatusVerification` hook verifies `FileSystemFileHandle` objects via the File System Access API. When handles are `null`, expired, or lack permission, items are marked `'missing'` — triggering the blocked appearance. This is common when accessing Knowlune from a different browser or device than the one used to import the course.

In contrast, `LessonsTab.tsx` (the sidebar in `UnifiedLessonPlayer`) renders **all** items as navigable links with no file-status gating. The lesson player page handles unavailable files at playback time. The course detail page should follow the same pattern: keep items navigable and communicate file status through the existing `FileStatusBadge` component.

## Requirements Trace

- **R1.** All lessons in the course content list must remain navigable (clickable links), regardless of file handle validity
- **R2.** File availability status must still be communicated to the user, but through the existing `FileStatusBadge` rather than by removing navigation
- **R3.** The visual treatment of non-completed, available items must not suggest they are disabled or inaccessible

## Scope Boundaries

- Only the local-course rendering path in `renderLocalGroups` is affected
- YouTube course rendering is out of scope (items are already navigable; the `bg-muted` index indicator is a separate visual preference)
- The `LessonsTab` sidebar component requires no changes (it already behaves correctly)
- `useFileStatusVerification` hook behavior is unchanged — it continues to report file status; only the consumer's rendering changes

### Deferred to Separate Tasks

- **PdfContent null-handle error UI**: PdfContent (`src/app/components/course/PdfContent.tsx` at line 77) returns early without setting `fileError` when `pdf.fileHandle` is null, resulting in a blank page instead of an actionable error UI. This should be fixed to match the `LocalVideoContent` / `useVideoFromHandle` pattern where a null handle produces a `'file-not-found'` error state with recovery actions (re-grant permission, locate file). Scoped out of this plan because the change is in a separate component (`PdfContent.tsx`) with its own state management lifecycle. Tracked in `docs/plans/2026-05-14-006-fix-pdf-content-null-handle-error-ui-plan.md`.

## Context & Research

### Relevant Code and Patterns

- [src/app/components/course/LessonList.tsx](src/app/components/course/LessonList.tsx) — Main component to modify. Lines 445-462 (video items) and 510-527 (PDF items) contain the `isUnavailable` branching.
- [src/app/components/course/tabs/LessonsTab.tsx](src/app/components/course/tabs/LessonsTab.tsx) — Reference for the desired behavior: all items are navigable `<Link>` elements, no file-status gating.
- [src/hooks/useFileStatusVerification.ts](src/hooks/useFileStatusVerification.ts) — Produces the `FileStatusMap` consumed by `LessonList`. Returns `'checking'`, `'ok'`, `'missing'`, or `'permission-denied'`.
- [src/lib/fileVerification.ts](src/lib/fileVerification.ts) — `verifyFileHandle()` performs the actual permission check.
- [src/app/pages/UnifiedCourseDetail.tsx](src/app/pages/UnifiedCourseDetail.tsx) — Parent component that passes `fileStatuses` to `LessonList` at line 379.

### Institutional Learnings

No existing `docs/solutions/` entries cover this specific pattern. The fix establishes a new convention: communicate resource availability through badges, not by disabling navigation.

## Key Technical Decisions

- **Keep items as `<Link>` elements**: Remove the `isUnavailable ? <div> : <Link>` branch. Always render a `<Link>`. This matches `LessonsTab` behavior and keeps the course tree fully navigable.
- **Communicate status via `FileStatusBadge`**: The `FileStatusBadge` sub-component already exists in `LessonList.tsx` and renders appropriate badges for `'missing'` and `'permission-denied'` statuses. It is already included in the item content — no new UI elements needed.
- **No change to `useFileStatusVerification`**: The hook correctly reports file availability. The issue is only in how the consumer interprets that data for rendering. The aggregated toast ("X files unavailable") is preserved — individual `FileStatusBadge` components on each row provide per-item granularity, and the toast gives a scannable summary.
- **Remove `aria-disabled`**: Since items will no longer be disabled, the `aria-disabled="true"` attribute must be removed.
- **Replacement accessible communication**: With `aria-disabled` removed, the native `<a>` element semantics automatically communicate the interactive, navigable state. File availability status is communicated through the `FileStatusBadge` sub-component, which already uses `role="status"` for live region announcements. The badge text (e.g., "File not found", "Permission needed") is rendered inline within the `<Link>` content, so screen readers announce it as part of the link's accessible name alongside the lesson title. No additional ARIA attributes are needed on the badge — the existing `role="status"` and the inline text content provide sufficient accessible communication. Focus management follows native link behavior: Tab to focus the item, Enter to navigate. The badge's icon uses `aria-hidden="true"` to prevent decorative duplication in the accessibility tree.

## Implementation Units

- [ ] **Unit 1: Make local course items always navigable in LessonList**

**Goal:** Replace the conditional `<div>` (unavailable) / `<Link>` (available) branching with an always-navigable `<Link>`, keeping file status communication through the existing `FileStatusBadge`.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/LessonList.tsx`
- Modify: `tests/e2e/regression/story-e01-s05.spec.ts` (lines ~188-195 — update AC3 assertions to expect navigable links instead of disabled divs)

**Approach:**
- In `renderLocalGroups`, for both video items (line ~445-462) and PDF items (line ~510-527), remove the `isUnavailable ? <div> : <Link>` ternary
- Always render a `<Link>` to the lesson route
- The `FileStatusBadge` sub-component is already rendered inside the item content and will continue to show `'missing'` / `'permission-denied'` badges
- Remove `aria-disabled="true"` from the former unavailable branch
- Remove the `!isUnavailable &&` guard from the `group-hover:text-brand transition-colors` class on the title span (lines ~406 and ~487) so all navigable items get the hover color transition, regardless of file status
- Items with unavailable files keep full opacity and standard cursor — the file status badge alone communicates the issue
- **Accessibility details:**
  - Focus management: `<Link>` elements receive focus via natural Tab order. The `FileStatusBadge` is rendered inside the `<Link>` content, so it does not introduce a separate focus stop — the badge is part of the link's focusable region.
  - Keyboard interaction: Standard link activation (Enter key). No custom keydown handlers needed.
  - Screen readers: The `<Link>` element inherently communicates "link, navigable" via native `<a>` semantics. The `FileStatusBadge` uses `role="status"` (already present) which triggers a live region announcement when the badge text is inserted into the DOM. Badge text ("File not found", "Permission needed") is rendered as visible text inside the link, so it is included in the link's accessible name computation.
  - Visual indicators: The badge's warning icon (`AlertTriangle`, `ShieldAlert`) uses `aria-hidden="true"` to prevent screen reader duplication of the icon's decorative purpose. The visible text label conveys the status.

**Patterns to follow:**
- The `LessonsTab.tsx` `LessonLink` component — always a `<Link>`, no file-status gating
- Existing `FileStatusBadge` usage within `LessonList.tsx` itself (lines 416, 497)

**Test scenarios:**
- Happy path: Lesson with `fileStatuses.get(id) === 'missing'` renders as a navigable `<Link>` (not a `<div>`) and shows the "File not found" badge
- Happy path: Lesson with `fileStatuses.get(id) === 'ok'` renders as a navigable `<Link>` with no warning badge
- Edge case: Lesson with `fileStatuses.get(id) === 'checking'` renders as a navigable `<Link>` (unchanged behavior)
- Edge case: Lesson with `fileStatuses.get(id) === 'permission-denied'` renders as a navigable `<Link>` and shows the "Permission needed" badge
- Edge case: Completed lesson with missing file — still navigable, shows both completion checkmark and file status badge
- Accessibility: Missing-file `<Link>` receives focus via Tab and activates on Enter (standard link behavior)
- Accessibility: Screen reader announces "File not found" badge text as part of the link content — verified via `role="status"` live region
- Accessibility: No `aria-disabled="true"` attributes appear on any lesson list item (regression assertion)

**Verification:**
- On a local course detail page, all lesson items are clickable links regardless of file handle validity
- Missing-file items show the "File not found" badge but remain at full opacity with a pointer cursor
- No `aria-disabled="true"` attributes appear on lesson list items

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Users may click a lesson that can't play (file missing) | For video items: `LocalVideoContent` + `useVideoFromHandle` already sets `file-not-found` error state when `fileHandle` is null, showing error UI with recovery actions. For PDF items: `PdfContent` currently renders a blank page when `fileHandle` is null (it returns early without setting `fileError`). This is tracked as a separate fix in `docs/plans/2026-05-14-006-fix-pdf-content-null-handle-error-ui-plan.md` (see Scope Boundaries > Deferred to Separate Tasks) |
| Existing E2E regression test asserts old disabled behavior | `tests/e2e/regression/story-e01-s05.spec.ts` lines 188-195 explicitly asserts `aria-disabled="true"` and zero `<a>` links for missing-file items. This test must be updated to assert navigable `<Link>` elements with `FileStatusBadge` instead. Add as a test file to modify |

## Sources & References

- Origin: User request (no requirements document)
- Related code: `src/app/components/course/LessonList.tsx`, `src/app/components/course/tabs/LessonsTab.tsx`
- Related hook: `src/hooks/useFileStatusVerification.ts`
