---
title: "fix: Notes panel toolbar overflow + viewport height containment"
type: fix
status: active
date: 2026-05-23
origin: user-reported-screenshot-2026-05-23
---

# fix: Notes panel toolbar overflow + viewport height containment

## Overview

The desktop Notes side panel on the lesson player (`/courses/:id/lessons/:lessonId`) has two layout bugs: (1) **Add Timestamp** and **Download** toolbar buttons overlap horizontally in narrow panel widths, and (2) the editor body extends past the bottom of the viewport instead of scrolling internally. This plan fixes both via toolbar grouping + `NotesPanel` root class cleanup, without changing below-video, mobile, or tablet note-taking surfaces.

## Problem Frame

**Bug 1 — Toolbar horizontal overlap:** When the learner opens the Notes side panel, the `NoteEditor` toolbar is rendered in **compact + fillHeight** mode inside a resizable column (~25–40% viewport width). The toolbar uses `flex-wrap` but trailing action buttons use competing `ml-auto` margins instead of a grouped cluster. In the constrained column width, **Add Timestamp** and **Download** collide horizontally and visually stack over the ProseMirror placeholder.

**Bug 2 — Viewport height overflow:** `NotesPanel` root element carries `sticky top-0 self-start` classes, a copy-paste from the desktop sidebar pattern (line 693 of `UnifiedLessonPlayer.tsx`). The sidebar legitimately needs sticky positioning because it lives in a scroll container (`#main-content`). But `NotesPanel` lives inside a `ResizablePanel` within a flex row — there is no scroll ancestor where sticky behavior applies. The `position: sticky` changes the height resolution context, letting `h-full` resolve past the `max-h-[calc(100svh-3rem)]` bound, so the editor body bleeds ~1–2rem below the viewport.

Both bugs are regressions from the fill-height panel work (`docs/plans/2026-05-23-002-feat-notes-panel-fill-height-plan.md`), which correctly pinned the toolbar vertically but explicitly deferred horizontal toolbar geometry and did not audit the root element's positioning classes.

## Requirements Trace

- R1. **No horizontal overlap** — Add Timestamp and Download bounding boxes must not intersect at any resizable panel width (min 25% through default 40%).
- R2. **No vertical bleed or viewport overflow** — Toolbar bottom edge must sit above the editor body top edge; the entire NotesPanel (toolbar + editor + status bar) must fit within the viewport without any part extending below `100svh`. Editor body scrolls internally via `flex-1 min-h-0 overflow-y-auto`.
- R3. **Preserve fill-height behavior** — Toolbar stays pinned while editor body scrolls (existing E2E-6a contract).
- R4. **Preserve accessibility** — Toolbar buttons keep `aria-label`s and ≥44px touch targets (`h-11` / `size-11`).
- R5. **Preserve consumer parity** — Below-video `NotesTab`, mobile `FloatingNotesPanel`, and non-`fillHeight` editors remain unchanged unless the shared toolbar grouping improves all compact layouts equally.

## Scope Boundaries

- Fix toolbar layout in `NoteEditor` for compact side-panel usage; no product behavior changes to timestamp insertion, download export, or autosave.
- No redesign of toolbar information architecture (e.g., moving Add Timestamp to the status bar) — that is a separate UX iteration.
- Remove `sticky top-0 self-start` from `NotesPanel` root element (copy-paste from sidebar pattern; harmful inside ResizablePanel).
- No changes to `UnifiedLessonPlayer` resizable wiring, TipTap extensions, or the `NotesPanel` flex chain structure.

### Deferred to Separate Tasks

- Design review M1 follow-up (move Add Timestamp to status bar for cleaner single-row toolbar): future UX polish if grouping alone is insufficient at smallest widths.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/notes/NoteEditor.tsx` — toolbar root (`flex-wrap`), trailing Capture / Add Timestamp / Download buttons with split `ml-auto`
- `src/app/components/course/tabs/NotesTab.tsx` — always passes `compact`; passes `fillHeight` from desktop panel
- `src/app/components/course/NotesPanel.tsx` — desktop shell with `fillHeight`
- `src/app/pages/UnifiedLessonPlayer.tsx` — `ResizablePanel` host div `h-full min-h-0 flex flex-col`
- `src/app/components/reader/TtsControlBar.tsx` — trailing action cluster pattern: `ml-auto flex shrink-0 items-center gap-2`

**Current toolbar classes (problem area):**

```tsx
// Toolbar root — compact disables sm:flex-nowrap sm:overflow-x-auto
'flex items-center gap-1 px-4 py-2 border-b ... flex-wrap'
!compact && 'sm:flex-nowrap sm:overflow-x-auto'

