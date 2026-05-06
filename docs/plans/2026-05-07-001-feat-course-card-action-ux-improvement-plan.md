---
title: "feat: Improve course card action UX — replace hidden overlays with always-visible buttons"
type: feat
status: active
date: 2026-05-07
---

# feat: Improve course card action UX

## Overview

Replace two hidden hover-to-reveal overlays on imported course cards with always-visible, contextually-relevant buttons in the card body. This fixes the discoverability and mental-model problems where users must hover to discover how to activate a course, and where the most prominent post-activation hover action is "Change Thumbnail" instead of "Continue Learning."

## Problem Frame

Imported course cards on `/courses` use two hidden overlays that appear on hover:

1. **PlayOverlay** (not-started courses): A centered play icon that activates the course. Users must hover to discover it. The play icon suggests "play media" rather than "add to My Class / start learning." Multiple users find this unintuitive.

2. **Camera overlay** (active/completed/paused courses): A centered camera icon that opens a thumbnail picker. After a user activates a course, the most prominent hover action becomes "Change Thumbnail" — an administrative editing action, not a learning action. This is jarring: the user just clicked "play" to start studying, and now the same visual position shows a camera for thumbnail editing.

Both overlays share the same centered position on the card cover and are mutually exclusive (one shows when the other hides). The visual language doesn't communicate the action hierarchy: primary learning actions should be prominent and always visible; secondary editing actions should be tucked into menus or dialogs.

**Root cause:** The card cover is being used as an action surface for two very different types of actions — starting/continuing learning (primary) and editing thumbnails (secondary) — using the same hidden-affordance pattern for both.

## Requirements Trace

- R1. Not-started courses must show an always-visible "Start Learning" action (not hidden behind hover)
- R2. Active/in-progress courses must show a "Continue Learning" action as the primary affordance
- R3. Thumbnail editing must be accessible but must not compete with learning actions for visual prominence
- R4. All three card variants (grid, compact, list) must support the new action buttons
- R5. Card click must remain consistent: navigate to course overview regardless of status
- R6. Existing status dropdown behavior must be preserved (manual status changes still available)
- R7. MyClass page (readOnly cards) must not show editing actions or start buttons
- R8. Touch devices must have full access to all actions (no hover-only affordances)
- R9. Keyboard navigation must work for all new interactive elements
- R10. Existing `data-testid` attributes used by E2E tests must be preserved or intentionally migrated

## Scope Boundaries

- Only imported course cards (`ImportedCourseCard`, `ImportedCourseCompactCard`, `ImportedCourseListRow`)
- Only the `/courses` page context (non-readOnly cards)
- MyClass page uses readOnly cards — no behavioral change there

### Deferred to Separate Tasks

- Adding a "Continue Learning" button that navigates to the last-played lesson (requires progress-aware routing): separate PR
- Course overview page "Start Learning" CTA refinement: separate PR

## Context & Research

### Relevant Code and Patterns

- **Always-visible button on card body pattern**: `CourseCard.tsx:727-731` (progress variant) — `<Button variant="brand" asChild className="button-press w-full"><Link to={lessonLink}>Resume Learning</Link></Button>`. This is the pattern to follow.
- **Button variants**: `src/app/components/ui/button.tsx` — `variant="brand"` for primary CTAs, `variant="brand-outline"` for secondary. Sizes: `sm` (h-8), `default` (min-h-11), `touch` (h-11).
- **Design token system**: `src/styles/theme.css` — all colors must use CSS custom properties. ESLint rule `design-tokens/no-hardcoded-colors` enforces this.
- **Touch-safe z-stacking**: `docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md` — corner controls at `z-30`, overlays at `z-20`. Touch devices use `[@media(hover:none)]:opacity-100`.
- **In-flight guard pattern**: Use `useRef` (not `useState`) to prevent double-click on async actions.
- **Named CSS groups**: Use `group/card` not anonymous `group` when multiple card sections exist on a page.

### Institutional Learnings

