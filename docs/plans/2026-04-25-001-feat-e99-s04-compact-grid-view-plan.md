---
title: "feat: E99-S04 Compact Grid View"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e99-s04-compact-grid-view-requirements.md
---

# feat: E99-S04 Compact Grid View

## Overview

Add a third Courses view mode — `compact` — that renders an app-icon-style dense grid of thumbnail-only cards. Title is the only visible text; progress shows as a 2px bar overlay; overflow menu and status badge are hidden until hover (desktop) or long-press (mobile).

This story is the third of the E99 view-mode trio (list, grid, compact) and depends on `courseViewMode` (E99-S01) and `getGridClassName` (E99-S02).

## Problem Frame

Power users with large catalogs need a "scan by cover" mode. The default grid card is metadata-rich (author, tags, status, timestamp) and shows ~5 columns at xl. Users have asked for a denser view that mimics an app launcher. List answers metadata-rich vertical scanning; compact answers visual-recognition scanning. Both modes coexist (see origin: docs/brainstorms/2026-04-25-e99-s04-compact-grid-view-requirements.md).

## Requirements Trace

- R1. Compact mode renders only thumbnail + title + minimal progress; tags/author/status/timestamp/overflow hidden or hover-revealed (AC1).
- R2. At `lg+` with `auto` columns, grid shows ~6-8 cols using `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8` (AC2).
- R3. Explicit column choice (2-5) is scaled ~1.6× to compact-equivalent (Approach A) (AC3).
- R4. Hover reveals overflow menu + status badge with title `text-foreground` emphasis (AC4).
- R5. Long-press > 500ms opens context menu; short tap navigates; pointer move > 10px cancels (AC5). Fallback: always-visible 3-dot button if implementation gets fragile.
- R6. Click navigates to course detail (AC6).
- R7. Progress > 0 renders 2px `bg-brand` bar at bottom of thumbnail; no numeric percent (AC7).
- R8. Card touch target ≥ 44×44px at densest breakpoint.
- R9. `prefers-reduced-motion` respected for hover transitions.
- R10. Design tokens only — no hardcoded colors.

## Scope Boundaries

