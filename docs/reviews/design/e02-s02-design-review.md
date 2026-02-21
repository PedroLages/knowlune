# Design Review Report — E02-S02 Video Playback Controls and Keyboard Shortcuts

**Review Date**: 2026-02-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e02-s02-video-playback-controls-keyboard-shortcuts`
**Changed Files**:
- `src/app/components/figma/VideoPlayer.tsx`
- `src/app/pages/LessonPlayer.tsx`
- `src/app/components/celebrations/CompletionModal.tsx` (inferred from diff context)
- `src/styles/theme.css`
- `tests/e2e/story-e02-s02-video-controls.spec.ts`

**Tested Route**: `/courses/6mx/6mx-welcome-intro` (VideoPlayer + LessonPlayer)
**Viewports Tested**: 1440px (desktop), 768px (tablet), 375px (mobile)

---

## Executive Summary

E02-S02 delivers a solid foundation of video control enhancements: keyboard shortcuts work correctly (Space, Shift+Arrow seek, number-key jump, m/c/f), the 95% auto-completion fires reliably and triggers the CompletionModal celebration, and the ARIA live region pattern for screen reader announcements is well-executed. However, the story introduces several accessibility concerns that need attention before or shortly after merge — most critically, video control buttons sit at 32x32px throughout (well below the 44px minimum), focus management breaks after Escape closes the speed menu, and the "Mark Complete" button lacks an adequate touch target height.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — Video control buttons below touch target minimum (all viewports)**
All bottom-bar control buttons in VideoPlayer are 32x32px (`h-8 w-8`). The caption font-size controls are even smaller at 24x24px (`h-6 w-6`). WCAG 2.5.5 requires 44x44px minimum on touch devices. These buttons are the core interaction surface of the new feature.
- Location: `src/app/components/figma/VideoPlayer.tsx:549, 562, 589, 641, 669, 682, 700`
- Evidence: Measured via `getBoundingClientRect()` at 375px — all returned `{ w: 32, h: 32 }`
- Impact: Learners on mobile/tablet cannot reliably tap play/pause, mute, speed, and the new caption size controls, directly undermining the feature's usability.
- Suggestion: Increase to `h-11 w-11` (44px) for the main controls, or use transparent padding (`p-2`) on the ghost buttons. Caption size buttons can use `h-10 w-10` with a visually smaller icon. The center large Play button at `h-16 w-16` (64px) is correctly sized.

**B2 — "Mark Complete" button touch target is 20px tall**
The lesson-complete toggle `<button>` has no minimum height set — at mobile it measures 98x20px.
- Location: `src/app/pages/LessonPlayer.tsx:224-242`
- Evidence: `getBoundingClientRect()` at 375px → `{ w: 98, h: 20 }`
- Impact: This is the primary completion action for learners. A 20px touch target will cause frequent missed taps, especially during the satisfaction moment of marking a lesson done.
- Suggestion: Add `min-h-[44px] py-2` to the button class, or wrap the icon+text in a properly-sized `<Button>` component variant.

---

### High Priority (Should fix before merge)

**H1 — Focus lost to `<body>` after Escape closes the speed menu**
When the speed menu is open and Escape is pressed, the menu closes but focus falls to `<body>` instead of returning to the speed button. The code at line 346 calls `speedButtonRef.current?.focus()` but this executes inside the keyboard handler, and the menu close happens asynchronously via state. The focus then lands on `<body>`.
- Location: `src/app/components/figma/VideoPlayer.tsx:346-353`
- Evidence: After Escape, `document.activeElement.tagName === 'BODY'` confirmed via evaluation.
- Impact: Keyboard users lose their place in the video controls entirely, violating WCAG 2.4.3 Focus Order. They must Tab all the way back to find their position.
- Suggestion: Move the `speedButtonRef.current?.focus()` call into the state update callback or wrap in a `setTimeout(() => speedButtonRef.current?.focus(), 0)` so it fires after React's state flush closes the menu.

**H2 — Video container border radius is `rounded-2xl` (16px) instead of the card standard `rounded-[24px]`**
The VideoPlayer uses `rounded-2xl` (16px) while the design system specifies `rounded-[24px]` for cards/media containers. The lesson header card below also uses `rounded-2xl`, creating a consistent but sub-standard radius.
- Location: `src/app/components/figma/VideoPlayer.tsx:469`; `src/app/pages/LessonPlayer.tsx:197`
- Evidence: `getComputedStyle(videoContainer).borderRadius === "16px"`
- Impact: Minor visual inconsistency with the design system, but notable since this is the hero element of the lesson page.
- Suggestion: Change `rounded-2xl` to `rounded-[24px]` on the video container outer div. Confirm whether the lesson header card should match.

**H3 — LessonPlayer.tsx uses relative `../` imports instead of `@/` alias**
Lines 4-14 of LessonPlayer.tsx use `../components/...` relative paths. The project convention (CLAUDE.md) and all other files use the `@/` alias.
- Location: `src/app/pages/LessonPlayer.tsx:4-14`
- Evidence: Grep confirms `from '../components/ui/button'`, `from '../components/figma/VideoPlayer'`, etc.
- Impact: Inconsistency with import conventions; relative paths break silently when files are moved. Medium code quality risk.
- Suggestion: Replace all `../components/` with `@/app/components/` and `../components/ui/` with `@/app/components/ui/`.

**H4 — Three React `forwardRef` console errors on every page load**
The Button component is passed via `ref={speedButtonRef}` in VideoPlayer, but `Button` (a shadcn component) does not use `React.forwardRef`. Similarly, `SheetTrigger asChild` and `DialogOverlay` generate forwardRef errors.
- Location: `src/app/components/figma/VideoPlayer.tsx:586` (speedButtonRef on Button)
- Evidence: Console shows 3+ "Function components cannot be given refs" errors on load.
- Impact: These are React warnings (not crashes), but they indicate ref forwarding is broken — `speedButtonRef.current` will always be `null`, meaning focus-return-to-speed-button (B1) can never work even if the timing is fixed. This is a silent functional failure.
- Suggestion: Either wrap the speed `<Button>` in a native `<button>` with ref, or add `React.forwardRef` to the Button component's export.

**H5 — Completion Modal X close button is 16x16px**
The Radix Dialog close button (the X in the corner) renders at 16x16px.
- Location: `src/app/components/celebrations/CompletionModal.tsx` (via `DialogContent` which includes a built-in close button)
- Evidence: `getBoundingClientRect()` on the close button → `{ w: 16, h: 16}`
- Impact: The modal's only keyboard-independent dismiss path has an untappable button on mobile. Learners on touch devices who want to close the celebration modal without continuing must be very precise.
- Suggestion: Override the Radix Dialog close button size in `src/app/components/ui/dialog.tsx` to be at least `h-11 w-11`. The close button is rendered inside `DialogContent`.

---

### Medium Priority (Fix when possible)

**M1 — Hardcoded hex colors in CompletionModal confetti**
Confetti particle colors use hardcoded hex values rather than referencing CSS custom properties.
- Location: `src/app/components/celebrations/CompletionModal.tsx:49, 60, 70`
- Evidence: `colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe']`
- Impact: These values will not respond to theme changes or dark mode variants. If the primary blue ever changes, the confetti will be out of sync.
- Suggestion: Extract into a constant, or reference computed CSS variable values at runtime: `getComputedStyle(document.documentElement).getPropertyValue('--color-blue-600')`.

