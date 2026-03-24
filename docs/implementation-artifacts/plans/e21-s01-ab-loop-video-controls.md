# Implementation Plan: E21-S01 AB-Loop Video Controls

**Story:** [21-1-ab-loop-video-controls.md](../21-1-ab-loop-video-controls.md)
**Created:** 2026-03-23
**Estimated Effort:** 2 hours
**Files Modified:** 4 | **Files Created:** 1

---

## Overview

Add A-B loop functionality to the existing VideoPlayer component, allowing learners to set two markers (A and B) on the video timeline and automatically loop playback between them. This is a mastery-learning feature for reviewing difficult segments through repetition.

## Architecture Decision

**Approach: Self-contained within VideoPlayer component (no new stores or persistence)**

The AB loop is a transient, session-scoped feature — loop markers are not persisted across page navigations. This matches the mental model of "I want to loop this section right now" and keeps complexity minimal. No Dexie schema changes, no Zustand stores, no localStorage persistence needed.

**Rationale:**
- Loop markers are ephemeral (no value in persisting across sessions)
- All state lives in VideoPlayer.tsx already (consistent with existing patterns)
- ChapterProgressBar already accepts props for visual markers (chapters, bookmarks) — we extend this pattern
- Keyboard handler already exists — we add cases to the existing switch statement

---

## Step-by-Step Implementation

### Step 1: Add AB Loop State to VideoPlayer.tsx

**File:** `src/app/components/figma/VideoPlayer.tsx`
**Location:** After the existing state declarations (~line 141)

Add three pieces of state:

```typescript
// AB Loop state
const [loopA, setLoopA] = useState<number | null>(null)  // start time in seconds
const [loopB, setLoopB] = useState<number | null>(null)  // end time in seconds
```

**Design notes:**
- `loopA = null, loopB = null` → No loop (default)
- `loopA = number, loopB = null` → Partial state (A set, waiting for B)
- `loopA = number, loopB = number` → Active loop
- Invariant: `loopA < loopB` always (enforce in setter)

---

### Step 2: Add Loop Enforcement in handleTimeUpdate

**File:** `src/app/components/figma/VideoPlayer.tsx`
**Location:** Inside `handleTimeUpdate()` (~line 209)

When both A and B are set and `currentTime >= loopB`, seek back to `loopA`:

```typescript
const handleTimeUpdate = () => {
  if (videoRef.current) {
    const time = videoRef.current.currentTime
    setCurrentTime(time)
    onTimeUpdate?.(time)

    // AB Loop enforcement: when playback reaches B, jump to A
    if (loopA !== null && loopB !== null && time >= loopB) {
      videoRef.current.currentTime = loopA
      setCurrentTime(loopA)
    }
  }
}
```

