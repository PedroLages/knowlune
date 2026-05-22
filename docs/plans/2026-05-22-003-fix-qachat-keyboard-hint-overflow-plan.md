---
title: "Fix QAChatPanel keyboard hint overflowing outside panel"
type: fix
status: active
date: 2026-05-22
related: docs/plans/2026-05-22-002-fix-qachat-panel-ux-rag-polish-plan.md
---

# Fix QAChatPanel keyboard hint overflowing outside panel

## Overview

The Ask AI popover shows the keyboard shortcut helper ("Press Enter to send, Shift + Enter for new line") below the dark panel background, overlapping the lesson content underneath. This is a flex height accounting bug in the panel shell, not a problem with the hint copy itself.

## Problem Frame

In the desktop `Popover` layout (`h-[600px] w-[400px]`), the footer input block and its helper text are structurally part of `chatContent`, but the column is sized with `h-full` while a separate header row also consumes height. The combined content exceeds the popover viewport; without `overflow-hidden` on the shell, the helper line renders outside the popover's `bg-popover` background.

Screenshot evidence: helper text visible on the page background below the rounded panel bottom edge.

## Requirements Trace

- R1. The keyboard shortcut hint is fully inside the Ask AI panel background on desktop popover (400×600)
- R2. The input row and hint remain visible and not clipped when the message list is long (messages scroll; footer stays pinned)
- R3. Mobile `Sheet` layout (`h-[90vh]`) shows the same pinned footer behavior
- R4. Hint styling stays consistent with `ChatInput` (muted text, `kbd` pills) — layout fix only, no copy change

## Scope Boundaries

- `src/app/components/figma/QAChatPanel.tsx` layout only
- Test files: `src/app/components/figma/__tests__/QAChatPanel.test.tsx`, new `tests/e2e/regression/qa-chat-panel-layout.spec.ts`
- No changes to RAG, query classifier, citations, or `ChatInput` adoption (covered in `docs/plans/2026-05-22-002-fix-qachat-panel-ux-rag-polish-plan.md`)
- No backend or settings/auth work
- Replacing inline textarea with shared `ChatInput` is out of scope for this plan (optional follow-up in plan 002 Unit 4)

### Deferred to Separate Tasks

- Full scroll-clipping and sentinel-based auto-scroll improvements: `docs/plans/2026-05-22-002-fix-qachat-panel-ux-rag-polish-plan.md` Unit 2

## Context & Research

### Relevant Code and Patterns

- `src/app/components/figma/QAChatPanel.tsx`
  - `chatContent` root: `flex h-full flex-col` (line ~289) — **primary bug**: `h-full` as sibling of header inflates past popover height
  - Messages: `min-h-0 flex-1` + `ScrollArea` (line ~356) — scroll region is mostly correct
  - Input footer: `border-t p-4` + hint `<p className="mt-2 text-xs text-muted-foreground">` (lines ~489–548) — not `shrink-0`
  - Banner blocks (checking, unavailable, no notes, error): not `shrink-0` — must match design contract
  - Desktop shell: `PopoverContent className="h-[600px] w-[400px] p-0"` + inner `flex h-full flex-col` with header + `{chatContent}` (lines ~615–648)
  - Mobile shell: `SheetContent side="bottom" className="h-[90vh]"` + `SheetHeader` + `{chatContent}` (lines ~579–601) — missing flex column + `min-h-0 overflow-hidden` chain
- `src/app/components/chat/ChatInput.tsx` — reference footer pattern: outer `border-t bg-background p-4`, hint in centered `text-xs text-muted-foreground mt-2` block inside the footer stack (works on full-page `/notes/chat` because parent height is not double-counted)
- `src/app/components/ui/popover.tsx` — default `PopoverContent` has no `overflow-hidden`
- `tests/e2e/regression/story-e07-s04.spec.ts` — bounding-box non-overlap assertion pattern for layout regressions

