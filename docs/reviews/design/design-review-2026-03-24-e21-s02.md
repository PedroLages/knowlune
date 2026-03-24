# Design Review Report — E21-S02: Enhanced Video Keyboard Shortcuts

**Review Date**: 2026-03-24
**Reviewed By**: Claude Code (design-review agent via Playwright automated testing)
**Story**: E21-S02 — Enhanced Video Keyboard Shortcuts
**Branch**: feature/e21-s02-enhanced-video-keyboard-shortcuts

## Changed Files

- `src/app/components/figma/VideoPlayer.tsx` — Added `stepPlaybackSpeed()`, `<` / `>` cases, `n` case, `onFocusNotes` prop
- `src/app/components/figma/VideoShortcutsOverlay.tsx` — Added `< / >` to `playbackShortcuts`, `N` to `notesShortcuts`
- `src/app/pages/LessonPlayer.tsx` — Added `handleFocusNotes` callback with `pendingNoteFocus` deferred focus pattern

## Affected Routes

`/courses/operative-six/op6-introduction` (LessonPlayer + VideoPlayer)

---

## Executive Summary

E21-S02 extends the existing keyboard shortcut system with three new bindings: `<` / `>` for playback speed stepping and `N` to open and focus the notes panel. The implementation is clean — it slots into the existing `handleKeyDown` switch, reuses the established ARIA live region pattern, and wires the deferred-focus pattern correctly for panel-open-then-focus scenarios. All 17 ATDD tests pass. One medium-priority UX issue was found in the shortcuts overlay (the `+` separator between `<` and `>` implies a chord rather than alternative keys), and one pre-existing low-priority finding is noted (the mobile overlay clipping is not introduced by this story).

---

## What Works Well

**1. ARIA live region announcements are correct and consistent.** Pressing `>` announces "Speed changed to 1.25x", boundary presses announce "Already at maximum/minimum speed", and the `role="status" aria-live="polite" aria-atomic="true"` region is properly scoped outside the video container so screen readers pick it up independently of focus location.

**2. The input guard is sound.** The existing `isInputFocused` check (guarding against INPUT, TEXTAREA, SELECT, and `isContentEditable`) correctly prevents `n` from firing when the user is typing in the TipTap editor. The `contenteditable` case is the most important one here and is handled.

**3. The `n` case intentionally omits `containerRef.current?.focus()` after `onFocusNotes?.()`.** Every other shortcut (j, l, m, space, <, >) refocuses the player container after acting. The `n` case does not — focus goes to the editor and stays there. This precisely matches AC2 ("the editor receives focus") without inadvertently returning focus to the player.

**4. The `pendingNoteFocus` deferred-focus pattern handles the panel-open timing correctly.** When the panel is closed, pressing `N` sets `notesOpen = true` and `pendingNoteFocus = true`. A `useEffect` fires once `notesOpen` becomes `true` and dispatches `requestAnimationFrame(() => editor?.focus())`. This two-frame deferral gives React time to mount the TipTap editor before focus is attempted. Live test confirmed: `Editor visible: true  Editor focused: true`.

**5. Overlay ARIA structure is complete.** The dialog has `role="dialog"`, `aria-modal="true"`, `aria-labelledby="shortcuts-title"`, the title `<h3 id="shortcuts-title">` exists, and the close button has `aria-label="Close shortcuts"`. Focus moves to the dialog `<div>` on open and Tab cycles to the close button. Escape closes without returning a visible focus ring trap.

**6. The two-column layout holds at desktop and tablet.** At 1440px and 768px the grid renders as two columns (`sm:grid-cols-2`). The playback column width at tablet was measured at 216px — readable and well-proportioned. The `N` entry appears under the "NOTES" section header in the right column with appropriate visual hierarchy.

**7. No horizontal scroll introduced on mobile.** `document.documentElement.scrollWidth > document.documentElement.clientWidth` returned `false` at 375px.

---

## Findings by Severity

### Blockers
None.