// Trailing actions — split ml-auto, not grouped
Capture: '... ml-auto'
Add Timestamp: cn('...', !onCaptureFrame && 'ml-auto')
Download: no ml-auto, follows Timestamp on same flex row
```

**Call chain (desktop panel):**

`UnifiedLessonPlayer` → `NotesPanel (fillHeight)` → `NotesTab (compact + fillHeight)` → `NoteEditor`

### Institutional Learnings

- `docs/solutions/best-practices/notes-panel-fill-height-flex-chain-2026-05-23.md` — toolbar is pinned chrome (`shrink-0`); only editor body scrolls; acknowledged toolbar wrap risk in compact mode
- `docs/solutions/ui-bugs/qa-chat-panel-keyboard-hint-overflow-flex-layout-2026-05-22.md` — use Playwright `boundingBox()` for layout gates, not DOM ancestry; `shrink-0` on chrome
- `docs/solutions/ui-bugs/reading-goals-modal-layout-2026-05-08.md` — `min-w-0` on flex children in crowded rows; `flex-wrap` + gap for button groups
- `docs/reviews/design/design-review-2026-02-24-E03-S11.md` — prior design review flagged toolbar wrapping in 718px panel; suggested grouped trailing actions or status-bar placement

### External References

- None required — local patterns are sufficient for this CSS layout fix.

## Key Technical Decisions

- **Group trailing actions in one flex item** — Wrap Capture Frame, Add Timestamp, and Download in a single container (`ml-auto flex shrink-0 items-center gap-1`) following `TtsControlBar`. This prevents `ml-auto` from orphaning individual buttons across wrapped rows.
- **Add `min-w-0 w-full` on toolbar root when `compact && fillHeight`** — Allows the toolbar to shrink inside the resizable column without flex default `min-width: auto` preventing proper wrap/scroll behavior.
- **Enable horizontal overflow escape hatch for compact desktop panel** — Apply `overflow-x-auto` (with optional `flex-nowrap` or controlled wrap on inner groups) when `compact && fillHeight` so labeled buttons remain reachable at min panel width without overlapping. Prefer grouped wrap over hiding actions in the overflow menu to preserve discoverability.
- **Geometry-based E2E regression** — Extend `notes-panel-fill-height.spec.ts` with bounding-box assertions (QAChatPanel pattern) rather than relying on class-name unit tests alone.
- **Do not change global `compact` behavior for below-video** — Gate panel-specific overflow classes on `compact && fillHeight` so below-video editor layout is unaffected unless grouping improves both equally.

## Open Questions

### Resolved During Planning

- **Root cause?** Split `ml-auto` on individual trailing buttons + `flex-wrap` in a narrow column without `sm:flex-nowrap` (because `compact` is always true in side panel).
- **Fix in NoteEditor vs NotesPanel?** NoteEditor — the bug is toolbar-internal; panel flex chain is already correct.
- **Move buttons to status bar?** Deferred — higher UX scope; grouping + min-w-0 should resolve the reported overlap first.

### Deferred to Implementation

- **Exact wrap vs scroll threshold** — Whether `compact && fillHeight` needs `flex-nowrap overflow-x-auto` on the toolbar root or only on the trailing cluster depends on visual verification at 1280×800 with panel dragged to minSize (25%). Implementer should choose the minimal diff that passes geometry E2E at min width.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─ note-editor-toolbar (min-w-0 w-full flex flex-wrap shrink-0) ─────────────┐
│  [formatting group]  [lists]  [overflow ▼]     [trailing cluster ml-auto] │
│                                                   ┌──────────────────────┐  │
│                                                   │ 📷 │ 🕐 Add │ ⬇ Down │  │
│                                                   └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
┌─ note-editor-body (flex-1 min-h-0 overflow-y-auto) ───────────────────────┐
│  ProseMirror placeholder / content (never under toolbar)                   │
└────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Group trailing toolbar actions and constrain toolbar width**

**Goal:** Eliminate horizontal overlap between Add Timestamp and Download in the compact fill-height side panel.

**Requirements:** R1, R2, R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/notes/NoteEditor.tsx`