### Institutional Learnings

- `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md` — flex panels need `min-h-0` on scroll children; QAChatPanel scroll fixes targeted the message viewport, not the shell/footer height chain
- `docs/plans/2026-05-22-002-fix-qachat-panel-ux-rag-polish-plan.md` Unit 2 — related scroll work; does not explicitly fix `h-full` + header stacking or footer overflow

### External References

- None required — established flex overflow pattern in this codebase

## Key Technical Decisions

- **Use `flex-1 min-h-0` instead of `h-full` on `chatContent`:** When `chatContent` is a flex child below a fixed header, it must grow into remaining space, not claim 100% of the parent height. `(see origin: flex column overflow patterns in docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md)`
- **Pin footer with `shrink-0`:** Input + hint block must not compress when the message list grows; only the `flex-1` scroll region shrinks.
- **Pin banners with `shrink-0`:** All state/error banner wrappers inside `chatContent` must not shrink — only the message `ScrollArea` wrapper absorbs height pressure.
- **Contain overflow on the shell:** Add `overflow-hidden` to `PopoverContent` / inner column so any transient overflow cannot paint outside the popover background. Prefer fixing flex sizing first; overflow hidden is a safety net.
- **Mobile Sheet requires explicit flex chain:** `SheetContent` must be `flex flex-col overflow-hidden min-h-0` (keep `h-[90vh]`); `SheetHeader` gets `shrink-0`; `chatContent` gets the same `flex-1 min-h-0` contract as desktop. Do not rely on visual verification alone.
- **Keep inline footer markup for this fix:** Adopting `ChatInput` is a larger UX change (send button layout, width). This plan fixes the layout contract so the existing hint stays inside the panel.

## Open Questions

### Resolved During Planning

- **Is the hint absolutely positioned?** No — it is a normal `<p>` after the textarea row. Overflow is from column height, not positioning.
- **Does mobile Sheet have the same bug?** Yes (same `chatContent` + `h-full` + header). Apply the same flex contract to both shells.
- **Does `SheetContent` need explicit flex classes?** Yes — add `flex flex-col overflow-hidden min-h-0` to `SheetContent`, `shrink-0` on `SheetHeader`, and `flex-1 min-h-0 overflow-hidden` on `chatContent` (Unit 1).

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
PopoverContent / SheetContent (fixed height, flex flex-col overflow-hidden min-h-0)
├── Header row                    shrink-0
└── chatContent                   flex-1 min-h-0 flex flex-col overflow-hidden
    ├── banners / errors          shrink-0  ← add class to each banner wrapper
    ├── ScrollArea wrapper        flex-1 min-h-0
    └── input + keyboard hint     shrink-0
```

## Acceptance Criteria & Verification Matrix

| Req | What "done" means | Automated | Manual (only if automation blocked) |
|-----|-------------------|-----------|-------------------------------------|
| R1 | Hint fully inside panel background on desktop 400×600 | Playwright: hint `boundingBox()` bottom ≤ popover content bottom (Unit 3) | Open Ask AI on lesson player; hint sits on `bg-popover`, not lesson content below |
| R2 | Long message list scrolls; footer + hint pinned and visible | Playwright: seed many messages, scroll to top, assert hint + input still visible and inside shell (Unit 3) | Scroll long chat; footer stays at bottom inside panel |
| R3 | Mobile Sheet (`90vh`) same pinned footer behavior | Playwright: viewport 375×812, open Sheet, repeat R1 bounding-box check (Unit 3) | Repeat R1/R2 checks on phone-width viewport |
| R4 | Hint copy and token styling unchanged | Vitest: hint text + `kbd` presence (Unit 2) | N/A |

**Test layering:** Vitest asserts hint presence/copy and stable selectors only — it cannot detect visual overflow. Playwright bounding-box checks are the authoritative automated gate for R1–R3.

## Implementation Units

- [ ] **Unit 1: Fix flex height chain for chatContent (desktop + mobile)**

**Goal:** `chatContent` occupies only the remaining height below the header so the footer (including the hint) stays inside the panel on both popover and sheet.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/QAChatPanel.tsx`