### High Priority
None.

### Medium Priority

**M1 — `< + >` separator implies a chord, not alternative keys**

- **Location**: `src/app/components/figma/VideoShortcutsOverlay.tsx:55`
- **Evidence**: Screenshot `03a-overlay-playback-column.png` shows the Speed down/up row renders as `< + >`. The `ShortcutRow` component uses `+` as the separator between all entries in the `keys` array (line 55: `{i > 0 && <span className="text-xs text-white/50">+</span>}`). This separator is designed for chords (`Alt + T` means press both simultaneously). For `< / >`, the two keys are opposites — pressing `>` increases speed and `<` decreases it. The `+` connector implies "press both at once", which would be physically impossible with shift-based keys and is semantically incorrect.
- **Impact**: A learner discovering keyboard shortcuts may be confused about whether `< >` is a two-key combination or two separate shortcuts. This undermines the discoverability goal of the shortcuts overlay.
- **Suggestion**: Use a `/` or `|` separator for alternative keys. The description already says "Speed down/up" — matching the separator character to `/` would reinforce this. One approach: add an optional `separator` field to `ShortcutEntry` (defaulting to `+`) and pass `separator: '/'` for this entry. Alternatively, render the two entries as separate rows ("Speed down" / "Speed up") which would also align the overlay style with YouTube's approach.

### Nitpicks

**N1 — `document.querySelector('[contenteditable="true"]')` is a fragile selector**

- **Location**: `src/app/pages/LessonPlayer.tsx:505` and `:515`
- **Evidence**: `handleFocusNotes` uses `document.querySelector('[contenteditable="true"]')` to find the TipTap editor. This is the first matching `contenteditable` element in the DOM.
- **Impact**: If a future component adds another `contenteditable` before the notes editor in DOM order (e.g., an inline-editable course title), this selector would focus the wrong element. The risk is currently low since TipTap is the only `contenteditable` on this page.
- **Suggestion**: Attach a `ref` to the `NoteEditor` component and expose a `focus()` imperative handle via `useImperativeHandle`. This removes the DOM query entirely and makes the focus target explicit. The `VideoPlayerHandle` pattern already in this codebase (lines 59-62 of `VideoPlayer.tsx`) is a clean model to follow.

**N2 — Pre-existing: mobile overlay is clipped to video player height**

- **Location**: `src/app/components/figma/VideoShortcutsOverlay.tsx:83` — `className="absolute inset-0 ..."`
- **Evidence**: At 375px the overlay `boundingBox` was `{ x: 24, y: 160, width: 316, height: 177.75 }` — matching the video element height. `innerScrollHeight: 413` vs `innerClientHeight: 178` — the content is 2.3x taller than the visible area and there is no scroll (`overflow: visible`). The inner container starts at `y: -75` (above the visible overlay area), meaning the title and top entries are cut off.
- **Impact**: On a physical mobile device, a learner pressing `?` to discover shortcuts would see a partial, non-scrollable, visually broken overlay that hides most of the shortcut list. This is a pre-existing issue not introduced by E21-S02 (introduced in E02-S07). The E21-S02 changes add two more rows, making the existing overflow slightly worse.
- **Suggestion**: This should be addressed in a follow-on story. The fix is to change the overlay from `absolute` to `fixed` positioning (or render it via a portal), and add `overflow-y-auto` with a max-height. Since this is pre-existing, it should not block this merge, but should be tracked.

---

## Detailed Findings

### Finding M1: `< + >` chord-style separator for alternative keys

**Issue**: The `ShortcutRow` component renders `+` between all keys in the `keys` array. The `< / >` entry passes `keys: ['<', '>']`, which renders as the kbd sequence `[<] + [>]` — the same visual pattern as `[Alt] + [T]`. These are not chord keys; they are independent, directional shortcuts.

**Location**: `src/app/components/figma/VideoShortcutsOverlay.tsx:55`

**Evidence**: Screenshot `03a-overlay-playback-column.png` clearly shows `< + >` in the Speed down/up row.