- **Unified course card shared shell** (`docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md`): PlayOverlay was extracted into `CourseCardShell.tsx` during unification. It is only consumed by `ImportedCourseCard`. Can be safely removed from the shell.
- **Library shelf sizing & hover consistency** (`docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md`): Format badges answer "what is this?" in default state; hover overlays answer "what happens if I tap?" Both are necessary but serve different purposes.
- **Hover animation vocabulary**: Cards on the same page must share hover animation characteristics — `-translate-y-2` lift, `duration-500`, theme-aware shadow tokens.
- **Title color stability**: `group-hover:text-brand` on titles should not be used — hover feedback belongs on the container, not the text.

### External References

None needed — strong local patterns exist.

## Key Technical Decisions

- **Button placement: card body, not cover overlay**: Actions belong in the card body below the thumbnail/text content, not as full-cover overlays. This follows the established `CourseCard` progress variant pattern and makes actions always visible.
- **Camera overlay → overflow menu**: Move "Change Thumbnail" into the existing overflow/context menu (alongside "Edit details" and "Delete course"). This is a secondary editing action that should not compete with learning actions.
- **Brand variant for learning actions**: Use `variant="brand"` with `size="sm"` for "Start Learning" / "Continue Learning" buttons — consistent with the rest of the app's primary CTAs.
- **Keep card click → overview**: Card click navigates to course overview regardless of status. The button is the direct action path; the card click is the explore path. This preserves consistency with current behavior.
- **Remove PlayOverlay from CourseCardShell**: Since it's only used by `ImportedCourseCard`, removing it from the shared shell is safe. If needed later, it can be re-extracted.

## Open Questions

### Resolved During Planning

- **Button label for not-started courses**: "Start Learning" — clear, action-oriented, consistent with course overview CTA
- **What replaces the camera overlay**: Move to overflow menu as "Change thumbnail" menu item. The `ThumbnailPickerDialog` component and state remain unchanged; only the trigger moves.
- **Compact card action**: Icon-only `PlayCircle` button with `aria-label="Start learning"` to save space
- **Paused course reactivation**: Clicking "Continue Learning" on a paused course implicitly calls `updateCourseStatus(id, 'active')` — users expect it to resume, not stay paused

### Deferred to Implementation

- **"Continue Learning" button destination**: Whether to navigate to course overview or directly to the last-played lesson. Current "Resume Learning" in `CourseCard.tsx` navigates to a specific lesson; for imported courses, the overview page is the natural entry point. Implement as overview navigation for now; progress-aware routing can be added later.

## Implementation Units

### Unit 1: Replace PlayOverlay with "Start Learning" button on ImportedCourseCard

**Goal:** Remove the hidden PlayOverlay and add an always-visible "Start Learning" button in the card body for not-started courses.

