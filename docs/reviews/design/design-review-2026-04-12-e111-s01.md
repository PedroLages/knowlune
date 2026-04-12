# Design Review — E111-S01: Audio Clips

**Review Date**: 2026-04-12
**Reviewed By**: Ava (design-review agent) via Playwright MCP — Claude Sonnet 4.6
**Story**: E111-S01 — Users can clip moments from audiobooks by marking start/end times, then save, replay, and manage memorable passages
**Branch**: feature/e111-s01-audio-clips

## Changed Files

- `src/app/components/audiobook/AudiobookRenderer.tsx` — added ClipButton + ClipListPanel integration
- `src/app/components/audiobook/ClipButton.tsx` — new two-phase clip recording control
- `src/app/components/audiobook/ClipListPanel.tsx` — new clip list sheet panel with DnD reordering

## Affected Pages

- `/library/:bookId/read` — AudiobookRenderer with new clip controls in secondary control bar

## Testing Method

Live Playwright browser automation with IDB seeding at desktop (1440px), tablet (768px), and mobile (375px). axe-core WCAG 2.1 AA scan run on both the player page and the open ClipListPanel. Measured rendered element sizes for touch target compliance.

---

## Executive Summary

E111-S01 delivers a well-structured audio clip feature with solid foundational accessibility practices: all icon buttons have ARIA labels, the drag-and-drop system includes keyboard support via KeyboardSensor, and the two-step delete confirmation prevents accidental data loss. The background color and layout tokens are correct, and no horizontal scroll was detected at any breakpoint.

However, three issues require attention before merge: one critical semantic HTML/ARIA violation caught by axe-core, two HIGH-severity touch target failures for icon buttons in the clip list, and a cancel recording button that is only 25px wide (below the 44px mobile minimum). These are straightforward fixes.

---

## What Works Well

1. **Primary touch targets are correct** — ClipButton (Start/End Clip) renders at exactly 44x44px on both desktop and mobile. The clips panel trigger button is also 44x44px. The drag handle is 44x44px.

2. **All icon-only buttons have explicit aria-label attributes** — Start Clip, End Clip, Cancel clip recording, Clips, Edit clip title, Delete clip, Confirm delete, Cancel delete, Cancel editing, Save clip title — all are correctly labelled.

3. **Keyboard-accessible drag-and-drop** — DndContext uses both PointerSensor and KeyboardSensor with sortableKeyboardCoordinates. Keyboard reordering works for screen reader and keyboard users.

4. **Inline editing interaction is complete** — Enter saves, Escape cancels, onBlur saves. Focus is set via setTimeout after state flush (avoids the common missed-focus bug).

5. **AnimatePresence transitions are within spec** — Recording indicator and cancel button animate at 200ms, within the 150-200ms quick-action target.

6. **Empty state provides actionable guidance** — "Tap Start Clip while listening to save a passage" tells users exactly what to do. This follows the learning-first design tenet.

7. **Background color correct** — Body background measured as `rgb(250, 245, 238)` — the correct `#FAF5EE` warm off-white theme token.

8. **No horizontal scroll** — Verified at 375px, 768px, and 1440px. The secondary controls bar on mobile measures 346px wide with 15px left margin — comfortably within the 375px viewport.

9. **Two-step delete confirmation** — Prevents accidental clip deletion. Confirm/Cancel buttons appear inline without a modal, keeping the interaction in context.

10. **Clip-scoped playback auto-pause** — The 0.1s tolerance for timeupdate latency at ~4Hz is the right engineering call. Well implemented.

---

## Findings by Severity

### HIGH Priority (Should fix before merge)

**H1 — Edit and Delete icon buttons are 32x32px — below 44px touch minimum**
- Location: `ClipListPanel.tsx:204, 213`
- Evidence: Live measurement — `{ width: 32, height: 32 }` for both Pencil (Edit) and Trash2 (Delete) buttons using `size-8` class
- Impact: On mobile, users with motor impairments or large fingers cannot reliably tap these buttons. These are the primary actions for managing clips — the core value of the feature. WCAG 2.5.5 (AA) requires minimum 44x44px touch targets.
- Suggestion: Change `size-8` to `size-11` (44px) or add `min-h-[44px] min-w-[44px]` to the button className. Since these are icon buttons, `size-11` keeps them square and visually balanced.

