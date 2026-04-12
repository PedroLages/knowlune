# Design Review Report — E111-S01: Audio Clips

**Review Date**: 2026-04-12
**Reviewed By**: Ava (design-review agent, Claude Sonnet 4.6 via Playwright MCP)
**Changed Files**:
- `src/app/components/audiobook/ClipButton.tsx` (NEW)
- `src/app/components/audiobook/ClipListPanel.tsx` (NEW)
- `src/app/components/audiobook/AudiobookRenderer.tsx` (integration)

**Affected Pages**: `/library/:bookId/read` (AudiobookRenderer)
**Test Book**: The Intelligent Investor Rev Ed. (`021013bb-d31a-447d-98ac-4334484cd4dd`)
**Viewports Tested**: 390px (mobile), 768px (tablet), 1440px (desktop)
**Color Mode Tested**: Dark mode (vibrant, spacious)

---

## Executive Summary

E111-S01 adds a two-phase audio clip recording control (`ClipButton`) and a sortable clip list sheet panel (`ClipListPanel`) to the audiobook player. The implementation is well-structured, uses the correct design tokens, and meets touch-target requirements for all primary controls. Two focused issues were found: a sub-44px cancel button touch target and a missing `SheetDescription` that triggers a Radix UI console warning on every panel open. Both are quick fixes.

---

## What Works Well

- **Two-phase recording UX is clear and intuitive**: The transition from "Start Clip" to "End Clip" with the pulsing red indicator (`animate-pulse bg-destructive`) immediately communicates recording state. The pattern matches the existing `BookmarkButton` AnimatePresence approach for visual consistency.
- **Touch targets meet requirements on primary controls**: `ClipButton` (44x44px), Clips panel trigger (44x44px), and all `SortableClipItem` play/drag buttons meet the 44px minimum.
- **Empty state messaging is helpful**: "No clips yet. Tap 'Start Clip' while listening to save a passage." is actionable guidance — exactly right for a first-run state.
- **Keyboard accessibility is solid**: Escape closes the Sheet panel; the `ClipButton` uses the shadcn `Button` component with its built-in `focus-visible:ring-[3px]` focus ring; all interactive elements have `aria-label` attributes.
- **ARIA structure is well-considered**: `<ul role="list" aria-label="Audio clips">` with `<li>` wrappers and inner `role="listitem" aria-roledescription="sortable"` is correct for a sortable list.
- **Heading hierarchy is correct**: H1 (book title) → H2 ("Clips" in SheetTitle) — no skipped levels.
- **Design token compliance**: No hardcoded colors detected. `bg-destructive`, `text-muted-foreground`, `text-foreground`, `border-border`, `text-brand`, `text-success` are all used correctly. The drag overlay uses `bg-card` and `border-brand/30` — both token-compliant.
- **Responsive behavior**: No horizontal overflow at any tested viewport. The Sheet panel takes full width on mobile (390px) and collapses to `sm:max-w-md` (448px) on larger viewports — correct behavior.
- **Dark mode**: All tested elements render correctly in dark mode with sufficient contrast (muted foreground text measured at 8.41:1 on panel background).
- **Contrast passes**: `text-muted-foreground` (`rgb(178,181,200)`) on panel background (`rgb(26,27,38)`) = 8.41:1, well above the 4.5:1 AA threshold.

---

## Findings by Severity

### High Priority (Should fix before merge)

**H1 — Cancel recording button touch target is 25x44px (below 44x44px minimum)**
- **Location**: `ClipButton.tsx:119–129`
- **Evidence**: Measured at runtime: `width=25px, height=44px` at all tested viewports (390px, 768px, 1440px)
- **Root cause**: `size="sm"` + `px-2` only provides `h-8` base height (overridden to 44px by `min-h-[44px]`), but the width is driven by content ("✕" character + padding) and resolves to ~25px. The `min-w-[44px]` constraint is not applied to the cancel button.
- **Impact**: On touch devices, users trying to cancel a clip recording will frequently miss the tap target, potentially triggering the End Clip button or neighbouring controls instead. This is a learner-facing frustration point during time-sensitive clip recording.
- **Suggestion**: Add `min-w-[44px]` to the cancel button's className: `className="min-h-[44px] min-w-[44px] px-2 text-xs text-muted-foreground hover:text-destructive"`

### Medium Priority (Fix when possible)