**Requirements:** R1, R5, R7, R9, R10

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
- Modify: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx`

**Approach:**
- Remove the `<PlayOverlay>` render (line 587-592) and its import
- Add a `<Button variant="brand" size="sm">` in the card body section, below the metadata row (video count, PDF count, file size), conditionally rendered when `showPlay` is true
- Button label: "Start Learning" with `PlayCircle` icon
- Reuse `handleStartStudying` as the onClick handler (already has `e.stopPropagation()` and `startingRef` in-flight guard)
- Preserve `data-testid="start-course-btn"` on the new button
- The `showPlay` derivation stays the same: `status === 'not-started' && !isCompleted && !readOnly`
- Remove `PlayOverlay` from the import statement
- Update the inline video preview suppression comment (line 340) to reference the new button instead of PlayOverlay

**Patterns to follow:**
- `CourseCard.tsx:727-731` — always-visible Button in card body with `asChild` + `stopPropagation`
- `unified-course-card-shared-shell-pattern-2026-04-20.md` — `useRef` in-flight guard

**Test scenarios:**
- Happy path: Renders "Start Learning" button for not-started, non-readOnly course
- Happy path: Clicking button calls `updateCourseStatus(id, 'active')` and navigates to `/courses/:id/overview`
- Happy path: Button has `data-testid="start-course-btn"` for E2E compatibility
- Integration (R5): Card-level click handler still navigates to `/courses/:id/overview` (stopPropagation on button does not affect card click)
- Integration (R6): Status dropdown menu still opens and allows manual status changes
- Edge case: Button hidden when course status is 'active', 'completed', or 'paused'
- Edge case: Button hidden when `readOnly` is true (MyClass page)
- Edge case: Button hidden when course is 100% completed
- Edge case: Double-click is prevented (in-flight guard via `startingRef`)
- Error path: If `updateCourseStatus` fails, navigation should not occur (verify store peek)
- Keyboard: Button is focusable, has focus-visible ring, Enter/Space activates

**Verification:**
- Build passes, unit tests pass, `data-testid="start-course-btn"` is found on not-started card bodies (not as overlay)
- Design review confirms button is always visible (no hover required) and uses correct design tokens

---

### Unit 2: Add "Continue Learning" button for active courses on ImportedCourseCard

**Goal:** Add an always-visible "Continue Learning" button in the card body for active and paused courses, replacing the empty space where the camera overlay used to be the primary hover affordance.

**Requirements:** R2, R5, R7

**Dependencies:** Unit 1 (shares the same card body section)

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
- Modify: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx`

**Approach:**
- Add a `<Button variant="brand-outline" size="sm">` in the card body for courses where `status === 'active' || status === 'paused'` and `!readOnly`
- Button label: "Continue Learning" with `PlayCircle` icon
- On click for active courses: navigate to `/courses/:id/overview` (no status change needed)
- On click for paused courses: call `updateCourseStatus(id, 'active')` first (implicit reactivation), then navigate to overview
- Use `e.stopPropagation()` to prevent card-level navigation
- Show only when not `readOnly` and not completed
- For completed courses, the existing `CompletionOverlay` and progress badge already communicate status — no button needed (or optionally a "Review" button)

**Patterns to follow:**
- `CourseCard.tsx:727-731` — "Resume Learning" button pattern

**Test scenarios:**
- Happy path: Renders "Continue Learning" button for active courses (non-readOnly)
- Happy path: Renders "Continue Learning" button for paused courses
- Happy path: Clicking button on active course navigates to `/courses/:id/overview` without changing status
- Happy path: Clicking button on paused course calls `updateCourseStatus(id, 'active')` then navigates to overview
- Edge case: Button hidden when `readOnly` is true
- Edge case: Button hidden for completed courses (completion badge already communicates state)
- Edge case: Button hidden for not-started courses (those show "Start Learning" instead)
- Edge case: "Start Learning" and "Continue Learning" are mutually exclusive per card
- Integration (R5): Card-level click still navigates to overview (independent of button)
- Keyboard: Button is focusable and keyboard-operable

**Verification:**
- Active courses show "Continue Learning" in card body; not-started courses show "Start Learning"
- Buttons are mutually exclusive per card instance
- Card click still navigates to overview (independent of button)

---

### Unit 3: Move camera overlay action to overflow menu

**Goal:** Remove the hover-revealed camera overlay from the card cover and add a "Change thumbnail" option to the existing overflow/context menu.

**Requirements:** R3, R7, R8