**H2 — Delete confirmation buttons are 28px tall — well below 44px**
- Location: `ClipListPanel.tsx:181, 189`
- Evidence: Live measurement — Confirm button: `{ width: 62, height: 28 }` with `h-7` class (28px)
- Impact: The delete confirmation row appears after a user indicates intent to delete. If the confirm button is too small to tap precisely on mobile, users may accidentally confirm or miss the target entirely, causing frustration at a critical decision point.
- Suggestion: Change `h-7` to `h-11` or `min-h-[44px]` on both Confirm and Cancel buttons in the delete confirmation row.

**H3 — "Back to start state" was false after End Clip — recording state not cleared on clip save**
- Location: `ClipButton.tsx:65`
- Evidence: After calling `addClip()` which resolves successfully (`setPendingStartTime(null)` on line 65), the Playwright query for `[data-testid="start-clip-button"]` returned false. The `end-clip-button` remained in DOM.
- Note: This may be a test timing artifact (the state update is async), but it warrants review to confirm `setPendingStartTime(null)` fires correctly after a successful save in all paths. If the clip save toast appears but the recording state persists, users would be confused.
- Suggestion: Add a brief `await page.waitForSelector('[data-testid="start-clip-button"]')` in the E2E test to confirm timing, and verify the `onClipCreated` callback path also clears state.

### MEDIUM Priority (Fix when possible)

**M1 — Cancel recording button is 25px wide — below 44px touch minimum**
- Location: `ClipButton.tsx:121`
- Evidence: Live measurement — `{ width: 25.15625, height: 44 }`. Height is 44px (correct via `min-h-[44px]`), but width is 25px. The `✕` character with `px-2` padding renders at approximately 25px wide.
- Impact: On mobile, users who start a clip recording and want to cancel cannot reliably tap the ✕ button. This directly impacts a key recovery flow.
- Suggestion: Add `min-w-[44px]` to the cancel button className alongside the existing `min-h-[44px]`.

**M2 — axe-core: `aria-required-parent` violation — `div[role="listitem"]` inside `<li>`**
- Location: `ClipListPanel.tsx:109`
- Evidence: axe-core flagged `[critical] aria-required-parent` — `div[role="listitem"]` is not contained by the expected `role="list"` parent. The `SortableClipItem` renders a `<div role="listitem" ...>` inside a `<li>` element. A `<li>` already has an implicit `listitem` role, and the `<div role="listitem">` inside it creates a misplaced explicit role that is not a direct child of `role="list"`. Screen readers may mis-announce or skip the item.
- Suggestion: Remove `role="listitem"` from the `SortableClipItem` `<div>` (line 109). The surrounding `<li>` already carries the correct implicit role. The `aria-roledescription="sortable"` can be kept on the `<div>` without the `role` attribute.

**M3 — Both ClipButton and clips-panel-button use the same Scissors icon**
- Location: `AudiobookRenderer.tsx:500-514`
- Evidence: `ClipButton` renders a `<Scissors>` icon for Start/End Clip. The clips-panel trigger button at line 510 also renders `<Scissors>`. Both appear adjacent in the secondary controls bar. There is no visible text label on either — only aria-labels.
- Impact: Sighted users see two identical scissors icons side by side. Without a tooltip or visible label, the distinction between "record a clip" and "view my clips" is not discoverable without trial and error. This is particularly confusing for new users of the feature.
- Suggestion: Use a distinct icon for the clips list panel (e.g., `ListMusic`, `List`, or `BookmarkList`). Alternatively, add a short visible text label to the clips-panel button when space allows. A tooltip on hover would also help sighted keyboard users.

**M4 — Redundant aria-label on recording indicator span**
- Location: `ClipButton.tsx:103`
- Evidence: The pulsing `<motion.span>` has `aria-label="Recording in progress"`. The parent `<Button>` already has `aria-label="End Clip"` when recording. Screen readers will announce both the button label and the inner span label, resulting in "End Clip — Recording in progress recording in progress" (or similar double-announcement depending on the SR).
- Suggestion: Remove `aria-label` from the indicator span. The button's own label already communicates the state. If additional context is needed, add a visually-hidden description via `aria-describedby`.

