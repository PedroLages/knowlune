---
title: fix: Bulk import “Select Course Folders” modal layout and overflow
type: fix
status: active
date: 2026-05-04
---

# fix: Bulk import “Select Course Folders” modal layout and overflow

## Overview

Tighten layout and overflow behavior in the bulk course import flow (`BulkImportDialog`) so the “Select Course Folders” step (and related steps that reuse the same shell) keeps all text and footer actions inside the dialog, with predictable spacing next to the close control and full-width interactive rows for long folder names.

## Problem Frame

On the Courses page, importing multiple folders opens `BulkImportDialog`. The folder-selection step shows a toolbar (“Deselect All” / selection count), a scrollable list of checkboxes with long folder names, and a footer with “Back” and “Scan N Folders”. Users see horizontal clipping (e.g. selection count cut off), primary action buttons visually breaking past the dialog edge, and list row highlights that do not read as full-width rows. This comes from **flex min-width defaults**, **missing space reservation for the absolute close button**, and **footer rows that do not wrap or shrink** on constrained widths — not from broken import logic.

## Requirements Trace

- R1. Selection count and header copy remain fully readable without horizontal clipping at typical modal widths (including long folder names in the list).
- R2. Footer actions (“Back”, “Scan N Folders”, and the same patterns on “Review” / “Import Complete”) stay visually inside the dialog padding and do not overlap the outer border.
- R3. Folder rows use the full content width; long names truncate or wrap in a controlled way (no horizontal expansion of the dialog).
- R4. Changes follow existing Tailwind + shadcn/Radix dialog patterns used elsewhere in the app.

## Scope Boundaries

- **In scope:** Layout, spacing, overflow, and footer behavior in `BulkImportDialog` (all steps that share the same `DialogContent` wrapper are fair game for consistent fixes).
- **Out of scope:** Import scanning logic, filesystem APIs, store behavior, copy changes, or redesigning the multi-step flow.
- **Deferred to separate tasks:** Global changes to `DialogContent` / `DialogFooter` defaults for every dialog in the app (only mention if a one-line shared improvement is clearly safe after validation).

## Context & Research

### Relevant Code and Patterns

- **`src/app/components/figma/BulkImportDialog.tsx`** — Bulk flow; step `'select-folders'` renders the toolbar (`flex justify-between`), `ScrollArea` with `label.flex > Checkbox + icon + span.truncate`, and `DialogFooter` with outline + brand buttons. `DialogContent` uses `className="sm:max-w-lg"`.
- **`src/app/components/ui/dialog.tsx`** — `DialogContent` is a **CSS grid** with `p-6`, `w-full`, `max-w-[calc(100%-2rem)]`, `sm:max-w-lg`. Close control is **`absolute top-3 right-3`** with a large hit target (`size-11`), so header text without trailing padding can crowd the control.
- **`src/app/pages/Courses.tsx`** — Hosts `BulkImportDialog`.
- **Institutional pattern (see `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md`):** Flex children that must shrink for truncation or wrapping need **`min-w-0`** (and often **`flex-1`**) so `truncate` / `line-clamp` work; long user- or import-derived strings should use **`break-words`** / **`[overflow-wrap:anywhere]`** when wrapping is preferred over ellipsis.

### Institutional Learnings

- Treat folder and course names like other user-sourced strings: constrain width with **`min-w-0`** on the flex child that holds the label so the modal does not grow horizontally.

### External References

- None required — standard CSS flex overflow behavior and existing in-repo dialog patterns.

## Key Technical Decisions

- **Prefer local fixes in `BulkImportDialog.tsx` first** so behavior is verified for this dense stepper UI before considering global `DialogHeader` / `DialogFooter` changes.
- **Folder list rows:** Give the text column **`flex-1 min-w-0`**; keep **`truncate`** on a single line for scanability, or switch to **`line-clamp-2`** plus `break-words` if product prefers seeing more of long names without hover — default recommendation stays **single-line truncate** for consistency with scanning/review lists.
- **Header:** Add trailing padding on **`DialogHeader`** (or a wrapper) so title/description clear the **`absolute`** close button — e.g. `pr-10` / `pr-12` tuned to match `dialog.tsx` close position.
- **Toolbar row (`Deselect All` + count):** Use **`gap-2`**, **`min-w-0`** on the flex container, and ensure the meta string can **`shrink-0`** with **`text-right`** or **`whitespace-nowrap`** only if the **list width** is constrained first; if count still collides on very narrow viewports, allow **`flex-wrap`**.
- **Footer:** On the `select-folders` and `review` steps, extend **`DialogFooter`** with **`w-full max-w-full flex-wrap gap-2 sm:justify-end`** (or equivalent) so paired buttons wrap instead of overflowing; optionally **`[&>button]:sm:flex-initial`** / full-width primary on **`max-sm`** if design wants stacked full-width CTAs on small screens.
- **`DialogContent`:** If grid children still overflow after flex fixes, add **`overflow-x-hidden`** and/or **`min-w-0`** on this instance only — verify focus rings and scroll behavior are not clipped.

## Open Questions

### Resolved During Planning

- **Should we change global `dialog.tsx`?** **No for MVP** — fix bulk dialog first; revisit global header padding only if many modals share the same crowding (see Scope Boundaries).

### Deferred to Implementation