**M2 — `--caption-font-size` CSS variable applied via inline style**
The caption font size custom property is set via `style={{ '--caption-font-size': ... }}` on the container div.
- Location: `src/app/components/figma/VideoPlayer.tsx:470`
- Evidence: `style={{ '--caption-font-size': \`${captionFontSize / 16}rem\` } as React.CSSProperties}`
- Impact: This is acceptable React/CSS pattern for CSS custom properties, but the design principles discourage `style=` attributes. The actual CSS rule consuming this variable (`::cue` or similar) was not found in the scanned files — verify it exists in `src/styles/index.css` or elsewhere.
- Suggestion: Confirm the `var(--caption-font-size)` consumer exists. If it does, this approach is defensible given CSS custom properties cannot be set via Tailwind utilities. Add a comment explaining why the inline style is necessary here.

**M3 — Emoji in CompletionModal heading titles**
Dialog titles use emoji characters (e.g. "✅ Lesson Completed!", "🎉 Course Completed!").
- Location: `src/app/components/celebrations/CompletionModal.tsx:110-114`
- Evidence: `getTitle()` returns strings with leading emoji.
- Impact: Screen readers announce emoji by their Unicode description ("white heavy check mark Lesson Completed!"), which sounds jarring and verbose. The existing `role="img" aria-label="lesson completion icon"` on the icon above is correct, but the heading emoji is unguarded.
- Suggestion: Wrap each emoji in `<span aria-hidden="true">✅</span>` to suppress its screen reader announcement within the heading text.