**Dependencies:** Unit 1 (same file, adjacent code)

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
- Modify: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx`

**Approach:**
- Remove the camera overlay button (lines 571-584) — the `<button>` with `data-testid="course-thumbnail-edit-btn"`
- Add a `<DropdownMenuItem>` in the existing overflow menu (between "Edit details" and "Delete course") labeled "Change thumbnail" with a `Camera` or `Image` icon
- The menu item's onClick opens `setThumbnailPickerOpen(true)` — same state, same dialog, new trigger
- Keep `ThumbnailPickerDialog` import and state unchanged
- Touch benefit: overflow menu is accessible via the existing status badge dropdown and long-press on compact cards — no hover dependency

**Patterns to follow:**
- Existing `DropdownMenuItem` entries at lines 451-473 (Edit details, Delete course)

**Test scenarios:**
- Happy path: Overflow menu contains "Change thumbnail" menu item for non-readOnly courses
- Happy path: Clicking "Change thumbnail" opens the `ThumbnailPickerDialog`
- Edge case: "Change thumbnail" hidden when `readOnly` is true
- Edge case: Camera overlay element no longer rendered in the DOM
- Edge case: Existing "Edit details" and "Delete course" menu items still present and functional
- Integration: `ThumbnailPickerDialog` still opens and functions correctly when triggered from menu instead of overlay
- Integration (R6): Status dropdown menu still works for changing course status
- Keyboard: DropdownMenu opens/closes via Enter/Space; menu items are focusable; "Change thumbnail" activates via Enter

**Verification:**
- Hovering over an active course card no longer shows a camera icon overlay
- Overflow menu contains "Change thumbnail" item
- Thumbnail picker dialog opens from menu item click

---

### Unit 4: Add "Start Learning" action to compact and list card variants

**Goal:** Add always-visible start actions to `ImportedCourseCompactCard` and `ImportedCourseListRow` for not-started courses.

**Requirements:** R1, R4, R5, R7, R8

**Dependencies:** Unit 1 (patterns established)

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCompactCard.tsx`
- Modify: `src/app/components/figma/ImportedCourseListRow.tsx`
- Modify: `src/app/components/figma/__tests__/ImportedCourseCompactCard.test.tsx`
- Modify: `src/app/components/figma/__tests__/ImportedCourseListRow.test.tsx`

**Approach:**

**Compact card:**
- Currently has no start action — the overflow menu is the only way to change status
- Add an icon-only button (`size="touch-icon"`) placed below the title text in the card body
- Icon: `PlayCircle` with `aria-label="Start learning"`
- Condition: `status === 'not-started' && completionPercent !== 100 && !readOnly`
- On click: same `handleStartStudying` pattern (update status + navigate)
- The compact card has limited space — icon-only button keeps the footprint minimal. Using `size="touch-icon"` ensures WCAG 2.5.5 compliance (44×44px)

**List row:**
- Currently has status badge + overflow menu at the right end
- Add a `"Start"` button (`variant="brand-outline"` with `size="sm"`) as a column element in the row, positioned before the overflow menu
- `brand-outline` is preferred over `brand` to keep the row visually balanced — the row is dense with metadata; a solid brand button would compete with the status badge for visual weight
- Condition: same as compact card

**Patterns to follow:**
- Compact card long-press pattern: `docs/solutions/best-practices/2026-04-25-long-press-card-and-jsdom-pointer-event-test-pattern.md`
- List row metadata column layout: existing `ImportedCourseListRow.tsx` structure

**Test scenarios (compact card):**
- Happy path: Renders icon-only start button for not-started, non-readOnly course
- Happy path: Clicking activates course and navigates to overview
- Edge case: Action hidden for active/completed/paused courses
- Edge case: Action hidden when readOnly
- Edge case: Action hidden when 100% completed
- Keyboard: Button is focusable, has `aria-label="Start learning"`, Enter/Space activates

**Test scenarios (list row):**
- Happy path: Renders "Start" button for not-started, non-readOnly course
- Happy path: Clicking activates course and navigates to overview
- Edge case: Button hidden for active/completed/paused and readOnly
- Edge case: Button fits within row layout without causing overflow at mobile widths
- Keyboard: Button is focusable, has visible focus ring, Enter/Space activates

**Verification:**
- All three card variants have visible start actions for not-started courses
- Compact card action does not break the 4:3 thumbnail ratio or layout
- List row action does not cause horizontal overflow at 375px viewport

---

### Unit 5: Remove PlayOverlay from CourseCardShell

**Goal:** Clean up the unused `PlayOverlay` export from the shared shell now that it has no consumers.

**Requirements:** None (cleanup)

**Dependencies:** Unit 1 (must be completed first — removes the only consumer)