**Impact**: Keyboard shortcut overlays are a power-user discoverability feature. Incorrect notation teaches learners a wrong mental model — they may attempt to hold both keys simultaneously and wonder why it doesn't work, or avoid using the shortcuts entirely.

**Suggestion**:
```tsx
// Option A — add separator to ShortcutEntry interface
interface ShortcutEntry {
  keys: string[]
  description: string
  separator?: '+' | '/' | '|'  // defaults to '+'
}

// In ShortcutRow:
{i > 0 && <span className="text-xs text-white/50">{shortcut.separator ?? '+'}</span>}

// Usage:
{ keys: ['<', '>'], description: 'Speed down/up', separator: '/' }
```

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 | Pass | Kbd elements: white text on `rgba(255,255,255,0.2)` against dark overlay — contrast sufficient. Description text is `text-white/80` on `bg-black/80` — passes. |
| Keyboard navigation | Pass | Tab cycles from dialog → close button. Escape closes overlay. `<`, `>`, `n` shortcuts fire correctly after player focus. |
| Focus indicators visible | Pass | Dialog container receives focus on open. Close button has visible Radix-default focus ring. |
| Heading hierarchy | Pass | Overlay uses `<h3>` (within video section, appropriate level). Column headers use `<p>` with uppercase styling — acceptable since they are not navigational headings. |
| ARIA labels on icon buttons | Pass | Close button has `aria-label="Close shortcuts"`. |
| Semantic HTML | Pass | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="shortcuts-title"` all present. |
| ARIA live region | Pass | `role="status" aria-live="polite" aria-atomic="true"` exists. Speed change announcements confirmed live. Boundary messages confirmed live. |
| Input guard for N shortcut | Pass | `isContentEditable` check in guard prevents N firing in TipTap editor. |
| prefers-reduced-motion | Pass | VideoPlayer respects `prefers-reduced-motion` via existing `motion-reduce:transition-none` utilities. No new animations introduced by this story. |
| Focus not trapped after N | Pass | Live test confirmed Tab moves focus away from editor after N focuses it. |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Desktop (1440px) | Pass | Two-column grid renders correctly. `< + >` and `N` entries visible. Overall overlay proportions are good. Screenshot: `02-overlay-desktop.png`, `03a-overlay-playback-column.png`, `03b-overlay-controls-column.png`. |
| Tablet (768px) | Pass | Two-column grid holds at `sm:grid-cols-2`. Playback column 216px wide — readable. Overlay fits within viewport. Screenshot: `10-tablet-overlay.png`. |
| Mobile (375px) | Pre-existing Fail | Overlay is clipped to video player height (177px) while content is 413px tall. No scrollbar. Top entries and title are cropped. Pre-existing issue from E02-S07, not introduced by E21-S02. Screenshot: `mobile-overlay-viewport.png`. |

---

## Recommendations

1. **Fix the `< + >` separator (Medium priority, small change).** Add a `separator` prop to `ShortcutEntry` and pass `separator: '/'` for the `< / >` entry. This is a 3-line change that meaningfully improves shortcut discoverability.

2. **Create a follow-on story for the mobile overlay (pre-existing).** The clipping at 375px makes the overlay unusable on mobile. The fix — `position: fixed` + `overflow-y-auto` with a max-height or a React portal — is straightforward but crosses the boundary of this story's scope.

3. **Consider a `NoteEditor` imperative ref for focus (Nitpick, low urgency).** Replace the `document.querySelector('[contenteditable="true"]')` pattern with an explicit ref to future-proof the focus target. Use the existing `VideoPlayerHandle` pattern as a model.

4. **No blocking issues found.** All AC requirements are functionally verified: speed stepping with boundary announcements (AC1), notes panel open + editor focus via N key (AC2), overlay shows `< / >` and `N` entries (AC3), ARIA live region and focus management are correct (AC4). The story is ready to merge with the medium-priority separator fix tracked or addressed before merge.