- No separate `compactGridColumns` setting (Approach B from origin) — defer to user testing.
- No re-architecture of `ImportedCourseCard` — compact is a sibling component.
- No changes to list view, list row, or grid view default behavior.
- No new persisted preference fields.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/figma/ImportedCourseCard.tsx` — props shape and click/navigation pattern to mirror.
- `src/app/components/courses/gridClassName.ts` — single-arg helper today; must extend to `(columns, viewMode)`.
- `src/app/components/courses/__tests__/gridClassName.test.ts` — existing branch tests; extend.
- `src/app/pages/Courses.tsx` lines 286-322 — view-mode branching block where compact card slots in (currently uses placeholder grid string).
- `src/stores/useEngagementPrefsStore` — owns `courseViewMode` and `courseGridColumns`.
- `src/app/components/figma/VirtualizedGrid` — accepts `gridClassName`; reuse for compact.
- shadcn `DropdownMenu` / Radix `ContextMenu` for hover and long-press menus.

### Institutional Learnings

- Tailwind v4 JIT requires literal class strings — every compact branch must return a fully-spelled-out class string (see existing `gridClassName.ts` header comment).
- Always use design tokens (`bg-brand`, `text-foreground`) — ESLint blocks hardcoded colors.
- 44×44 touch target rule (CLAUDE.md styling rules).

### External References

None needed — pattern is well-established locally.

## Key Technical Decisions

- **Approach A (scale explicit columns)** — single `courseGridColumns` setting; compact maps `2→3, 3→5, 4→6, 5→8, auto→auto-compact`. Rationale: simpler state, one mental model, can promote to Approach B later if user testing demands.
- **`<ImportedCourseCompactCard />` is a sibling**, not a variant prop on `ImportedCourseCard`. Rationale: layout, hover behavior, and DOM structure differ enough that variant props would muddy both components.
- **Long-press uses pointer events on the card root** with `setTimeout(500)` cancelled on `pointermove > 10px` / `pointerup` / `pointercancel`. Open the existing `DropdownMenu` programmatically via controlled `open` state to avoid two menu implementations.
- **Mobile fallback is always-visible 3-dot button** if long-press proves fragile — gated behind a `useIsTouchDevice()` check (already present in codebase) or a CSS `@media (hover: none)` class.
- **Progress bar is absolutely positioned inside the thumbnail wrapper** with `overflow-hidden` rounded corners so it follows the thumbnail's curvature.

## Open Questions

### Resolved During Planning

- Scaling vs separate setting: chose A (scaling) per origin recommendation.
- Aspect ratio: 4:3 thumbnail (matches existing `ImportedCourseCard` aspect ratio for visual consistency).
- Compact `auto` mapping: dedicated dense breakpoint set per AC2.

### Deferred to Implementation

- Whether long-press conflicts with native scroll on iOS — verify in E2E mobile viewport. If fragile, ship the dot-button fallback.
- Whether hover transition's `text-foreground` emphasis adds enough signal or feels redundant with the underlying default.

## Implementation Units

- [ ] **Unit 1: Extend `getGridClassName` with `viewMode` arg + scaling rule**

**Goal:** Make the helper return compact-mode class strings; document the 1.6× scaling rule.

**Requirements:** R2, R3, R10

**Dependencies:** None (helper exists from E99-S02).

**Files:**
- Modify: `src/app/components/courses/gridClassName.ts`
- Test: `src/app/components/courses/__tests__/gridClassName.test.ts`

**Approach:**
- Add second optional arg: `viewMode: 'grid' | 'compact' = 'grid'`.
- For `viewMode === 'compact'`, return a separate switch with these literal strings:
  - `auto` → `'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3'`
  - `2` → 3-col compact (`grid-cols-2 sm:grid-cols-3 gap-3`)
  - `3` → 5-col compact
  - `4` → 6-col compact
  - `5` → 8-col compact
- Update file-header JSDoc to describe scaling rule (1.6× rounded, capped at 8) and `gap-3` choice.

**Patterns to follow:**
- Existing switch with `_exhaustive: never` pattern.
- Literal class strings only (Tailwind v4 JIT).

**Test scenarios:**
- Happy path: `getGridClassName('auto', 'compact')` returns the 8-col xl string with `gap-3`.
- Happy path: `getGridClassName(4, 'compact')` returns 6-col compact string.
- Happy path: `getGridClassName('auto')` (no viewMode arg) preserves existing grid behavior (back-compat).
- Edge case: each compact branch starts with `grid-cols-2` (mobile floor) — assert via substring match for all 5 cases.
- Edge case: every compact branch contains `gap-3` (not `var(--content-gap)`).

**Verification:**
- All existing grid tests pass; new compact tests pass; type-check clean.

- [ ] **Unit 2: Create `<ImportedCourseCompactCard />`**

**Goal:** New component rendering thumbnail + 2-line title + 2px progress overlay with hover-revealed overflow menu.

**Requirements:** R1, R4, R6, R7, R8, R9, R10

**Dependencies:** None.

**Files:**
- Create: `src/app/components/figma/ImportedCourseCompactCard.tsx`
- Test: `src/app/components/figma/__tests__/ImportedCourseCompactCard.test.tsx`

**Approach:**
- Accept same core props as `ImportedCourseCard`: `course`, `allTags`, `completionPercent`, `momentumScore`.
- Layout: anchor/button card root → thumbnail wrapper (`aspect-[4/3] rounded-lg overflow-hidden relative`) → title below (`text-xs sm:text-sm font-medium line-clamp-2 mt-2`).
- Progress: `<div className="absolute bottom-0 left-0 h-0.5 bg-brand" style={{ width: \`${progress}%\` }} />` only when `progress > 0`. Inline `style` for dynamic width is acceptable here (one numeric value, no token violation).
- Overflow menu: positioned `absolute top-1 right-1`, wrapped in `opacity-0 group-hover:opacity-100 motion-safe:transition-opacity duration-150` on the card root (`group` class).
- Status badge: same fade-in pattern as overflow menu.
- Title hover: `group-hover:text-foreground` (default may already be `text-foreground`; use if subtle change is needed; otherwise drop and document).
- Click handler: navigate to `/library/courses/:id` (mirror existing card).
- Touch target: enforce `min-h-[44px] min-w-[44px]` on the card root.
- Reduced motion: rely on `motion-safe:` prefix to skip transitions.

**Patterns to follow:**
- `ImportedCourseCard` for navigation, prop shape, and DropdownMenu wiring.
- Tailwind `group` + `group-hover:` for reveal.

**Test scenarios:**
- Happy path: renders course title and thumbnail img only — query for tag/author/timestamp text returns nothing.
- Happy path: clicking the card calls navigate (or fires the same click handler shape as `ImportedCourseCard`).
- Edge case: `progress === 0` — progress bar element is not rendered.
- Edge case: `progress === 73` — progress bar is rendered with `style.width === '73%'`.
- Happy path: overflow menu trigger exists in DOM but has `opacity-0` class until hovered (assert class on parent has `group-hover:opacity-100`).
- Edge case: title with very long text gets `line-clamp-2` class applied.
- A11y: card root has accessible name (course title) and role of link or button.

**Verification:**
- Component renders in Storybook/test harness; visual matches design guidance; no design-token ESLint violations.

- [ ] **Unit 3: Long-press context menu on touch devices**

**Goal:** Open the overflow `DropdownMenu` after a 500ms hold; cancel on movement or release.

**Requirements:** R5, R8

**Dependencies:** Unit 2.

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCompactCard.tsx`
- Test: `src/app/components/figma/__tests__/ImportedCourseCompactCard.test.tsx`

**Approach:**
- Track menu open state locally: `const [menuOpen, setMenuOpen] = useState(false)`.
- On `pointerdown`: store `startX/startY` and start a 500ms timer that calls `setMenuOpen(true)` and prevents the click navigation (set a `longPressTriggered` ref).
- On `pointermove`: if `Math.hypot(dx, dy) > 10`, clear timer.
- On `pointerup` / `pointercancel` / `pointerleave`: clear timer.
- In click handler: if `longPressTriggered.current` is true, swallow the click and reset.
- Wire `<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>` for controlled mode.
- Fallback: if `@media (hover: none)`, render an always-visible compact dot button (`opacity-100` instead of `opacity-0`). Implement via a small CSS rule or `useMediaQuery`.

**Patterns to follow:**
- Controlled Radix `DropdownMenu` pattern used elsewhere in shadcn components.

**Test scenarios:**
- Happy path: pointerdown + advance timer 500ms (use `vi.useFakeTimers`) → menu opens.
- Edge case: pointerdown + pointermove with > 10px delta + advance timer 500ms → menu does NOT open.
- Edge case: pointerdown + pointerup at 200ms → menu does NOT open and click navigates.
- Edge case: pointerdown + 500ms hold → click handler that fires after release does NOT trigger navigation.
- Integration: with `matchMedia('(hover: none)')` mocked true, a visible dot button is rendered (no hover required).

**Verification:**
- Touch behavior verified in unit tests; E2E confirms scrolling is not blocked on mobile viewport.

- [ ] **Unit 4: Wire compact mode into `Courses.tsx`**

**Goal:** When `courseViewMode === 'compact'`, render `ImportedCourseCompactCard` and use the new helper signature.

**Requirements:** R1, R2, R3, R6

**Dependencies:** Units 1 and 2.

**Files:**
- Modify: `src/app/pages/Courses.tsx`

**Approach:**
- Replace the inline placeholder string at line ~319 with `getGridClassName(courseGridColumns, courseViewMode === 'compact' ? 'compact' : 'grid')`.
- Branch the `renderItem` of `VirtualizedGrid`: when `courseViewMode === 'compact'`, render `<ImportedCourseCompactCard ... />`; otherwise `<ImportedCourseCard ... />`.
- Keep the list-mode path unchanged.

**Patterns to follow:**
- Existing ternary in render block.

**Test scenarios:**
- Test expectation: covered by E2E in Unit 5 — no new unit tests needed for the page-level wiring.

**Verification:**
- Toggling compact in the UI produces a visibly denser grid; no console errors.

- [ ] **Unit 5: E2E spec for compact view**

**Goal:** Validate that compact mode renders dense grid, navigates on click, and preserves overflow access.

**Requirements:** R1, R2, R6

**Dependencies:** Unit 4.

**Files:**
- Create: `tests/e2e/e99-s04-compact-view.spec.ts`

**Approach:**
- Seed library with several imported courses via existing seeding helpers.
- Set viewport to 1440 (lg+).
- Set `courseViewMode` to `compact` (via the toggle UI or store seed).
- Assert the imported courses grid container has the expected compact `auto` classes (or computed column count ≥ 6 via DOM measurement).
- Click first compact card → assert URL contains `/library/courses/`.
- On a 375px mobile viewport: assert the always-visible dot button exists OR long-press opens menu (use `dispatchEvent` for pointerdown/up).

**Patterns to follow:**
- Existing E99-S01 / S02 specs for view-mode setup.

**Test scenarios:**
- Happy path: lg+ viewport with compact mode → grid container element matches the 6-or-more-column class.
- Happy path: clicking a compact card navigates to the course detail route.
- Integration: mobile viewport renders an accessible overflow trigger reachable without hover.

**Verification:**
- Spec passes locally; no flake on first run.

## System-Wide Impact

- **Interaction graph:** Courses page render path; `useEngagementPrefsStore` consumers; `getGridClassName` callers (only Courses today).
- **Error propagation:** None new — compact card fails the same way as the grid card if `course` is null.
- **State lifecycle risks:** Long-press timer must be cleared on unmount to avoid setting state on an unmounted component.
- **API surface parity:** `getGridClassName` signature changes from 1-arg to 1-or-2-arg; default param keeps existing call sites valid.
- **Integration coverage:** E2E covers cross-layer wiring (toggle → store → page → grid → card).
- **Unchanged invariants:** List view, default grid view, and existing column-count behavior (E99-S02) are untouched and remain covered by their existing tests.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Long-press conflicts with iOS scroll | 10px movement threshold cancels timer; fallback always-visible dot button on `(hover: none)` |
| 1.6× scaling feels arbitrary to users | Documented in helper JSDoc; promote to separate `compactGridColumns` setting if user testing flags confusion |
| Touch target < 44px at xl 8-col grid | Card root has `min-w-[44px] min-h-[44px]`; viewport-width math: 1280px / 8 cols = 160px > 44px |
| Tailwind JIT drops dynamic classes | All compact branches return literal strings (matches existing pattern) |
| Hover reveal hides overflow on `(hover: none)` devices | Media query fallback renders persistent dot button |

## Documentation / Operational Notes

- Update story file's "Challenges and Lessons Learned" section after implementation.
- No user-facing docs change — view mode toggle already discoverable.

## Sources & References

- Origin document: docs/brainstorms/2026-04-25-e99-s04-compact-grid-view-requirements.md
- Story: docs/implementation-artifacts/stories/E99-S04-compact-grid-view.md
- Related code: src/app/components/courses/gridClassName.ts, src/app/components/figma/ImportedCourseCard.tsx, src/app/pages/Courses.tsx
- Related stories: E99-S01 (`courseViewMode`), E99-S02 (`courseGridColumns` + helper)