**M1 — Missing `SheetDescription` in ClipListPanel causes Radix UI console warning**
- **Location**: `ClipListPanel.tsx:319–325` (SheetHeader block)
- **Evidence**: Console warning: `"Warning: Missing Description or aria-describedby={undefined} for {DialogContent}"` — fires each time the Clips panel is opened. `AudiobookSettingsPanel.tsx:65–67` shows the correct pattern with `<SheetDescription>`.
- **Impact**: The warning signals that screen reader users receive no sheet description, reducing context for assistive technology. It also pollutes the console, which increases noise during debugging.
- **Suggestion**: Add a visually hidden `SheetDescription` following the same pattern as `AudiobookSettingsPanel`:
  ```tsx
  import { SheetDescription } from '@/app/components/ui/sheet'
  // Inside SheetHeader:
  <SheetDescription className="sr-only">
    Saved audio clips for this book. Tap a clip to play it, or drag to reorder.
  </SheetDescription>
  ```

**M2 — "Clips" panel trigger button uses raw `<button>` without project focus ring pattern**
- **Location**: `AudiobookRenderer.tsx:508–515`
- **Evidence**: The Clips panel trigger `<button>` has className `"flex items-center justify-center rounded-full min-h-[44px] min-w-[44px] px-3 text-muted-foreground hover:text-foreground transition-colors"` with no `focus-visible:` utilities. It falls back to the browser-default outline (a semi-transparent ring) rather than the project's branded `focus-visible:ring-[3px] focus-visible:ring-ring/50` from the shadcn Button component.
- **Impact**: Minor visual inconsistency with all other secondary controls (SpeedControl, BookmarkButton, SleepTimer) which use the shadcn Button with consistent focus rings. Learners using keyboard navigation see an inconsistent focus indicator on this one control.
- **Suggestion**: Either wrap in `<Button variant="ghost" size="sm" className="...">` like `ClipButton` does, or add explicit focus utilities: `focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`.

### Nitpicks (Optional)

**N1 — The pulsing recording indicator has `aria-label="Recording in progress"` on a `<span>` inside the button**
- **Location**: `ClipButton.tsx:104`
- **Evidence**: The span is `aria-hidden` is NOT set — so screen readers may announce "Recording in progress" as separate text within the button, in addition to the button's own `aria-label="End Clip"`. The button label already communicates state; the indicator `aria-label` is redundant.
- **Suggestion**: Add `aria-hidden="true"` to the indicator span: `<motion.span ... aria-hidden="true">`. State is already communicated by the button's `aria-label` transition from "Start Clip" to "End Clip".

**N2 — `setTimeout(() => inputRef.current?.focus(), 50)` in `handleEditStart`**
- **Location**: `ClipListPanel.tsx:79`
- **Note**: The 50ms hard-wait for focus-after-state-flush is a minor anti-pattern (the project lint rule flags `waitForTimeout` in tests, but this is production code). A `useEffect` or `flushSync` approach would be more deterministic. Low risk in practice.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (dark mode) | Pass | Muted text: 8.41:1 on panel bg |
| Text contrast ≥4.5:1 (light mode) | Not tested | Page loaded in dark mode only |
| Keyboard navigation | Pass | Tab/Enter/Escape all work correctly |
| Focus indicators visible | Pass (mostly) | ClipButton uses shadcn ring; Clips trigger uses browser default (M2) |
| Heading hierarchy | Pass | H1 book title → H2 "Clips" |
| ARIA labels on icon buttons | Pass | All clip-related buttons have `aria-label` |
| Semantic HTML | Pass | `<ul>/<li>` for list, `<button>` for all interactive elements |
| Form labels associated | Pass | Title input has `aria-label="Clip title"` |
| Touch targets ≥44px | Partial | ClipButton + Clips trigger: pass; Cancel button: 25px wide (H1) |
| SheetDescription for screen readers | Fail | Missing from ClipListPanel (M1) |
| `aria-roledescription="sortable"` on list items | Pass | Correct usage for DnD sortable |
| `prefers-reduced-motion` | Pass | Framer Motion handles this at library level |
| No console errors from story code | Pass | 429 errors are pre-existing ABS sync issue; warning is from missing SheetDescription (M1) |

---

## Responsive Design Verification

- **Mobile (390px)**: Pass — No horizontal scroll. Controls bar 375px wide, all buttons 44x44px (except cancel, 25x44px). Sheet panel full-width.
- **Tablet (768px)**: Pass — No horizontal scroll. Controls bar 346px wide, all 6 child controls fully visible.
- **Desktop (1440px)**: Pass — Controls bar 346px wide, no overflow, all elements properly spaced.

---

## Recommendations

1. **Fix cancel button width (H1)** — Add `min-w-[44px]` to the cancel button. Single-line change, immediate touch UX improvement.
2. **Add SheetDescription (M1)** — Copy the `AudiobookSettingsPanel` pattern. Eliminates console warning and improves screen reader context.
3. **Align Clips trigger focus ring (M2)** — Refactor the raw `<button>` to use shadcn `Button variant="ghost"` for visual consistency with sibling controls.
4. **Remove redundant aria-label from recording indicator (N1)** — Add `aria-hidden="true"` to the pulsing span; button label already announces state.

