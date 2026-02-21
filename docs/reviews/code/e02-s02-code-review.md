# Code Review: E02-S02 -- Video Playback Controls and Keyboard Shortcuts

**Reviewer**: Adversarial Senior Developer (Claude Opus 4.6)
**Date**: 2026-02-21
**Branch**: `feature/e02-s02-video-playback-controls-keyboard-shortcuts`
**Files changed**: 6 (641 additions, 43 deletions)

---

## What Works Well

1. **Solid auto-completion guard with `hasAutoCompleted` ref** (`/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/VideoPlayer.tsx:85`). Using a ref instead of state is the right call -- it prevents both re-rendering and double-firing the completion callback. The ref also resets correctly when `src` changes (line 114).

2. **Proper ARIA menu pattern for speed selector** (`/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/VideoPlayer.tsx:606-633`). `role="menu"` / `role="menuitem"`, roving tabindex, `aria-current` for the active speed, `aria-haspopup="menu"` on the trigger, and keyboard navigation (ArrowUp/Down, Enter, Escape) with focus restoration to the trigger button. This is textbook WAI-ARIA menu implementation.

3. **Thoughtful test structure with honest `test.fixme` annotations** (`/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/e2e/story-e02-s02-video-controls.spec.ts:176,335`). Rather than writing green tests that don't actually verify the feature, the developer correctly marked caption-related tests as `fixme` with clear explanations of why they cannot pass yet. This is far more honest than silently skipping them.

---

## Findings

### Blockers

#### 1. LessonPlayer never passes `captions` prop to VideoPlayer -- caption font size feature is dead code

**File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/LessonPlayer.tsx:178-192`

The VideoPlayer component receives `onAutoComplete`, `onEnded`, `seekToTime`, etc., but **never receives the `captions` prop**. The video resource's `metadata.captions` (defined in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/data/types.ts:26`) is available but never threaded through.

This means:
- The caption toggle button (`C` key) never renders
- The caption font size controls never render
- The `aria-pressed` attribute on the captions button is untestable
- AC "Caption toggle (C key) with font size adjustment (14pt-20pt)" is **unfulfilled**

Two E2E tests are already marked `test.fixme` acknowledging this, but the story is marked as "all tasks complete" in the story file.

```typescript
// Current (line 178-192):
<VideoPlayer
  src={getResourceUrl(videoResource)}
  title={lesson.title}
  // ... other props
  // MISSING: captions={videoResource.metadata?.captions}
/>
```

**Why**: Learners cannot toggle or resize captions. This is a core AC.

**Fix**: Pass `captions={videoResource.metadata?.captions}` to the `<VideoPlayer>` component. Remove the `test.fixme` markers once wired.

---

#### 2. `video::cue` pseudo-element cannot inherit CSS custom properties from parent elements

**File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/styles/theme.css:209` and `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/VideoPlayer.tsx:470`

The implementation sets `--caption-font-size` as an inline CSS custom property on the container div, then references it in `video::cue` via `font-size: var(--caption-font-size, 1.125rem)`. However, per the CSS specification, the `::cue` pseudo-element does **not** inherit custom properties from ancestor elements. The `::cue` pseudo-element has its own limited set of inheritable properties, and CSS custom properties are not among them in most browser implementations.

```css
/* theme.css line 209 */
video::cue {
  font-size: var(--caption-font-size, 1.125rem); /* Will always use fallback 1.125rem */
}
```

```tsx
// VideoPlayer.tsx line 470
style={{ '--caption-font-size': `${captionFontSize / 16}rem` } as React.CSSProperties}
```

**Why**: Caption font size adjustment will appear to work in the UI controls (the buttons and display update), but the actual rendered caption text will remain at the fallback 1.125rem. Learners who need larger captions for readability will be frustrated.

**Fix**: Instead of CSS custom properties, dynamically inject a `<style>` element into the document head when `captionFontSize` changes:

```typescript
useEffect(() => {
  const style = document.createElement('style')
  style.textContent = `video::cue { font-size: ${captionFontSize / 16}rem; }`
  document.head.appendChild(style)
  return () => { document.head.removeChild(style) }
}, [captionFontSize])
```

---

### High Priority

#### 3. AC specifies "opacity fade instead of scale animation" for reduced-motion, but implementation only suppresses scale

**File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/LessonPlayer.tsx:231-234`

The acceptance criterion states: "completion celebration uses opacity fade instead of scale animation." The current implementation uses `motion-safe:scale-125`, which correctly prevents the scale animation when `prefers-reduced-motion: reduce` is active. However, there is **no opacity fade alternative** -- the checkmark simply appears without any animation at all.

```tsx
className={cn(
  'h-5 w-5 text-green-500 transition-all duration-300',
  justCompleted && 'motion-safe:scale-125'
)}
```