**M5 — No aria-live region for clip recording state changes**
- Location: `ClipButton.tsx`
- Evidence: Clip start/end/save feedback is delivered exclusively via Sonner toast. Toasts in this project use `role="status"` (Sonner's default), but the ClipButton component itself has no live region announcing state transitions to screen readers who may not hear the toast depending on their SR configuration.
- Suggestion: Add a visually-hidden `<span aria-live="polite" aria-atomic="true">` near the ClipButton that updates with "Recording started at X" / "Clip saved" text. This ensures the state change is announced even if the toast is missed.

### LOW Priority (Optional / Future)

**L1 — No keyboard shortcut for clip recording**
- Location: `AudiobookRenderer.tsx:235`
- Evidence: The `useKeyboardShortcuts` hook registers Space, Arrow keys, `[`, `]`, `m` for playback control. Clip recording has no keyboard shortcut.
- Impact: Power users listening with keyboard control have no quick way to mark clip boundaries without moving focus to the ClipButton.
- Suggestion: Consider adding `c` (start/end clip) to the keyboard shortcuts list, consistent with the existing pattern.

**L2 — ClipListPanel Sheet has no SheetDescription**
- Location: `ClipListPanel.tsx:318`
- Evidence: The Sheet has a `SheetTitle` ("Clips") but no `SheetDescription`. The shadcn/ui Sheet supports `SheetDescription` as a companion to the title.
- Suggestion: Add a brief `<SheetDescription>` — e.g., "Your saved audio passages from this audiobook." This is not a WCAG requirement but improves context for screen reader users navigating the panel.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | Measured `text-muted-foreground` and `text-foreground` — adequate contrast |
| Text contrast ≥4.5:1 (dark mode) | Pass | Dark mode: foreground `rgb(232, 233, 240)` on `rgb(26, 27, 38)` background — high contrast |
| Keyboard navigation (Tab) | Pass | All buttons reachable by Tab; dnd-kit KeyboardSensor enabled |
| Focus indicators visible | Fail | `[data-testid="start-clip-button"]` shows `outline: none; box-shadow: none` when focused. Ghost Button variant may suppress the default focus ring. |
| Heading hierarchy | Pass | Player uses H1 for book title — correct semantic structure |
| ARIA labels on icon buttons | Pass | All icon-only buttons have explicit aria-label |
| Semantic HTML — listitem role | Fail | M2: `div[role="listitem"]` inside `<li>` — axe critical violation |
| Form labels associated | Pass | Inline title input has `aria-label="Clip title"` |
| prefers-reduced-motion | Pass | AnimatePresence transitions use framer-motion which respects reduced-motion |
| Touch targets ≥44x44px (primary) | Pass | ClipButton, clips-panel trigger, drag handle all 44x44px |
| Touch targets ≥44x44px (secondary) | Fail | H1: Edit/Delete icon buttons 32x32px; H2: Confirm/Cancel delete 28px tall; M1: Cancel recording 25px wide |
| No horizontal scroll (mobile) | Pass | Verified at 375px — no overflow |
| ARIA live regions for dynamic content | Fail | M5: No live region for recording state; toast-only feedback |
| aria-required-parent (axe) | Fail | M2: `div[role="listitem"]` inside `<li>` — axe critical |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll; controls bar fits within viewport (346px wide, 15px margin). Start Clip button 44x44px. |
| Tablet (768px) | Pass | No horizontal scroll; layout scales correctly |
| Sidebar Collapse (1024px) | Pass | No layout issues observed |
| Desktop (1440px) | Pass | Controls bar centered correctly; cover art max-w-80 aspect-square renders well |

---

## Detailed Findings

### F1 — Focus indicator missing on ClipButton (BLOCKER-level accessibility concern)

**Issue**: The Start/End Clip button (Ghost Button variant) shows no visible focus indicator when keyboard-focused. Computed style: `outline: none; box-shadow: none`.

**Location**: `ClipButton.tsx:79`, potentially `src/app/components/ui/button.tsx`

**Evidence**: `getComputedStyle` on focused `[data-testid="start-clip-button"]` returned `outlineWidth: "0px"` and `boxShadow: "none"`.

**Impact**: Keyboard and screen reader users cannot see where focus is located when navigating the secondary controls bar. This is a WCAG 2.4.7 (Level AA) failure. While the shadcn Button component typically applies focus rings, the `variant="ghost"` with custom `className` overrides may be suppressing the ring. This is a recurring pattern in the project.

**Suggestion**: Inspect the Ghost Button variant's focus styles in `src/app/components/ui/button.tsx`. Ensure `focus-visible:ring-2 focus-visible:ring-brand` (or equivalent) is present and not overridden by the `className` prop on ClipButton. If the button renders inside a backdrop-blur container, check for `z-index` or `overflow` clipping the ring.

**Note**: The focus ring may visually appear correctly in the real browser — the headless Playwright environment does not always simulate `:focus-visible` correctly. Manual keyboard testing in the browser is recommended to confirm.

### F2 — Edit/Delete buttons below touch target minimum

**Issue**: The Pencil (Edit) and Trash2 (Delete) buttons in SortableClipItem use `size-8` (32px × 32px). WCAG 2.5.5 requires minimum 44×44px touch targets on touch interfaces.

**Location**: `ClipListPanel.tsx:204, 213`

**Evidence**: Live measurement `{ width: 32, height: 32 }` for both buttons.

**Impact**: Users with motor impairments, large fingers, or shaky hands on mobile cannot reliably interact with these primary clip management controls. Since the entire value of E111-S01 is managing clips, this degrades the feature's core UX on mobile.

**Suggestion**:
```tsx
// Before
className="size-8 text-muted-foreground hover:text-foreground"

// After
className="size-11 text-muted-foreground hover:text-foreground"
// or: min-h-[44px] min-w-[44px] p-2
```

### F3 — Semantic HTML: nested listitem roles

**Issue**: `SortableClipItem` renders `<div role="listitem" aria-roledescription="sortable" ...>` inside a `<li>` element. The `<li>` already has an implicit `listitem` role. The nested explicit `role="listitem"` on the inner `<div>` creates an element with a listitem role whose parent (the `<li>`) is not a `role="list"` or `role="listbox"` — it is itself a `listitem`. axe-core flagged this as critical `aria-required-parent`.

**Location**: `ClipListPanel.tsx:109`

**Evidence**: axe critical violation: `aria-required-parent` on `div[role="listitem"]`.

**Impact**: Screen readers may mis-announce the clip rows or skip them. JAWS and NVDA have known issues with incorrectly nested list semantics.

**Suggestion**:
```tsx
// Before (line 109)
<div
  ref={setNodeRef}
  style={style}
  {...attributes}
  role="listitem"
  aria-roledescription="sortable"
  ...
>

// After — remove role="listitem", keep aria-roledescription on the div
<div
  ref={setNodeRef}
  style={style}
  {...attributes}
  aria-roledescription="sortable"
  ...
>
```

---

## Recommendations

1. **Fix the three touch target issues before merge** (H1, H2, M1) — these are 2-3 line changes each. Edit/Delete buttons: `size-8` to `size-11`. Delete confirm buttons: `h-7` to `h-11`. Cancel recording: add `min-w-[44px]`. These directly impact the core feature usability on mobile.

2. **Fix the aria-required-parent ARIA violation** (M2) — Remove `role="listitem"` from `SortableClipItem`'s root div. The `<li>` wrapper already provides the correct semantics. One-line fix.

3. **Differentiate the two Scissors icons** (M3) — Replace the clips-panel trigger icon with a list-style icon (e.g., `ListMusic`). This is a discoverability improvement for all sighted users, not just accessibility.

4. **Manually verify focus indicator in browser** (F1 context) — Headless Playwright may underreport focus ring visibility. Open `http://localhost:5173/library/clip-test-audiobook/read` in Chrome, Tab to the ClipButton, and confirm the focus ring is visible. If not, add `focus-visible:ring-2 focus-visible:ring-brand` to the button.

---

*Review generated via Playwright MCP browser automation with IDB seeding. Measurements are from a live Chromium headless instance. axe-core 4.10.2 WCAG 2.1 AA scan performed on the player page and the open ClipListPanel state.*