**Files:**
- Modify: `src/app/components/figma/CourseCardShell.tsx`
- Modify: `src/app/components/figma/__tests__/CourseCardShell.test.tsx`

**Approach:**
- Remove `PlayOverlayProps` interface (lines 58-68)
- Remove `PlayOverlay` function component (lines 70-99)
- Remove `Play` icon import if no longer used elsewhere in the file
- Remove `PlayOverlay` from the barrel export (line 149)
- Update `CourseCardShell.test.tsx` — remove PlayOverlay-specific test blocks
- Verify the `Play` icon import is still needed (check if used by any remaining code)

**Test scenarios:**
- Test expectation: none — pure removal with no behavioral change. Existing tests for `CardCover`, `CompletionOverlay`, `CoverProgressBar`, `CoverCornerChip` must continue to pass.

**Verification:**
- Build passes with no unused import warnings
- `grep -rn 'PlayOverlay' src/` returns no results (except possibly in test fixtures or comments)
- Remaining CourseCardShell exports (`CardCover`, `CompletionOverlay`, `CoverProgressBar`, `CoverCornerChip`, `OVERLAY_SCRIM_CLASS`) still work

---

### Unit 6: Update E2E test selectors

**Goal:** Update E2E tests that reference the old PlayOverlay DOM structure to match the new button-based UI.

**Requirements:** R10

**Dependencies:** Units 1-4 (new DOM structure must be in place)

**Files:**
- Modify: `tests/design-review-course-cards.spec.ts`

**Approach:**
- The `data-testid="start-course-btn"` is preserved (Unit 1), so most selectors should still work
- Update any assertions about the element being an overlay (opacity-based visibility, absolute positioning) to reflect it's now a visible button in the card body
- Update DR-2 test (play overlay anatomy) if it checks overlay-specific properties
- Remove assertions about `course-thumbnail-edit-btn` being an overlay element — if the E2E test references it, update to check the overflow menu instead, or remove if thumbnail editing is out of scope for design review

**Test scenarios:**
- E2E: `start-course-btn` is found and clickable without requiring hover first
- E2E: Camera overlay (`course-thumbnail-edit-btn`) no longer appears on card hover

**Verification:**
- `npx playwright test tests/design-review-course-cards.spec.ts` passes

## System-Wide Impact

- **Interaction graph:** `ImportedCourseCard` body layout changes — the card body now has an action button row. This affects the card height calculation in the virtualized grid (`VirtualizedCoursesList`). Verify that `estimateSize` still produces accurate heights.
- **Error propagation:** `handleStartStudying` already peeks at `importError` after the status update. The new "Continue Learning" button has no status mutation, so error surface is limited to navigation failures (handled by React Router).
- **State lifecycle risks:** None — `updateCourseStatus` is unchanged. Button visibility is derived from existing `showPlay` and status booleans.
- **API surface parity:** The `PlayOverlay` export removal from `CourseCardShell` is a breaking change for that module's public API. Verify no external consumers (already confirmed: only `ImportedCourseCard` uses it).
- **Unchanged invariants:** `LearnerCourseStatus` type, `updateCourseStatus` store method, MyClass filter (`status !== 'not-started'`), card click → overview navigation, and status dropdown menu are all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Virtualized grid height miscalculation after card body changes | Test with 30+ courses to trigger virtualization; if `estimateSize` is off, adjust the constant |
| Compact card space constraints make start action hard to fit | Try icon-only chip on thumbnail edge first; if layout breaks, fall back to enhancing the overflow menu with a prominent "Start" item |
| E2E test breakage from DOM structure changes | Preserve `data-testid="start-course-btn"` on new button; run E2E suite early in implementation |

## Sources & References

- **Origin document:** Brainstorm in plan file `brainstorm-in-the-courses-polished-dusk.md`
- **Related code:** `src/app/components/figma/ImportedCourseCard.tsx`, `src/app/components/figma/CourseCardShell.tsx`, `src/app/components/figma/CourseCard.tsx:727-731`
- **Related solutions:** `docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md`