Additionally, the global `prefers-reduced-motion` rule in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/styles/index.css:6-15` sets `transition-duration: 0.01ms !important`, which would also kill any opacity fade transition you add.

**Why**: The AC explicitly requires an alternative animation, not just suppression. Learners with reduced motion preferences should still get visual feedback that completion occurred.

**Fix**: Add an explicit reduced-motion opacity animation that works around the global `transition-duration` override:

```tsx
justCompleted && 'motion-safe:scale-125 motion-reduce:animate-fade-in'
```

Or use a CSS keyframe animation (since `animation-duration` is also clamped to `0.01ms` by the global rule, you may need to carve out an exception for this specific micro-interaction).

---

#### 4. Uncleared `setTimeout` in `triggerCompletion` can fire after unmount

**File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/LessonPlayer.tsx:97`

```typescript
const triggerCompletion = useCallback(() => {
  // ...
  setJustCompleted(true)
  setTimeout(() => setJustCompleted(false), 600)  // No cleanup
  // ...
}, [courseId, lessonId, completed, lesson])
```

If the user navigates away from the LessonPlayer within 600ms of completing a lesson (e.g., clicks "Continue Learning" in the celebration modal immediately), `setJustCompleted(false)` will fire on an unmounted component.

The same pattern exists in VideoPlayer's `announce` function (`/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/VideoPlayer.tsx:306`):

```typescript
const announce = useCallback((message: string) => {
  setAnnouncement(message)
  setTimeout(() => setAnnouncement(''), 1000)  // No cleanup
}, [])
```