**Approach:**
- Extract trailing actions (Capture Frame, Add Timestamp, Download) into a trailing action cluster wrapper `div` with `data-testid="note-editor-toolbar-actions"` and classes `ml-auto flex shrink-0 items-center gap-1` (mirror `TtsControlBar`).
- Remove per-button `ml-auto` from Capture and Add Timestamp; the cluster owns `ml-auto`.
- When `compact && fillHeight`, add `min-w-0 w-full` to toolbar root; optionally add `overflow-x-auto` on toolbar or allow trailing cluster `flex-wrap` with `gap-y-1` so wrapped rows stay contained within toolbar bounds.
- Ensure toolbar retains `shrink-0` when `fillHeight` (existing behavior).

**Patterns to follow:**
- `src/app/components/reader/TtsControlBar.tsx` — trailing cluster
- `docs/solutions/ui-bugs/reading-goals-modal-layout-2026-05-08.md` — `min-w-0` on crowded flex rows

**Test scenarios:**
- Happy path: Render `NoteEditor` with `compact fillHeight` — trailing action cluster wrapper exists; Capture/Timestamp/Download are descendants of `[data-testid="note-editor-toolbar-actions"]`
- Edge case: Render without `onCaptureFrame` — Timestamp still inside trailing cluster; Download adjacent without overlap classes on individual buttons
- Happy path: Render without `fillHeight` — no panel-specific `min-w-0 w-full` classes applied to toolbar root

**Verification:**
- Manual: Open notes panel at 1280×800, drag resizer to minimum width — no overlap between Timestamp/Download or over placeholder
- Timestamp and Download remain clickable with visible labels

- [ ] **Unit 2: Remove sticky positioning from NotesPanel root**

**Goal:** Fix editor body extending past viewport bottom by removing harmful `sticky top-0 self-start` classes from the NotesPanel root element.

**Requirements:** R2

**Dependencies:** None (independent of Unit 1)

**Files:**
- Modify: `src/app/components/course/NotesPanel.tsx`

**Approach:**
- Remove `sticky top-0 self-start` from the root `<div>` className on line 58. These classes were copy-pasted from the desktop sidebar pattern (`UnifiedLessonPlayer.tsx` line 693) where sticky positioning is correct — the sidebar scrolls with `#main-content`. But `NotesPanel` lives inside a `ResizablePanel` within a flex row, not a scroll container. The `position: sticky` changes the height resolution context and lets `h-full` bleed past `max-h-[calc(100svh-3rem)]`.
- Keep `w-full flex flex-col h-full min-h-0 overflow-hidden` and `max-h-[calc(100svh-...)]` — the flex chain and viewport clamp are already correct; sticky was the interference.
- No structural changes to the inner wrapper, header, or `NotesTab` mounting.

**Test scenarios:**
- Manual: Open notes panel at 1280×800, type enough notes to overflow the editor — status bar (word count + "Saved") remains visible above viewport bottom. Scroll happens inside the editor body, not the page.

**Verification:**
- Visual: at 1280×800, notes panel fully contained within viewport at default (~40%) and min (~25%) panel widths

- [ ] **Unit 3: Unit test toolbar structure for compact fillHeight** (was Unit 2)

**Goal:** Lock the grouped trailing-actions structure so future toolbar edits don't reintroduce split `ml-auto`.