**M4 — DialogContent accessibility warning (missing DialogTitle)**
Radix's own runtime warning fires: "`DialogContent` requires a `DialogTitle`". While a `DialogTitle` is present, Radix cannot detect it due to how the component renders.
- Location: `src/app/components/celebrations/CompletionModal.tsx:130`
- Evidence: Console error "DialogContent requires a DialogTitle" at resize
- Impact: Low immediate impact since a title is visually present, but the Radix accessibility check is failing, suggesting the title may not be correctly associated in the ARIA tree in some configurations.
- Suggestion: Verify `DialogHeader` > `DialogTitle` renders directly inside `DialogContent` without intervening wrappers that Radix cannot traverse. Check `src/app/components/ui/dialog.tsx` for the component structure.

**M5 — Speed menu popover background uses theme popover but not the `#FAF5EE` warm background**
The speed menu dropdown uses `bg-popover` which resolves to `oklch(1 0 0)` (white), while the app background is the warm off-white `#FAF5EE`. This is technically correct token usage, but the stark white popover on a dark video overlay looks jarring.
- Location: `src/app/components/figma/VideoPlayer.tsx:609`
- Evidence: `getComputedStyle(menu).backgroundColor === "oklch(1 0 0)"`
- Impact: Minor visual inconsistency — the speed menu visually pops out of the video controls more aggressively than necessary.
- Suggestion: Consider `bg-background` or a semi-transparent dark variant (`bg-zinc-900/95 text-white`) to stay visually anchored within the dark video player theme.

---

### Nitpicks (Optional)

**N1 — Keyboard shortcuts are not discoverable**
The VideoPlayer has no visible tooltip or help indicator to surface available keyboard shortcuts (Space, Shift+Arrow, m, c, f, 0-9).
- Location: `src/app/components/figma/VideoPlayer.tsx`
- Suggestion: A `?` or keyboard icon button (or tooltip on the speed button) that lists shortcuts would substantially improve the feature's discoverability, particularly for the new Shift+Arrow ±10s seeking.

**N2 — `src/app/pages/LessonPlayer.tsx` uses a raw `<button>` for Mark Complete**
The raw `<button>` element at line 224 lacks a `type="button"` attribute. While browsers default to `type="submit"` only inside `<form>`, it is a best practice to be explicit.
- Suggestion: Add `type="button"` to the Mark Complete button.

**N3 — Volume slider hidden on mobile but no alternative**
The volume slider hides at `sm` breakpoint via `hidden sm:block`. On mobile, the only volume control is the mute button. This is acceptable but means mobile learners can't fine-tune volume.
- Suggestion: Consider making the volume slider a long-press or swipe gesture on mobile, or a tap-to-reveal panel — low priority, but worth considering for a future iteration.

---

## What Works Well

1. **Keyboard shortcut implementation is comprehensive and correct**: Space/k for play-pause, Arrow for 5s seek, Shift+Arrow for 10s seek, m/c/f for mute/captions/fullscreen, and 0-9 for jump-to-percentage all work as specified. The scope guard (`containerRef.current?.contains(document.activeElement)`) is smart — shortcuts only fire when the player has focus, preventing interference with the rest of the page.

2. **ARIA live region pattern is excellent**: The `role="status" aria-live="polite" aria-atomic="true"` hidden div with 1-second auto-clear provides clean, non-intrusive screen reader announcements for every player action. This is textbook accessible video player design.

3. **95% auto-completion wiring is clean**: The `hasAutoCompleted` ref (not state) prevents re-firing on re-renders without creating closure issues. The guard `if (!courseId || !lessonId || completed)` in `triggerCompletion` prevents double-firing elegantly.

4. **prefers-reduced-motion is respected in both layers**: `motion-safe:scale-125` in LessonPlayer and the `window.matchMedia('(prefers-reduced-motion: reduce)')` check in `triggerConfetti` both correctly suppress animation for users who prefer it. This dual-layer approach (CSS utility + JavaScript guard) is thorough.

5. **Speed menu keyboard navigation is solid**: Arrow up/down moves through options, Enter/Space selects, focus tracks with `focusedSpeedIndex`, and `aria-current` marks the active item. The `aria-haspopup="menu"` + `aria-expanded` on the trigger button is correct ARIA.

6. **Caption font size control includes disabled state**: The Minus button disables at minimum size and Plus disables at maximum — preventing silent no-op clicks and giving users clear affordance for boundary conditions.

7. **Background color is correct**: `rgb(250, 245, 238)` confirmed matching `#FAF5EE` design token at all viewports. No hardcoded background colors in page-level components.