**Approach:**
- Change `chatContent` root from `flex h-full flex-col` to `flex min-h-0 flex-1 flex-col overflow-hidden`
- Add `shrink-0` to every banner/state block inside `chatContent`:
  - AI checking block (~line 292)
  - Unavailable warning block (~line 305)
  - No-notes info block (~line 323)
  - `declinedProvider` wrapper (~line 337)
  - Active error block (~line 344)
- Mark input footer container (`border-t p-4`) as `shrink-0`
- **Desktop popover:** inner wrapper `flex h-full flex-col overflow-hidden`; header row `shrink-0`; add `overflow-hidden` to `PopoverContent` className
- **Mobile sheet (explicit — not deferred):**
  - `SheetContent`: `className="flex h-[90vh] flex-col overflow-hidden min-h-0 p-0"` (preserve side/bottom behavior; adjust padding if sheet default padding conflicts)
  - `SheetHeader`: add `shrink-0` (keep existing `mb-4` or move spacing into header)
  - `{chatContent}`: receives same `flex-1 min-h-0` contract as desktop sibling

**Patterns to follow:**
- `MessageList.tsx` / plan 002 Unit 2 — `min-h-0 flex-1` on scroll region (already present on messages wrapper; keep it)
- Sidebar/content panels in `src/app/components/ui/sidebar.tsx` — `min-h-0 flex-1` for scrollable flex children

**Verification:**
- Desktop popover at 400×600: hint text sits on `bg-popover` background, flush above bottom rounded corner
- Long chat history: scroll messages; footer stays pinned; hint never overlaps lesson content below panel
- Mobile 375×812: sheet opens; hint inside sheet background at bottom

---

- [ ] **Unit 2: Test hooks and Vitest presence checks**

**Goal:** Stable selectors and fast unit coverage for hint copy/presence — not layout overflow.