**Requirements:** R1, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/notes/__tests__/NoteEditor.fillHeight.test.tsx`

**Approach:**
- Add test rendering `NoteEditor` with `compact fillHeight`.
- Assert trailing action cluster test id is present and contains Add Timestamp + Download buttons.
- Assert toolbar root includes `min-w-0` when `compact && fillHeight`.
- Assert Timestamp/Download buttons retain `h-11` height classes (R4 accessibility).

**Test scenarios:**
- Happy path: `compact fillHeight` → trailing action cluster contains `[aria-label="Add Timestamp"]` and `[aria-label="Download note as Markdown"]`
- Edge case: `compact` without `fillHeight` (below-video / tablet) → trailing action cluster present; toolbar root does **not** include panel-specific `min-w-0 w-full`
- Edge case: `fillHeight` without `compact` → Vitest-only regression guard (no current production consumer); cluster present, panel-specific classes gated correctly

**Verification:**
- Vitest file passes; no changes to existing fillHeight flex-chain tests

- [ ] **Unit 4: E2E geometry regression for toolbar vs editor body** (was Unit 3)

**Goal:** Prevent recurrence of toolbar buttons overlapping each other or the editor body bleeding past the viewport at narrow panel widths.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `tests/e2e/regression/notes-panel-fill-height.spec.ts`

**Approach:**
- Add helper `assertToolbarActionsContained(page)` using Playwright `boundingBox()` (≤2px tolerance, matching E2E-6a):
  - Timestamp box and Download box do not intersect (intersection area ≤ 0)
  - Both boxes fully inside toolbar box
  - Toolbar bottom ≤ editor body top (or ProseMirror top if body wrapper absent)
- Add helper `assertNotesPanelFitsViewport(page)`:
  - NotesPanel bounding box bottom ≤ `window.innerHeight` (≤2px tolerance) — whole panel visible, no bleed past viewport
- Run both assertions after opening panel at default width (~40%) **and** after dragging resizer to true min width (~25% / ~320px panel — not merely E2E-7's −80px nudge). Assert panel width is at/near min before geometry checks.
- When capture button is visible, include it in non-overlap assertions (extend E2E-6c or add sibling scenario).
- Preserve existing E2E-6a toolbar Y-pinning test unchanged.

**Patterns to follow:**
- `docs/solutions/ui-bugs/qa-chat-panel-keyboard-hint-overflow-flex-layout-2026-05-22.md` — boundingBox layout gates
- Existing `assertEditorFillsPanel` in same spec file

**Test scenarios:**
- Happy path: Panel open at 1280×800 default width — Timestamp/Download non-overlapping, toolbar above editor
- Edge case: After drag handle moves panel to ~25% min width (~320px at 1280 viewport) — same geometry holds; verify panel width before assertions
- Edge case: Capture frame button visible — trailing action cluster buttons (Capture + Timestamp + Download) all non-overlapping inside toolbar
- Integration: E2E-6a still passes — toolbar Y stable when editor body scrolls

**Verification:**
- New E2E tests pass locally at desktop viewport
- E2E-6b (Add Timestamp inserts link) still passes — action remains reachable

## System-Wide Impact

- **Interaction graph:** Toolbar grouping inside `NoteEditor` + root class cleanup in `NotesPanel`; no store, routing, or autosave path changes.
- **Error propagation:** N/A — layout-only.
- **State lifecycle risks:** None.
- **API surface parity:** Below-video `NotesTab` uses `compact` without `fillHeight`; grouped trailing cluster may apply but panel-specific overflow classes must remain gated on `compact && fillHeight`.
- **Integration coverage:** E2E geometry tests prove rendered layout; unit tests prove DOM structure.
- **Unchanged invariants:** Timestamp insertion (`video://` links), Markdown download export, fill-height scroll chain, `pendingNoteFocus` deferred focus, lesson-change panel reset.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Grouping alone insufficient at 25% panel width | Add `overflow-x-auto` on toolbar for `compact && fillHeight`; trailing cluster can scroll horizontally |
| Below-video toolbar layout shifts unexpectedly | Gate panel-specific classes on `compact && fillHeight`; verify E2E-8 below-video height unchanged |
| E2E bounding-box flakiness from sub-pixel rounding | Use ≤2px tolerance (same as E2E-6a toolbar Y check) |
| Capture Frame button increases cluster width | Cluster wraps internally with `gap-y-1`; geometry E2E covers case with capture enabled |

## Documentation / Operational Notes

- After merge, consider adding a one-line cross-reference in `docs/solutions/best-practices/notes-panel-fill-height-flex-chain-2026-05-23.md` noting horizontal toolbar grouping for compact side panel (optional compound doc — not required for fix).

## Sources & References

- **User report:** Screenshot 2026-05-23 — Add Timestamp / Download overlap in Notes side panel
- Related plan: `docs/plans/2026-05-23-002-feat-notes-panel-fill-height-plan.md`
- Related code: `src/app/components/notes/NoteEditor.tsx`, `src/app/components/course/tabs/NotesTab.tsx`
- Design review: `docs/reviews/design/design-review-2026-02-24-E03-S11.md` (M1 toolbar wrapping)
- Pattern: `docs/solutions/ui-bugs/qa-chat-panel-keyboard-hint-overflow-flex-layout-2026-05-22.md`
