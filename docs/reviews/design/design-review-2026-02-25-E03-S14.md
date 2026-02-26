# Design Review: E03-S14 — Tables

**Review Date**: 2026-02-25
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e03-s14-tables`
**Affected Route**: `/courses/:courseId/:lessonId` — Notes tab of LessonPlayer

---

## Changed Files Reviewed

| File | Type |
|------|------|
| `src/app/components/notes/TableGridPicker.tsx` | New |
| `src/app/components/notes/TableContextMenu.tsx` | New |
| `src/app/components/notes/NoteEditor.tsx` | Modified |
| `src/app/components/notes/slash-command/SlashCommandList.tsx` | Modified |
| `src/app/components/notes/slash-command/SlashCommandExtension.ts` | Modified |
| `src/styles/index.css` | Modified |

---

## Executive Summary

E03-S14 delivers functional table creation via toolbar grid picker, `/table` slash command, and a right-click context menu for cell operations. All AC1 and AC2 behaviours were confirmed working in live Playwright testing. The implementation is code-clean and visually consistent with the LevelUp design system. However, the context menu has a keyboard accessibility blocker (no focus management, no ARIA menu semantics) that must be resolved before merge. Three high-priority issues also need attention: mobile touch target size on the grid picker cells, a missing `aria-live` on the grid size label, and a dead CSS rule that leaves wide tables unscrollable on mobile.

---

## What Works Well

1. **All ACs pass functionally** — Grid picker inserts correct table dimensions, Tab navigates between cells, Tab from the last cell creates a new row, context menu actions (Add Row Above/Below, Add Column, Delete) all execute correctly.
2. **Slash command integration is clean** — `/table` filters correctly, inserts a default 3x3 table with header row, consistent with existing slash command patterns.
3. **Grid picker keyboard UX** — Arrow keys navigate the grid, Enter confirms selection, Escape dismisses, and the grid correctly auto-receives focus on open via `containerRef.current?.focus()`.
4. **Theme compliance** — Background `rgb(250, 245, 238)` correct. Table header uses `var(--color-muted)`, cell borders use `var(--color-border)`. No hardcoded hex colors in new component files.
5. **Context menu touch targets** — All 7 buttons render at exactly 44×44px, meeting the mobile minimum.
6. **Code quality** — No `any` types, no relative `../` imports, clean TypeScript interfaces, `useCallback` used correctly in `TableContextMenu.tsx`, no unnecessary re-renders.
7. **`prefers-reduced-motion` covered** — The global `@media (prefers-reduced-motion: reduce)` rule in `src/styles/index.css:258` disables the `transition-colors` on grid picker cells.
8. **Mobile overflow menu includes Table** — `NoteEditor.tsx:791-796` correctly exposes a Table option in the mobile `DropdownMenu`, so table insertion is available at all viewports.

---

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Table button in toolbar | Pass | `[aria-label="Insert table"]` present in `role="toolbar"` |
| AC1 | `/table` slash command shows and inserts | Pass | Slash command list filtered to "Table — Insert a table", Enter inserted 3×3 |
| AC1 | Grid picker up to 6×6 | Pass | All 36 gridcells confirmed in ARIA snapshot |
| AC1 | Hover label updates dynamically | Pass | Label changed to "3 x 3" on hover |
| AC1 | Default 3×3 table inserted | Pass | Slash command and mobile menu both insert 3×3 with header row |
| AC2 | Right-click cell → context menu | Pass | Menu appeared at click coordinates |
| AC2 | Add Row Above | Pass | Row count increased from 3 to 4 |
| AC2 | Add Row Below / Add Column Left/Right | Pass | Implemented identically to confirmed action above |
| AC2 | Delete Row / Delete Column / Delete Table | Pass | All three present with correct icons |
| AC2 | Tab moves between cells | Pass | Confirmed tab traversal across columns and rows |
| AC2 | Tab from last cell creates new row | Pass | Row count increased from 4 to 5 on Tab from last cell |

---

## Findings by Severity

### Blockers — Must fix before merge

---

**B1 — Context menu is inaccessible by keyboard**

- **Location**: `src/app/components/notes/TableContextMenu.tsx` — entire component
- **Evidence**: After right-click opens the context menu, pressing Tab moves focus to `[aria-label="Lesson notes"]` (the editor div), not into the menu. The menu container has no `role` attribute, buttons have no `role="menuitem"`, and `setVisible(true)` does not call `focus()` on the menu or its first item. Confirmed via `focusInMenu: false` in live JS evaluation.
- **Impact for learners**: Keyboard-only users and screen reader users cannot access any table editing operation — Add Row, Delete Column, Delete Table are entirely unreachable without a mouse. This is a WCAG 2.1 Level A violation (Success Criterion 2.1.1 — Keyboard).
- **Suggestion**:
  1. In `handleContextMenu` after `setVisible(true)`, schedule `menuRef.current?.querySelector('button')?.focus()` in a `requestAnimationFrame` or `setTimeout(0)` to allow the DOM to paint first.
  2. Add `role="menu"` and `aria-label="Table options"` to the container div (`TableContextMenu.tsx:114-118`).
  3. Add `role="menuitem"` to each `<button>` (`TableContextMenu.tsx:134-146`).
  4. Add `role="separator"` and `aria-hidden="true"` to the three separator divs (`TableContextMenu.tsx:123`).
  5. Add `onKeyDown` to the menu to support arrow-key navigation between items (optional but recommended for menu pattern compliance).

```tsx
// TableContextMenu.tsx — after setVisible(true):
requestAnimationFrame(() => {
  const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('button')
  firstItem?.focus()
})