**Why**: React will log "Can't perform a React state update on an unmounted component" warnings (React 18 actually removed this warning, but it's still a memory leak and bad practice).

**Fix**: Store timeout IDs in refs and clear them in cleanup effects:

```typescript
const justCompletedTimerRef = useRef<ReturnType<typeof setTimeout>>()

// In triggerCompletion:
clearTimeout(justCompletedTimerRef.current)
justCompletedTimerRef.current = setTimeout(() => setJustCompleted(false), 600)

// In useEffect cleanup:
useEffect(() => {
  return () => clearTimeout(justCompletedTimerRef.current)
}, [])
```

---

#### 5. Speed menu has no click-outside-to-close behavior

**File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/VideoPlayer.tsx:605-633`

The speed menu opens and closes via button click and Escape key, but there is no handler for clicking outside the menu to close it. If a user opens the speed menu and then clicks on the video or elsewhere in the player, the menu stays open and blocks interaction.

```tsx
{speedMenuOpen && (
  <div
    role="menu"
    aria-label="Playback speed"
    className="absolute bottom-full right-0 mb-2 w-32 rounded-md border bg-popover p-2 shadow-md z-50"
  >
    {/* ... no outside click handler ... */}
  </div>
)}
```

**Why**: This is a standard UX expectation for dropdown menus. Learners will be confused when the menu persists after clicking elsewhere. This also blocks video controls from working properly while the menu is visually covering them.

**Fix**: Add a `mousedown` event listener to close the menu when clicking outside:

```typescript
useEffect(() => {
  if (!speedMenuOpen) return
  const handleClickOutside = (e: MouseEvent) => {
    if (!containerRef.current?.contains(e.target as Node)) {
      setSpeedMenuOpen(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [speedMenuOpen])
```

Or scope it more tightly to check if the click was outside the speed menu `<div>` specifically.

---

#### 6. No unit tests for VideoPlayer or LessonPlayer -- all new logic is only covered by E2E

There are **zero** unit test files for either component:
- No `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/__tests__/VideoPlayer.test.tsx`
- No `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/__tests__/LessonPlayer.test.tsx`

All verification relies on E2E tests in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/e2e/story-e02-s02-video-controls.spec.ts`. Unit tests would provide:
- Faster feedback (seconds vs. minutes)
- Better isolation of `formatTime`, `changeCaptionFontSize`, `handleTimeUpdate` with 95% threshold logic
- Coverage of edge cases like `indexOf` returning -1, NaN durations, zero-length videos

**Why**: If E2E tests are flaky (common with video elements), there is zero safety net. The `formatTime` helper and the 95% threshold logic are pure functions that are trivially unit-testable.

**Fix**: At minimum, add unit tests for:
- `formatTime()` with edge cases (0, 59, 60, 3600, NaN)
- `changeCaptionFontSize` behavior when current size is not in the array
- `handleTimeUpdate` auto-completion threshold (mock video element)

---

### Medium

#### 7. `changeCaptionFontSize` silently breaks if localStorage contains a non-standard value

**File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/VideoPlayer.tsx:282-291`

If a user (or another code path) sets `video-caption-font-size` to a value not in `CAPTION_FONT_SIZES` (e.g., `15`), `indexOf(prev)` returns `-1`. Then `currentIdx + delta` produces `-2` or `0` depending on `delta`, and `Math.max(0, ...)` clamps to `0`. This means pressing "increase" would jump from the invalid value to `14pt` (the smallest size), not to the nearest valid size.

```typescript
const currentIdx = CAPTION_FONT_SIZES.indexOf(prev) // -1 if not found
const newIdx = Math.max(0, Math.min(CAPTION_FONT_SIZES.length - 1, currentIdx + delta))
```

**Fix**: Guard against `indexOf` returning `-1`:

```typescript
const currentIdx = CAPTION_FONT_SIZES.indexOf(prev)
if (currentIdx === -1) return CAPTION_FONT_SIZES[Math.floor(CAPTION_FONT_SIZES.length / 2)]
```

---

#### 8. `h-* w-*` used throughout instead of Tailwind v4 `size-*` shorthand

**File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/VideoPlayer.tsx` (lines 514, 518, 549, 553, 561, 566, 568, 602, 641, 645, 656, 663, 672, 677, 685, 690, 701, 706, 708)

All icon and button sizing uses the v3 pattern `h-N w-N` instead of the v4 shorthand `size-N`. This was flagged in previous reviews (E01-S03, E01-S04) and persists in new code.

```tsx
// Current (19 instances):
className="h-8 w-8 text-white ..."
<Pause className="h-4 w-4" />

// Should be:
className="size-8 text-white ..."
<Pause className="size-4" />
```

**Fix**: Replace all `h-N w-N` pairs where both values are equal with `size-N`.

---

#### 9. Missing blank line between `handleTimeUpdate` and `handleEnded` callbacks

**File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/VideoPlayer.tsx:171-172`

```typescript
  }, [onTimeUpdate, onAutoComplete])
  // Handle video ended          // <-- no blank line separator
  const handleEnded = useCallback(() => {
```

This is a minor formatting issue introduced when the auto-completion check was added to `handleTimeUpdate`. Every other callback pair in the file has a blank line separator.

**Fix**: Add a blank line between line 171 and 172.

---

### Nits

#### 10. `handleAutoComplete` is a trivial wrapper that adds no value

**Nit** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/LessonPlayer.tsx:103-105`

```typescript
const handleAutoComplete = useCallback(() => {
  triggerCompletion()
}, [triggerCompletion])
```

This is identical to `handleVideoEnded` (lines 107-109). Both simply call `triggerCompletion()`. You could pass `triggerCompletion` directly as the `onAutoComplete` prop, or at minimum collapse these into a single callback.

```tsx
// Simpler:
onAutoComplete={triggerCompletion}
onEnded={triggerCompletion}
```

---

## Recommendations

Priority order for fixes:

1. **(Blocker)** Wire `captions` prop from `videoResource.metadata?.captions` in LessonPlayer to VideoPlayer -- this unblocks an entire AC
2. **(Blocker)** Fix `::cue` CSS variable inheritance -- switch to dynamic `<style>` injection for caption font size
3. **(High)** Add explicit `motion-reduce:` opacity fade animation for the completion checkmark
4. **(High)** Add click-outside-to-close for the speed menu
5. **(High)** Clean up unguarded `setTimeout` calls in `triggerCompletion` and `announce`
6. **(High)** Add unit tests for `formatTime`, caption font size logic, and auto-completion threshold
7. **(Medium)** Guard `changeCaptionFontSize` against invalid localStorage values
8. **(Medium)** Migrate `h-N w-N` to `size-N` across VideoPlayer
9. **(Nit)** Fix missing blank line and collapse trivial wrapper callbacks

---

## AC Coverage Check

| AC# | Description | Test Coverage | Verdict |
|-----|-------------|---------------|---------|
| 1 | Play/pause toggle via button click and Space key | Pre-existing functionality, not explicitly tested in this story's E2E | **Assumed** |
| 2 | Seek forward/backward Arrow keys (+/-5s), Shift+Arrow (+/-10s) | `tests/e2e/story-e02-s02-video-controls.spec.ts:38-86` (AC1 section) | **Pass** |
| 3 | Volume control with slider and mute toggle (M key) | Pre-existing functionality, not tested | **Assumed** |
| 4 | Fullscreen toggle (F key) | Pre-existing functionality, not tested | **Assumed** |
| 5 | Playback speed selector (0.5x-2x) | Pre-existing; ARIA/keyboard nav tested in AC5 section | **Pass** |
| 6 | Timestamp display MM:SS | Pre-existing, used as assertion target in seek tests | **Partial** |
| 7a | Caption toggle (C key) | `test.fixme` -- **captions prop not wired** | **Gap** |
| 7b | Caption font size adjustment (14pt-20pt) | `test.fixme` -- captions not wired; `::cue` CSS var broken | **Gap** |
| 8 | 95% auto-completion with celebration | `tests/e2e/story-e02-s02-video-controls.spec.ts:92-168` (3 tests) | **Pass** |
| 9 | prefers-reduced-motion: opacity fade instead of scale | `tests/e2e/story-e02-s02-video-controls.spec.ts:211-255` -- tests pass but AC is not fully met (no opacity fade, just scale suppression) | **Gap** |
| 10 | WCAG AA+ compliance (contrast, focus, ARIA) | `tests/e2e/story-e02-s02-video-controls.spec.ts:262-365` (4 tests + 1 fixme) | **Pass** |

---

Issues found: **10** | Blockers: **2** | High: **4** | Medium: **3** | Nits: **1**
