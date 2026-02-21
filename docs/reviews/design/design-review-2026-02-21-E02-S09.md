# Design Review: E02-S09 — Mini-Player & Theater Mode

**Review Date**: 2026-02-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e02-s09-mini-player-theater-mode`
**Changed Files**:
- `src/app/components/figma/VideoPlayer.tsx`
- `src/app/hooks/useIntersectionObserver.ts`
- `src/app/pages/LessonPlayer.tsx`

---

## Executive Summary

E02-S09 successfully implements mini-player and theater mode with solid mechanics — IntersectionObserver is set up correctly, theater mode correctly toggles the sidebar, all three acceptance criteria pass their basic functional requirements, and no console errors are present.

**Blocker**: The mini-player wrapper carries `inset-0` (`top: 0; left: 0`) into the `position: fixed` state. Only `bottom` and `right` are overridden, leaving an invisible 320×884px transparent div covering the full left-side viewport column. This intercepts clicks on navigation, lesson list items, and sidebar controls.

---

## What Works Well

- **Theater mode toggle**: Sidebar hides (`display: none`), video anchor expands from 801px to 1102px, button shows active state (`bg-white/20`).
- **Responsive visibility**: Theater button correctly hidden below xl via `hidden xl:flex`. No horizontal overflow at any viewport.
- **Touch targets**: All video control buttons meet 44×44px minimum (Play, Mute, Bookmark, Fullscreen).
- **Mini-player triggers on scroll**: IntersectionObserver fires at 30% threshold. `fixed bottom-4 right-4 w-80 z-50 rounded-2xl shadow-2xl` matches spec.
- **Reduced-motion respected**: `handleMiniPlayerClick` correctly queries `prefers-reduced-motion` at call time.
- **Layout shift prevention**: Outer `video-anchor` holds `aspect-video w-full` in normal flow while inner `mini-player` transitions to fixed.
- **No console errors**: Clean runtime in tested session.

---

## Findings

### Blockers

**B1 — Mini-player click/focus trap covers full left-side viewport column**

- **Location**: `src/app/pages/LessonPlayer.tsx:256-270`
- **Evidence**: Computed measurement when mini-player is active — `top: 0px`, `left: 0px`, `width: 320px`, `height: 884px` (full viewport height).
- **Root cause**: `cn('absolute inset-0', isMiniPlayer && 'fixed bottom-4 right-4 w-80 ...')` carries `inset-0` (`top: 0; right: 0; bottom: 0; left: 0`) into the fixed state. `bottom-4` and `right-4` override their counterparts, but `top: 0` and `left: 0` are not overridden — element stretches from top-left corner of viewport.
- **Impact**: Invisible 320×884px transparent div intercepts clicks on navigation links, lesson list items, PDF controls, and sidebar elements in the left portion of the screen.
- **Fix**: Add `top-auto left-auto` to the fixed class string:

  ```tsx
  className={cn(
    'absolute inset-0',
    isMiniPlayer &&
      'fixed bottom-4 right-4 top-auto left-auto w-80 z-50 rounded-2xl overflow-hidden shadow-2xl cursor-pointer'
  )}
  ```

---

### High Priority

**H1 — Mini-player wrapper lacks interactive role and label (WCAG 4.1.2)**

- **Location**: `src/app/pages/LessonPlayer.tsx:256-270`
- **Evidence**: `tagName: "DIV"`, `role: null`, `aria-label: null`, `tabIndex: 0`, `onClick` present. `onKeyDown` only handles `t`, not `Enter` or `Space`.
- **Impact**: Screen readers hear no role or label; keyboard users cannot activate scroll-back via Enter/Space. WCAG 2.1 SC 4.1.2 violated.
- **Fix**: Use `<button>` element or add `role="button"` + `aria-label="Return to video"` + handle `Enter`/`Space`.

**H2 — `useIntersectionObserver` options object unstable across renders**

- **Location**: `src/app/pages/LessonPlayer.tsx:74` + `src/app/hooks/useIntersectionObserver.ts:19`
- **Evidence**: `{ threshold: 0.3 }` inline literal creates new reference each render; `options` is in the `useEffect` dependency array → observer disconnected/reconnected every render.
- **Impact**: Observer recreated ~4×/second during playback (time update events). Potential missed intersection events during teardown/setup gap.
- **Fix**: Memoize at call site:

  ```tsx
  const intersectionOptions = useMemo(() => ({ threshold: 0.3 }), [])
  const isVideoIntersecting = useIntersectionObserver(videoWrapperRef, intersectionOptions)
  ```

---

### Medium Priority

**M1 — T key theater-mode handler fires on both mini-player wrapper and VideoPlayer simultaneously**

- **Location**: `src/app/pages/LessonPlayer.tsx:265-270` + `src/app/components/figma/VideoPlayer.tsx:439-442`
- **Impact**: When focus is inside VideoPlayer controls, both handlers fire → double-toggle → no net change. Theater mode impossible to activate via T while using video controls.
- **Fix**: Remove the `t` key handler from the mini-player wrapper. VideoPlayer already handles T globally via `onTheaterModeToggle?.()`.

**M2 — Mini-player has no visual "return to player" affordance**

- **Location**: `src/app/pages/LessonPlayer.tsx` (mini-player rendering)
- **Impact**: No visible indicator of how to scroll back. Platform's learning-first principle requires clear affordances.
- **Suggestion**: Add hover overlay with expand icon:

  ```tsx
  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
    <Maximize2 className="text-white size-8" />
  </div>
  ```

**M3 — `useIntersectionObserver` hook is fragile if `ref.current` changes after mount**

- **Location**: `src/app/hooks/useIntersectionObserver.ts:10-19`
- **Impact**: Low risk in current usage (ref is stable). Not resilient if reused with dynamic refs.
- **Suggestion**: Document the limitation with a comment. Acceptable as-is for current usage.

---

### Nitpicks

**N1** — Any existing tests referencing `data-testid="video-player-container"` would need updating (removed in this PR).

**N2** — `bookmarks` and `onBookmarkSeek` reordered in VideoPlayer destructuring without semantic reason adds diff noise.

---

## Acceptance Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC1 — Mini-player fixed bottom-right at 320px | Pass | `fixed bottom-4 right-4 w-80` confirmed |
| AC1 — Layout anchor prevents shift | Pass | Outer `aspect-video w-full` anchor holds space |
| AC1 — Mini-player hides when paused | Pass | `isMiniPlayer = !isVideoIntersecting && isVideoPlaying` |
| AC2 — Theater button visible at desktop ≥1280px | Pass | 44×44px, `display: flex` at 1440px |
| AC2 — Sidebar hides on theater mode click | Pass | `display: none` confirmed |
| AC2 — Video expands full width | Pass | 801px → 1102px |
| AC2 — T key toggles theater mode | Partial | Works with focus on wrapper; double-toggle bug with focus inside VideoPlayer (M1) |
| AC3 — Theater button hidden at 375px | Pass | `display: none`, 0×0 bounding rect |

---

## Responsive Design Summary

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass | Theater button hidden, no horizontal scroll, all controls ≥44×44px |
| Tablet (768px) | Pass | Theater button hidden, no horizontal scroll |
| Desktop (1440px) | Pass | Theater button visible 44×44px, theater mode works |

---

## Verdict: BLOCKED

Fix B1 (invisible click trap from `inset-0` not being cleared) before merge. H1 (WCAG role/label) is recommended in the same pass.