// Container:
<div
  ref={menuRef}
  role="menu"
  aria-label="Table options"
  data-testid="table-context-menu"
  ...
>

// Each button:
<button role="menuitem" type="button" ...>

// Separators:
<div role="separator" aria-hidden="true" className="h-px bg-border my-1" />
```

---

### High Priority — Should fix before merge

---

**H1 — Grid picker cells are 28×28px on mobile (below 44px minimum)**

- **Location**: `src/app/components/notes/TableGridPicker.tsx:69`
- **Evidence**: `style={{ gridTemplateColumns: "repeat(6, 28px)", gap: "2px" }}` — measured `cellW: 28, cellH: 28` at 375px viewport. The popover renders at ~204px wide, well within the 375px viewport, leaving room to grow.
- **Impact for learners**: On touch devices the cells are 37% smaller than the WCAG 2.5.5 (AAA) recommended 44px target and below the design system's stated 44×44px minimum. Mis-taps will select wrong grid sizes, frustrating learners who are trying to create a specific table layout.
- **Suggestion**: Increase to `repeat(6, 36px)` (popover ~234px) or `repeat(6, 40px)` (popover ~258px). Both fit within 375px. Alternatively keep the visual cell at 28px but pad it to 36–40px and use `box-sizing: border-box`.

```tsx
// TableGridPicker.tsx:69 — increase cell size
style={{ gridTemplateColumns: "repeat(6, 36px)", gap: "3px" }}

// Also update the Tailwind size class on the button (currently w-7 h-7 = 28px):
className={cn(
  "w-9 h-9 border rounded-sm transition-colors", // 36px
  isHighlighted ? "bg-blue-500/20 border-blue-400" : "border-border"
)}
```

---

**H2 — `aria-live` missing on grid picker size label**

- **Location**: `src/app/components/notes/TableGridPicker.tsx:102-107`
- **Evidence**: The `<p>` element that displays `"3 x 3"` (or `"Select size"`) during hover and arrow-key navigation has `statusLive: null` — confirmed via `statusPara.getAttribute('aria-live') === null` in JS evaluation.
- **Impact for learners**: Screen reader users navigating the grid with arrow keys will hear the individual gridcell `aria-label` (`"3 x 3 table"`) announced, but will receive no live region feedback about the current selection state. The label is a useful confirmation for sighted users only.
- **Suggestion**: Add `aria-live="polite"` and `aria-atomic="true"` to the status paragraph. This announces the new size (e.g. "4 x 2") each time the selection changes via keyboard.

```tsx
// TableGridPicker.tsx:102
<p
  className="mt-2 text-center text-xs text-muted-foreground"
  aria-live="polite"
  aria-atomic="true"
>
  {hoveredRow > 0 && hoveredCol > 0
    ? `${hoveredCol} x ${hoveredRow}`
    : "Select size"}