- **Truncate vs. two-line clamp for folder names:** Implementer chooses after quick visual check; default single-line truncate.

## Implementation Units

- [x] **Unit 1: Constrain flex layout for folder selection and header spacing**

**Goal:** Stop horizontal expansion and clipping from long folder names and the absolute close control.

**Requirements:** R1, R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/BulkImportDialog.tsx`

**Approach:**
- On the **`select-folders`** toolbar row, add spacing and **`min-w-0`** as needed so left and right controls do not force overflow.
- On each folder **`label`**, add **`w-full`**, **`min-w-0`**, and wrap the name in a **`flex-1 min-w-0`** container with **`truncate`** (and optional **`text-left`**). If the **`ScrollArea`** inner wrapper still expands the grid, add **`min-w-0`** to that column wrapper as well.
- On **`DialogHeader`** for this dialog (or per-step when titles differ), add **`className`** with right padding to clear the close button.

**Patterns to follow:**
- `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md` (`min-w-0` on flex children).

**Test scenarios:**
- **Happy path:** Open bulk import, reach folder selection with **short** folder names — toolbar and list align; no horizontal scrollbar on the dialog.
- **Edge case:** Mock or use fixtures with **very long** folder names (wider than modal) — names ellipsis or wrap per chosen strategy; **no** clipping of “N of M selected” when the list is constrained.
- **Edge case:** Narrow viewport width — footer buttons **wrap or stack** without overlapping the dialog border.

**Verification:** Manual/visual check on Courses page for `select-folders` matching screenshot report; DevTools confirm no horizontal overflow on `DialogContent` for long names.

- [x] **Unit 2: Footer and dialog shell containment for all steps with actions**

**Goal:** Keep “Back” / primary actions inside padded dialog bounds at all breakpoints.

**Requirements:** R2, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/BulkImportDialog.tsx`

**Approach:**
- For **`DialogFooter`** instances in this file (`select-folders`, `review`, `results`), apply **`w-full max-w-full`**, **`flex-wrap`**, and consistent **`gap-2`**; adjust button **`className`** only if required (e.g. **`basis-full sm:basis-auto`** for primary on xs).
- If overflow persists, add **`overflow-x-hidden`** and/or **`min-w-0`** on this dialog’s **`DialogContent`** `className` merge.

**Patterns to follow:**
- Existing `DialogFooter` in `src/app/components/ui/dialog.tsx` (`flex-col-reverse` on small screens).

**Test scenarios:**
- **Happy path:** `select-folders` with **4+** selections — “Scan N Folders” fits inside dialog at **`sm` width.
- **Edge case:** **`review`** step — “ Import N Courses” footer behaves like folder step (no overflow).
- **Edge case:** **`results`** — “Done” remains contained.

**Verification:** Visual pass on each step with footer; resize window across breakpoints.

- [ ] **Unit 3: Optional regression test scaffolding**

**Execution status:** Skipped for this PR — primary verification is manual QA (Unit 1–2). Optional RTL test can be added later if desired.

**Goal:** Guard layout contract if the team wants automated coverage.

**Requirements:** R4

**Dependencies:** Unit 1–2 (after classes stabilize)

**Files:**
- Create: `src/app/components/figma/__tests__/BulkImportDialog.test.tsx` *(optional — only if implementer can inject step state or extract a presentational subcomponent without heavy mocking)*
- Modify: `src/app/pages/__tests__/Courses.test.tsx` — **no change required** unless a small exported helper is tested instead; **`BulkImportDialog` stays mocked** there.

**Approach:** If full step navigation is too heavy, skip automated tests and rely on **Verification** in Units 1–2; otherwise render a thin **presentational** fragment (folder list + footer) with props for folder names and assert presence of **`min-w-0`** / structure via **`data-testid`**.

**Test scenarios:**
- **Test expectation: none — primary verification is visual/layout** unless Unit 3 is executed; then add one RTL case with long folder name string asserting accessible labels still render.

**Verification:** Tests pass locally if added; otherwise document “manual QA only” in PR.

## System-Wide Impact

- **Interaction graph:** Only `BulkImportDialog` UI; `Courses` usage unchanged.
- **Error propagation:** None.
- **State lifecycle risks:** None.
- **API surface parity:** N/A.
- **Unchanged invariants:** Import pipeline, Zustand stores, and `courseImport` APIs unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `overflow-x-hidden` clips focus rings or dropdowns | Prefer flex/`min-w-0` fixes first; add overflow only if needed; verify keyboard focus outline. |
| Global dialog change accidentally affects other modals | Defer global `dialog.tsx` edits unless justified and regression-tested. |

## Documentation / Operational Notes

- None required; optional one-line note in PR for QA: bulk import folder selection at narrow widths and long folder names.

## Sources & References

- Code: `src/app/components/figma/BulkImportDialog.tsx`, `src/app/components/ui/dialog.tsx`, `src/app/pages/Courses.tsx`
- Learnings: `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md`

---

## Confidence check (Phase 5.3)

**Depth:** Lightweight. **Risk:** Low (presentation only). **Thin local grounding override:** Not applicable — patterns are well established in-repo.

**Result:** Confidence check passed — no deepening pass required. `document-review` not run as a sub-skill in this session; implementer may run `document-review` on this file for an extra coherence pass before execution.