---

## Detailed Findings Reference

| ID | File | Line(s) | Severity |
|----|------|---------|----------|
| B1 | `VideoPlayer.tsx` | 549, 562, 589, 641, 669, 682, 700 | Blocker |
| B2 | `LessonPlayer.tsx` | 224-242 | Blocker |
| H1 | `VideoPlayer.tsx` | 346-353 | High |
| H2 | `VideoPlayer.tsx` | 469; `LessonPlayer.tsx` 197 | High |
| H3 | `LessonPlayer.tsx` | 4-14 | High |
| H4 | `VideoPlayer.tsx` | 586 | High |
| H5 | `CompletionModal.tsx` | 130 (DialogContent) | High |
| M1 | `CompletionModal.tsx` | 49, 60, 70 | Medium |
| M2 | `VideoPlayer.tsx` | 470 | Medium |
| M3 | `CompletionModal.tsx` | 110-114 | Medium |
| M4 | `CompletionModal.tsx` | 130 | Medium |
| M5 | `VideoPlayer.tsx` | 609 | Medium |
| N1 | `VideoPlayer.tsx` | — | Nitpick |
| N2 | `LessonPlayer.tsx` | 224 | Nitpick |
| N3 | `VideoPlayer.tsx` | 576-578 | Nitpick |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | White text on black/dark overlay is high contrast. Lesson body text on `#FAF5EE` is adequate. |
| Keyboard navigation | Partial | Shortcuts work correctly; focus management broken after Escape (H1); forwardRef prevents speed-button focus return (H4). |
| Focus indicators visible | Pass | All video control buttons have `focus-visible:ring-2 focus-visible:ring-white` — correct for dark background. Main app buttons use default ring. |
| Heading hierarchy | Pass | H1 for lesson title, H3/H4 for sidebar sections. CompletionModal uses H2. Structure is logical. |
| ARIA labels on icon buttons | Pass | All icon-only buttons have descriptive `aria-label`. Dynamic labels (Play/Pause, Mute/Unmute, Enter/Exit fullscreen) toggle correctly. |
| Semantic HTML | Pass | `<button>` elements used throughout (not `<div onClick>`). `role="region"`, `role="menu"`, `role="menuitem"` correctly applied. |
| ARIA live regions | Pass | `role="status" aria-live="polite" aria-atomic="true"` present in VideoPlayer. CompletionModal has a second live region. |
| Form labels associated | N/A | No form inputs in reviewed components. |
| prefers-reduced-motion | Pass | CSS `motion-safe:` modifier on checkmark animation; JS guard on confetti. Both layers covered. |
| Touch targets ≥44x44px | Fail | Video controls 32x32px, caption controls 24x24px, Mark Complete 20px height, modal X close 16x16px. Multiple blockers/high-priority findings. |
| Screen reader dialog | Partial | CompletionModal has good live region, but Radix `DialogTitle` detection warning fires and emoji in heading is unguarded. |

---

## Responsive Design Verification

- **Desktop (1440px)**: Pass — Sidebar lesson list visible (288px wide), video player full width, all controls visible, no horizontal scroll. Volume slider shown.
- **Tablet (768px)**: Pass — Lesson content sidebar correctly hidden (`xl:block` → invisible), no horizontal scroll, volume slider visible (sm:block threshold met at 768px), mobile menu button available.
- **Mobile (375px)**: Partial — No horizontal scroll (pass). Volume slider correctly hidden. Video player renders at 297px width. However, 15 interactive elements fall below 44px touch target (B1, B2, H5 findings).

---

## Recommendations (Prioritized)

1. **Fix touch targets before merge** (B1, B2, H5): Increase all video control buttons from `h-8 w-8` (32px) to `h-11 w-11` (44px), fix the Mark Complete button height, and enlarge the modal close button. This directly impacts the core interaction surface of the story's features.

2. **Fix the forwardRef chain to unlock focus management** (H4 then H1): The `speedButtonRef` on `Button` is silently null, making the Escape→focus-return logic a no-op. Fix the ref (use a native `<button>` wrapper or add forwardRef to Button) and then the Escape focus return needs a `setTimeout(0)` to execute after React's flush.

3. **Switch LessonPlayer imports to `@/` alias** (H3): Quick cleanup that aligns the file with the rest of the codebase and eliminates fragile relative paths.

4. **Guard emoji in CompletionModal headings** (M3): Wrap emojis in `<span aria-hidden="true">` — a 2-minute change that materially improves screen reader experience for the celebration moment.