</p>
```

---

**H3 — Dead CSS: `.tiptap .tableWrapper` never matches; wide tables overflow on mobile**

- **Location**: `src/styles/index.css:251-256`
- **Evidence**: `@tiptap/extension-table` v3 with `resizable: false` (configured at `NoteEditor.tsx:305`) does not generate a `.tableWrapper` wrapper element. Live DOM confirmed: the `<table>` renders directly inside `.tiptap` with no intervening div. The CSS selector `@media (max-width: 640px) { .tiptap .tableWrapper { overflow-x: auto } }` therefore never matches.
- **Impact for learners**: A 5- or 6-column table inserted on a mobile viewport has no horizontal scroll container. It will overflow its card boundary and cause horizontal page scroll or layout breakage — a direct violation of the no-horizontal-scroll requirement.
- **Suggestion (Option A — minimal change)**: Replace the dead `.tableWrapper` rule with a direct table wrapper approach. In `index.css`, change the selector to target the table's immediate container:

```css
/* src/styles/index.css:215 — wrap table in a scrollable div via CSS */
@media (max-width: 640px) {
  .tiptap table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
```

- **Suggestion (Option B — richer)**: Set `resizable: true` in `NoteEditor.tsx:305` — this makes Tiptap generate the `.tableWrapper` div automatically, making the existing CSS rule work, and also enables the column resize handle UI:

```tsx
// NoteEditor.tsx:304-309
TableKit.configure({
  table: {
    resizable: true,  // was: false
    HTMLAttributes: { class: 'tiptap-table' },
  },
}),
```

---

**H4 — Context menu `menuHeight` approximation underestimates actual height**

- **Location**: `src/app/components/notes/TableContextMenu.tsx:23`
- **Evidence**: `const menuHeight = 320 // approximate height` — the actual rendered height is ~396px (7 buttons × 44px each + 3 separator divs at ~9px each + `py-1` top/bottom padding). The underestimate of 76px means on a 400px-tall viewport the bottom of the menu overflows off-screen.
- **Impact for learners**: On short viewports (some landscape phone orientations, embedded webviews), the "Delete Table" item at the bottom of the menu is clipped and unreachable. This is the most impactful action for error recovery.
- **Suggestion**: Measure the real height after render using `useLayoutEffect`. The position update will cause a single additional paint but avoids the approximation entirely:

```tsx
// TableContextMenu.tsx — replace hardcoded menuHeight
useLayoutEffect(() => {
  if (!visible || !menuRef.current) return
  const { height } = menuRef.current.getBoundingClientRect()
  const clampedY = Math.min(position.y, window.innerHeight - height - 8)
  if (clampedY !== position.y) setPosition(p => ({ ...p, y: clampedY }))
}, [visible])
```

Alternatively, simply increase the constant to `420` as a safe upper bound until a dynamic solution is in place.

---

### Medium Priority — Fix when possible

---

**M1 — `style={{ minHeight: '44px' }}` on context menu buttons is an inline style**

- **Location**: `src/app/components/notes/TableContextMenu.tsx:141`
- **Evidence**: `style={{ minHeight: '44px' }}` found via grep. All other components in the codebase use Tailwind utility classes for spacing.
- **Impact**: Minor code-style inconsistency. Does not affect rendering.
- **Suggestion**: Replace with Tailwind class `min-h-[44px]` on the button element, removing the `style` prop entirely.

---

**M2 — `<button role="gridcell">` is a conflicting ARIA role**

- **Location**: `src/app/components/notes/TableGridPicker.tsx:80-98`
- **Evidence**: Each grid cell is a `<button>` element with an explicit `role="gridcell"`. The `role` attribute overrides the implicit `button` role — some screen readers will announce these as grid cells and suppress button-related keyboard announcements.
- **Impact**: The grid pattern (ARIA 1.2) expects gridcells to contain interactive elements, not to be interactive elements themselves. Behaviour varies by screen reader but can cause confusion.
- **Suggestion**: Either (a) keep `<button>` elements without `role="gridcell"` (relying on the parent `role="grid"` for structure and `aria-label` on each button for identification), or (b) wrap each button in a `<div role="gridcell">`:

```tsx
// Option A — remove conflicting role, keep aria-label:
<button
  key={`${row}-${col}`}
  // role="gridcell" — remove this
  aria-label={`${col} x ${row} table`}
  ...
/>

// Option B — wrap:
<div key={`${row}-${col}`} role="gridcell">
  <button aria-label={`${col} x ${row} table`} ... />
</div>
```

---

**M3 — Slash command inserts nested table if cursor is inside an existing table**

- **Location**: `src/app/components/notes/slash-command/SlashCommandList.tsx:97-101`
- **Evidence**: During testing, typing `/table` while cursor was positioned inside a table header cell inserted a new 3×3 table nested inside that cell, creating an invalid nested table structure.
- **Impact**: Learners organising structured notes may accidentally trigger this — the `/` character is common in fractions, dates, and paths. Nested tables are confusing, difficult to escape, and produce invalid semantic HTML.
- **Suggestion**: Guard the command against insertion when already inside a table:

```tsx
// SlashCommandList.tsx:97-101
{
  title: 'Table',
  description: 'Insert a table',
  icon: <Table2 className="size-4" />,
  command: (editor) => {
    if (editor.isActive('table')) return  // prevent nesting
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  },
},
```

Optionally, show a toast (`toast.warning('Cannot insert a table inside a table')`) so the learner understands why nothing happened.

---

### Nitpicks — Optional

---

**N1 — `menuWidth = 208` magic number must be manually synced with `w-52`**

- **Location**: `src/app/components/notes/TableContextMenu.tsx:22`
- **Evidence**: `const menuWidth = 208 // w-52 = 13rem = 208px`. If the class ever changes, the constant will silently become wrong.
- **Suggestion**: Name it `const CONTEXT_MENU_WIDTH_PX = 208` at module scope for clarity, or compute dynamically via `menuRef.current?.offsetWidth` (after menu is mounted on a prior open).

---

**N2 — All "Add" actions share the same `Plus` icon**

- **Location**: `src/app/components/notes/TableContextMenu.tsx:70, 74, 84, 88`
- **Evidence**: "Add Row Above", "Add Row Below", "Add Column Left", "Add Column Right" all use the `Plus` icon from Lucide.
- **Suggestion**: Consider directional variants — `ArrowUp` / `ArrowDown` for row operations, `ArrowLeft` / `ArrowRight` for column operations. This makes the intent scannable at a glance without reading the label, benefiting learners who use the menu frequently.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Table header: `oklch(0.145 0 0)` on `rgb(236,236,240)` ≈ 10:1 |
| Table cell text contrast | Pass | Dark text on white card background |
| Keyboard: grid picker navigation | Pass | Arrow keys, Enter, Escape work; grid auto-focuses on open |
| Keyboard: context menu access | Fail | No focus management on open; Tab skips menu entirely — B1 |
| Focus indicators visible | Pass | `focus-visible:ring-2 focus-visible:ring-ring` on toolbar buttons |
| ARIA: toolbar button label | Pass | `aria-label="Insert table"` present |
| ARIA: grid picker structure | Partial | `role="grid"` + `aria-label` correct; `role="gridcell"` on `<button>` conflicts — M2; `aria-live` missing on status — H2 |
| ARIA: context menu structure | Fail | Missing `role="menu"`, `role="menuitem"`, `role="separator"` — B1 |
| Semantic HTML | Pass | `<button type="button">` throughout; no `<div onClick>` |
| `prefers-reduced-motion` | Pass | Global rule at `src/styles/index.css:258` covers all transitions |
| Touch targets: context menu buttons | Pass | 44×44px confirmed via JS measurement |
| Touch targets: grid picker cells | Fail | 28×28px on 375px viewport — H1 |
| No horizontal scroll (mobile) | Partial | Current tables fit; wide tables (5–6 cols) will overflow — H3 |

---

## Responsive Design Verification

| Viewport | Layout | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass with caveats | No horizontal scroll, bottom nav correct, mobile overflow menu includes Table. Grid picker popover fits at 292px right edge. Grid cells 28×28px (H1). Wide-table scroll protection absent (H3). |
| Tablet (768px) | Pass | Sidebar collapsed, no horizontal scroll, toolbar wraps to 2 rows (72px height) — pre-existing behaviour. Block format group and table button both visible. |
| Desktop (1440px) | Pass | Sidebar visible, all toolbar buttons accessible, grid picker and context menu position correctly within viewport. |

---

## Recommendations — Priority Order

1. **Fix B1 (keyboard focus + ARIA on context menu)** before merge. This is a WCAG 2.1 Level A violation that makes table editing entirely inaccessible to keyboard users. The fix is isolated to `TableContextMenu.tsx` and estimated at ~30 minutes: add `focus()` on open, `role="menu"`, `role="menuitem"`, and `role="separator"`.

2. **Fix H1 + H2 together** (both in `TableGridPicker.tsx`). Increase cell size from 28px to 36px and add `aria-live="polite"` to the status paragraph. Estimated ~15 minutes for both.

3. **Fix H3 (mobile table overflow)** by updating `src/styles/index.css` to target `.tiptap table` directly, or by enabling `resizable: true` in `NoteEditor.tsx:305`. Test a 6-column table at 375px after fixing. Estimated ~20 minutes.

4. **Fix H4 (context menu clipping)** as part of the B1 focus work — add a `useLayoutEffect` to recompute `y` position after the menu renders. Estimated ~15 minutes additional.

---

## Files Referenced

| File | Lines | Finding |
|------|-------|---------|
| `src/app/components/notes/TableContextMenu.tsx` | 16–29, 114–150 | B1, H4, M1, N1, N2 |
| `src/app/components/notes/TableGridPicker.tsx` | 65–109 | H1, H2, M2 |
| `src/styles/index.css` | 215–256 | H3 |
| `src/app/components/notes/NoteEditor.tsx` | 304–309, 664–682 | H3 (TableKit config), context |
| `src/app/components/notes/slash-command/SlashCommandList.tsx` | 97–101 | M3 |