**Requirements:** R4 (primary); supports R1–R3 E2E selectors

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/QAChatPanel.tsx`
- Modify: `src/app/components/figma/__tests__/QAChatPanel.test.tsx`

**Approach:**
- Add `data-testid="qa-panel-keyboard-hint"` on the hint `<p>`
- Add `data-testid="qa-panel-shell"` on the shared inner column wrapper (popover inner `div` and sheet content area that wraps header + `chatContent`) for Playwright bounding-box queries
- Optional: align hint classes with `ChatInput` (`px` on `kbd`, `text-center` only if it fits at 400px width — prefer left-aligned to match current panel)

**Vitest scenarios (copy/presence only — no overflow claims):**
- Open panel — `getByTestId('qa-panel-keyboard-hint')` is in the document and contains "Enter" and "Shift"
- Hint renders `kbd` elements for both shortcuts
- `getByTestId('qa-panel-input')` and hint coexist when panel is open and AI available

**Do not add:** Vitest assertions that hint is a DOM descendant of popover content as a proxy for "no overflow" — that passes even when the hint paints outside the panel background.

**Verification:**
- `npm run test -- src/app/components/figma/__tests__/QAChatPanel.test.tsx` passes

---

- [ ] **Unit 3: Playwright layout regression (R1–R3)**

**Goal:** Automated bounding-box and scroll/pin checks for visual layout requirements.

**Requirements:** R1, R2, R3

**Dependencies:** Units 1–2

**Files:**
- Create: `tests/e2e/regression/qa-chat-panel-layout.spec.ts`

**Approach:**
- Reuse lesson-player seed pattern from `tests/e2e/regression/lesson-player-course-detail.spec.ts` (course + note + Gemini QA config)
- Helper: `assertHintInsideShell(page)` — compare `qa-panel-keyboard-hint` and `qa-panel-shell` (or `[data-slot="popover-content"]` / sheet content locator) bounding boxes; hint bottom must be ≤ shell bottom (with 1px tolerance) and hint top ≥ shell top
- **R1 test (desktop):** default viewport, open Ask AI, run bounding-box helper
- **R2 test (pinned footer):** seed 20+ messages into `useQAChatStore` via page evaluate or IndexedDB if store persists; open panel; scroll message area to top; assert input + hint visible and inside shell; assert scroll container `scrollTop > 0`
- **R3 test (mobile sheet):** `page.setViewportSize({ width: 375, height: 812 })`; open Ask AI; assert sheet dialog visible; run same bounding-box helper against sheet shell

**Patterns to follow:**
- `tests/e2e/regression/story-e07-s04.spec.ts` — bounding-box non-overlap assertions
- `tests/e2e/regression/lesson-player-course-detail.spec.ts` — Ask AI open + seed setup

**Verification:**
- `npx playwright test tests/e2e/regression/qa-chat-panel-layout.spec.ts` passes
- If R2 store seeding is flaky in CI, document the seed approach in the spec and keep manual R2 steps below as backup — do not leave R2 untested without either automation or explicit manual gate

---

## Manual Verification Checklist (release gate)

Run only if Playwright spec cannot be added or a specific test is skipped in CI:

1. **R1 — Desktop overflow:** Lesson player → open Ask AI → keyboard hint fully on panel background, not on lesson content below rounded edge.
2. **R2 — Pinned footer:** Paste or generate 15+ Q&A turns → scroll to oldest message → input row and hint remain visible at bottom inside panel; no clipping of hint text.
3. **R3 — Mobile sheet:** DevTools 375×812 → open Ask AI → sheet layout → repeat R1 and R2 checks inside sheet.
4. **R4 — Styling:** Hint still muted `text-xs`, `kbd` pills unchanged; no copy edits.

## System-Wide Impact

- **Interaction graph:** Only `QAChatPanel` popover/sheet layout; trigger button and store unchanged
- **Error propagation:** N/A — presentational layout
- **State lifecycle risks:** None — no persistence changes
- **API surface parity:** N/A
- **Integration coverage:** Playwright bounding-box specs for R1–R3; Vitest for R4 hint presence
- **Unchanged invariants:** Keyboard behavior (Enter send, Shift+Enter newline), RAG pipeline, message rendering

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `overflow-hidden` clips focused textarea ring | Use overflow on outer shell only; keep input padding; verify focus ring visible in manual R4 pass |
| Sheet layout differs from popover | Apply same flex contract to both code paths sharing `chatContent`; explicit SheetContent classes in Unit 1 |
| Plan 002 Unit 2 lands concurrently with conflicting flex edits | Merge flex rules: `chatContent` uses `flex-1 min-h-0`; scroll child keeps `min-h-0 flex-1` |
| R2 E2E seeding many messages is brittle | Prefer `useQAChatStore` injection via `page.evaluate`; fall back to manual R2 checklist |

## Documentation / Operational Notes

- If plan 002 Unit 2 is implemented later, keep this flex contract — do not reintroduce `h-full` on `chatContent`
- Consider adding a one-line note to `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md` after fix ships

## Sources & References

- **Related plan:** [docs/plans/2026-05-22-002-fix-qachat-panel-ux-rag-polish-plan.md](docs/plans/2026-05-22-002-fix-qachat-panel-ux-rag-polish-plan.md)
- Related code: `src/app/components/figma/QAChatPanel.tsx`, `src/app/components/chat/ChatInput.tsx`
- Learning: `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md`
- E2E patterns: `tests/e2e/regression/story-e07-s04.spec.ts`, `tests/e2e/regression/lesson-player-course-detail.spec.ts`
- Screenshot: user report 2026-05-22 (Ask AI popover, hint below panel edge)