**Edge cases to handle:**
- User manually seeks past B → still loops back to A (correct behavior)
- User manually seeks before A → plays normally until reaching B, then loops
- Video ends before reaching B → `handleEnded` fires normally (loop doesn't prevent end)
- The `timeupdate` event fires ~4x/second — the `>=` comparison ensures we catch the boundary even if exact B time is missed between events

---

### Step 3: Add Toggle Function for AB Loop

**File:** `src/app/components/figma/VideoPlayer.tsx`
**Location:** After `handleAddBookmark()` (~line 405)

```typescript
const toggleAbLoop = () => {
  if (loopA === null) {
    // First press: set A marker
    setLoopA(currentTime)
    announce(`Loop start set at ${formatTime(currentTime)}`)
  } else if (loopB === null) {
    // Second press: set B marker (must be after A)
    if (currentTime <= loopA) {
      announce('Loop end must be after loop start')
      return
    }
    setLoopB(currentTime)
    announce(`Loop active: ${formatTime(loopA)} to ${formatTime(currentTime)}`)
  } else {
    // Third press: clear loop and start new A
    setLoopA(currentTime)
    setLoopB(null)
    announce(`Loop cleared. New loop start set at ${formatTime(currentTime)}`)
  }
}

const clearAbLoop = () => {
  setLoopA(null)
  setLoopB(null)
  announce('Loop cleared')
}
```

**Behavior design:**
- "A" key cycles: Set A → Set B → Clear & Set new A
- "Escape" key always clears entirely (existing Escape behavior for shortcuts overlay is only when overlay is open — no conflict)
- Pressing A when B < current position: error announcement, no change

---

### Step 4: Add Keyboard Shortcuts

**File:** `src/app/components/figma/VideoPlayer.tsx`
**Location:** Inside the keyboard `switch` statement (~line 508-591)

Add two cases:

```typescript
case 'a':
  e.preventDefault()
  toggleAbLoop()
  containerRef.current?.focus({ preventScroll: true })
  break
case 'Escape':
  if (loopA !== null) {
    e.preventDefault()
    clearAbLoop()
    containerRef.current?.focus({ preventScroll: true })
  }
  break
```

**Escape key conflict resolution:**
- Shortcuts overlay handles its own Escape (line 497-503, checked first in the handler)
- Our Escape only fires when `loopA !== null` and shortcuts overlay is not open
- If no loop is active, Escape falls through (no `preventDefault`, so browser/fullscreen exit works)

**Dependency array update:** Add `toggleAbLoop`, `clearAbLoop`, `loopA` to the useEffect dependency array.

---

### Step 5: Update ChapterProgressBar with Loop Region

**File:** `src/app/components/figma/ChapterProgressBar.tsx`

Add new props and visual elements:

```typescript
interface ChapterProgressBarProps {
  // ... existing props
  loopA?: number | null    // loop start time in seconds
  loopB?: number | null    // loop end time in seconds
}
```

Add visual elements in the component:

1. **Loop region highlight** — a semi-transparent overlay between A and B positions:
```tsx
{/* AB Loop region — below chapter/bookmark markers (z-5) */}
{loopA != null && loopB != null && duration > 0 && (
  <div
    data-testid="ab-loop-region"
    className="absolute inset-y-0 bg-brand/30 rounded-full pointer-events-none z-5"
    style={{
      left: `${(loopA / duration) * 100}%`,
      width: `${((loopB - loopA) / duration) * 100}%`,
    }}
  />
)}
```

2. **A marker** — visible when loopA is set:
```tsx
{loopA != null && duration > 0 && (
  <div
    data-testid="ab-loop-marker-a"
    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-20"
    style={{ left: `${(loopA / duration) * 100}%` }}
    aria-label={`Loop start at ${formatTime(loopA)}`}
  >
    <span className="w-2 h-2 rounded-full bg-brand border border-brand block" />
  </div>
)}
```

3. **B marker** — visible when loopB is set:
```tsx
{loopB != null && duration > 0 && (
  <div
    data-testid="ab-loop-marker-b"
    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-20"
    style={{ left: `${(loopB / duration) * 100}%` }}
    aria-label={`Loop end at ${formatTime(loopB)}`}
  >
    <span className="w-2 h-2 rounded-full bg-brand border border-brand block" />
  </div>
)}
```

**Why `pointer-events-none`:** The markers are visual-only indicators. The hidden range input (z-10) handles all seeking interaction. Chapter and bookmark markers are interactive (z-20) but loop markers are not — they just show where the loop boundaries are.

---

### Step 6: Add AB Loop Button to Control Bar

**File:** `src/app/components/figma/VideoPlayer.tsx`
**Location:** In the right-side control buttons section, between bookmark and captions buttons (~line 1063)

```tsx
{/* AB Loop Toggle */}
<Button
  variant="ghost"
  size="icon"
  data-testid="ab-loop-button"
  className={cn(
    'size-11 text-white hover:bg-white/20',
    loopA !== null && 'bg-white/20'
  )}
  onClick={toggleAbLoop}
  aria-label={
    loopA === null
      ? 'Set loop start point'
      : loopB === null
        ? 'Set loop end point'
        : 'Loop active — click to reset'
  }
  aria-pressed={loopA !== null && loopB !== null}
>
  <Repeat className="size-5" />
</Button>
```

**Import:** Add `Repeat` to the lucide-react imports at the top of VideoPlayer.tsx.

**Button states:**
| State | Appearance | aria-label | aria-pressed |
|-------|-----------|------------|-------------|
| No loop | Ghost (default) | "Set loop start point" | — |
| A set only | `bg-white/20` highlight | "Set loop end point" | — |
| A+B set (active loop) | `bg-white/20` highlight | "Loop active — click to reset" | `true` |

---

### Step 7: Update VideoShortcutsOverlay

**File:** `src/app/components/figma/VideoShortcutsOverlay.tsx`

Add to the `controlShortcuts` array:

```typescript
{ keys: ['A'], description: 'Set/clear AB loop' },
```

This goes after the bookmark entry (B key) for logical grouping. The Escape key is already implied by the "Show shortcuts" entry context, but we can add it explicitly:

```typescript
{ keys: ['Esc'], description: 'Clear AB loop' },
```

---

### Step 8: Reset Loop on Source Change

**File:** `src/app/components/figma/VideoPlayer.tsx`
**Location:** In the existing `useEffect` that resets state when `src` changes (~line 152)

```typescript
useEffect(() => {
  hasRestoredPosition.current = false
  setHasError(false)
  setLoopA(null)  // Clear loop when switching videos
  setLoopB(null)
}, [src])
```

---

## Testing Strategy

### E2E Tests (Playwright)

**File to create:** `tests/e2e/stories/e21-s01-ab-loop-video-controls.spec.ts`

**Test cases:**

| Test | AC | Description |
|------|-----|-------------|
| Set A marker with keyboard | AC1 | Press 'A' → verify marker appears on progress bar |
| Set B marker with keyboard | AC2 | Press 'A' twice → verify loop region appears |
| Loop enforcement | AC3 | Set A/B, let playback reach B → verify seek to A |
| Escape clears loop | AC4 | Set A/B, press Escape → verify markers removed |
| Click AB button to set A | AC1 | Click button → verify aria-label changes |
| Click AB button to set B | AC2 | Click button again → verify loop activates |
| Visual region on progress bar | AC5 | Set A/B → verify `[data-testid="ab-loop-region"]` visible |
| Partial state shows single marker | AC6 | Set A only → verify marker A visible, no region |
| B must be after A | AC2 | Set A at 30s, try B at 10s → verify error announcement |
| Loop clears on video change | — | Navigate to next lesson → verify no loop markers |

**Test pattern to follow:** Same as `story-e02-s02-video-controls.spec.ts`:
- Use `page.evaluate()` to set `video.currentTime` for positioning
- Use `page.keyboard.press('a')` for keyboard actions
- Use `page.getByTestId()` for UI assertions
- Use `page.locator('[role="status"]')` for ARIA announcement assertions

### Unit Tests (Vitest)

**File to create:** `src/app/components/figma/__tests__/VideoPlayer.ab-loop.test.tsx`

**Test cases:**
- toggleAbLoop: first call sets A, second sets B, third resets
- clearAbLoop: resets both to null
- B before A rejected
- handleTimeUpdate loops when time >= B

---

## File Change Summary

| File | Change Type | Lines Changed (est.) |
|------|------------|---------------------|
| `src/app/components/figma/VideoPlayer.tsx` | Modify | ~60 lines added |
| `src/app/components/figma/ChapterProgressBar.tsx` | Modify | ~35 lines added |
| `src/app/components/figma/VideoShortcutsOverlay.tsx` | Modify | ~2 lines added |
| `tests/e2e/stories/e21-s01-ab-loop-video-controls.spec.ts` | Create | ~200 lines |
| `src/app/components/figma/__tests__/VideoPlayer.ab-loop.test.tsx` | Create | ~100 lines |

**No changes to:**
- Dexie schema (no persistence)
- Zustand stores (no shared state)
- LessonPlayer.tsx (VideoPlayer handles everything internally)
- CSS/theme files (using existing design tokens)
- Routes (no new pages)

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `timeupdate` fires too infrequently, missing B point | Low | `>=` comparison catches overshoot; HTML5 fires ~4 Hz |
| Escape key conflict with fullscreen exit | Low | Only `preventDefault` when `loopA !== null`; fullscreen has its own `F` key |
| Escape key conflict with shortcuts overlay | None | Overlay checks come first in the handler (line 497) |
| A key conflict with existing shortcuts | None | No existing 'a' key binding in the handler |
| Performance impact from timeupdate check | None | Single null check + comparison, negligible |
| Loop interferes with auto-completion at video end | Low | `handleEnded` fires independently; if B < duration, loop prevents reaching end (expected) |

---

## Implementation Order

1. **Step 1** — State declarations (foundation)
2. **Step 3** — Toggle/clear functions (logic)
3. **Step 2** — timeupdate enforcement (core loop behavior)
4. **Step 4** — Keyboard shortcuts (A key, Escape)
5. **Step 8** — Reset on source change (cleanup)
6. **Step 5** — Progress bar visuals (ChapterProgressBar)
7. **Step 6** — Control bar button (UI)
8. **Step 7** — Shortcuts overlay update (docs)
9. **Unit tests** — VideoPlayer.ab-loop.test.tsx
10. **E2E tests** — e21-s01-ab-loop-video-controls.spec.ts

This order builds from inside-out: state → logic → keyboard → visuals → tests.
