# Web Design Guidelines Review - E21-S02 "Enhanced Video Keyboard Shortcuts"

**Date:** 2026-03-24
**Reviewer:** Claude (automated)
**Files Reviewed:**
- `src/app/components/figma/VideoPlayer.tsx`
- `src/app/components/figma/VideoShortcutsOverlay.tsx`
- `src/app/pages/LessonPlayer.tsx`

---

## Summary

This story adds three new keyboard shortcuts to the video player: `<`/`>` for stepping playback speed down/up, and `N` to focus the notes editor. The overlay documentation in `VideoShortcutsOverlay.tsx` is updated accordingly. The implementation follows the established patterns well -- consistent `e.preventDefault()`, proper input-field guards, and screen reader announcements for speed changes via the existing `announce()` helper. A few minor issues were found.

**Verdict:** 0 BLOCKER, 0 HIGH, 1 MEDIUM, 3 LOW

---

## MEDIUM

### M1. Ambiguous key separator in shortcuts overlay for `<` / `>` entry

**File:** `src/app/components/figma/VideoShortcutsOverlay.tsx:23`

The `ShortcutRow` component uses `+` as separator between keys in the `keys` array (line 55). For entries like `{ keys: ['Alt', 'T'] }`, the `+` correctly indicates a key combination. However, for `{ keys: ['<', '>'] }` it renders as `< + >`, which visually implies pressing both keys simultaneously rather than pressing them independently.

This ambiguity also exists for pre-existing entries (`Space + K` for Play/Pause, `Arrow Up + Arrow Down` for Volume), but the new `< + >` entry makes it more confusing since `<` and `>` are Shift-modified keys on the same physical key (comma/period), making simultaneous press physically impossible.

**Recommendation:** Introduce a `separator` property on `ShortcutEntry` (defaulting to `+`) so combo-style entries use `+` and alternative-key entries use `/` or "or". For example: `< / >` for "Speed down/up" and `Space / K` for "Play/Pause".

**Note:** The ambiguity is pre-existing in the overlay design but is amplified by this new entry.

---

## LOW

### L1. No screen reader announcement when `N` focuses notes editor

**File:** `src/app/components/figma/VideoPlayer.tsx:608-611`

The `<` and `>` shortcuts correctly announce speed changes via `announce()` (inherited from `changePlaybackSpeed`). The `N` shortcut moves focus to the notes editor but does not produce a screen reader announcement. While the focus move itself is perceivable, an announcement like "Notes editor focused" would help screen reader users understand the context switch, especially when the notes panel was previously closed and opens as a side effect.

**Recommendation:** Add `announce('Notes editor focused')` or have `handleFocusNotes` in `LessonPlayer.tsx` set an aria-live announcement after opening the panel.

### L2. Generic `document.querySelector` selector for notes editor focus

**File:** `src/app/pages/LessonPlayer.tsx:504-506, 514-515`

The focus logic uses `document.querySelector('[contenteditable="true"]')` to find the TipTap editor. This is fragile -- if another `contenteditable` element exists on the page (e.g., a future inline-edit field), the wrong element could receive focus.

```typescript
const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
editor?.focus()
```

**Recommendation:** Scope the query to the notes panel container using a ref or a more specific data-attribute selector such as `[data-testid="notes-editor"] [contenteditable="true"]`.

### L3. Hardcoded colors in `Kbd` component (pre-existing)

**File:** `src/app/components/figma/VideoShortcutsOverlay.tsx:42`

The `Kbd` component uses hardcoded `bg-white/20`, `border-white/30`, and `text-white` classes. These are used on the semi-transparent dark overlay so they are contextually appropriate, but they bypass the design token system and would not adapt if the overlay background changed.

**Note:** Pre-existing issue, not introduced by this story. Low priority since the overlay has a fixed dark backdrop.

---

## Passing Checks

The following web design guideline areas were reviewed and found compliant:

- **Keyboard accessibility:** All new shortcuts fire globally (YouTube-style), are correctly guarded by the `isInputFocused` check (prevents firing when typing in inputs/textareas/contenteditable), and are blocked when modifier keys are held (Cmd/Ctrl/Alt). The `<`/`>` keys correctly refocus the player container after action.
- **Screen reader support:** Speed changes announce via the existing `aria-live="polite"` region. Boundary conditions ("Already at maximum/minimum speed") are also announced.
- **Focus management:** The `N` shortcut correctly handles two states -- (1) panel already open: focuses editor via `requestAnimationFrame`, (2) panel closed: opens panel, sets `pendingNoteFocus` flag, and a `useEffect` focuses the editor after mount. This avoids race conditions with React state updates.
- **Design tokens:** No new hardcoded colors introduced by this story.
- **Overlay accessibility:** The shortcuts overlay uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `tabIndex={-1}` with auto-focus on open. Escape key closes the overlay correctly.
- **Semantic HTML:** `<kbd>` elements used appropriately for keyboard key display.
- **Touch target sizes:** Close button on overlay is `size-11` (44x44px), meeting the 44x44px minimum.
- **Responsive design:** Overlay grid uses `grid-cols-1 sm:grid-cols-2` for mobile/desktop adaptation.
