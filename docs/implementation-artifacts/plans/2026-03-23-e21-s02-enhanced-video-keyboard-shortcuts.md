# Implementation Plan: E21-S02 Enhanced Video Keyboard Shortcuts

**Story:** E21-S02 — Enhanced Video Keyboard Shortcuts
**Date:** 2026-03-23
**Estimated Effort:** 1 hour
**Priority:** P0 (Quick Win)

## Overview

Add two new keyboard shortcuts to the video player (`<`/`>` for playback speed stepping, `N` for focusing the note editor) and update the shortcuts help overlay to document them. This builds on the existing YouTube-style keyboard shortcut system implemented in E02-S02 and E02-S07.

## Current State Analysis

### Existing Keyboard Shortcuts (VideoPlayer.tsx:481–611)
- **Already implemented:** Space/K (play/pause), J/L (±10s skip), Arrow keys (±5s seek, volume), M (mute), C (captions), F (fullscreen), P (PiP), B (bookmark), 0-9 (jump %), T (theater), ? (shortcuts overlay)
- **Playback speed:** Controlled via dropdown menu (PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]), persisted to localStorage — no keyboard shortcut yet
- **Note focus:** No mechanism to focus the note editor from the video player

### Key Architecture Points
- All shortcuts are in a single `handleKeyDown` effect (lines 481–611 of VideoPlayer.tsx)
- Input guard at lines 487–491 prevents shortcuts when typing in inputs/textareas/contenteditable
- ARIA announcements via `announce()` helper function
- VideoPlayer is a forwardRef component with `VideoPlayerHandle` interface
- NoteEditor uses TipTap — focus via `editor.chain().focus().run()`
- LessonPlayer manages `notesOpen` state and `activeTab` state

### Files to Modify
| File | Change |
|------|--------|
| `src/app/components/figma/VideoPlayer.tsx` | Add `<`/`>` speed shortcuts, add `n` focus-notes shortcut, new prop |
| `src/app/components/figma/VideoShortcutsOverlay.tsx` | Add new entries to shortcuts arrays |
| `src/app/pages/LessonPlayer.tsx` | Wire `onFocusNotes` prop to open notes panel + focus editor |
| `tests/e2e/story-e21-s02-keyboard-shortcuts.spec.ts` | E2E tests for new shortcuts |

### Files NOT Modified
| File | Reason |
|------|--------|
| `src/app/components/notes/NoteEditor.tsx` | No changes needed — TipTap focus is already accessible via parent |
| `src/stores/*.ts` | No new state stores required |
| `src/app/pages/ImportedLessonPlayer.tsx` | Uses same VideoPlayer — inherits shortcuts automatically |

## Implementation Steps

### Step 1: Add Speed Step Function and `<`/`>` Shortcuts (AC1)

**File:** `src/app/components/figma/VideoPlayer.tsx`

**1a. Create `stepPlaybackSpeed` helper (near line 337, after `changePlaybackSpeed`):**

```typescript
const stepPlaybackSpeed = useCallback(
  (direction: 'up' | 'down') => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
    if (direction === 'up') {
      if (currentIndex >= PLAYBACK_SPEEDS.length - 1) {
        announce('Already at maximum speed')
        return
      }
      changePlaybackSpeed(PLAYBACK_SPEEDS[currentIndex + 1])
    } else {
      if (currentIndex <= 0) {
        announce('Already at minimum speed')
        return
      }
      changePlaybackSpeed(PLAYBACK_SPEEDS[currentIndex - 1])
    }
  },
  [playbackSpeed, changePlaybackSpeed, announce]
)
```

**Design decision:** `stepPlaybackSpeed` reuses `changePlaybackSpeed` which already handles localStorage persistence and ARIA announcement. The boundary announcements ("Already at maximum/minimum speed") provide accessible feedback for screen reader users.

**Edge case:** If `playbackSpeed` is not in `PLAYBACK_SPEEDS` (e.g., manually set to 1.1), `indexOf` returns -1. In practice this can't happen since speed is only set via `changePlaybackSpeed` which uses the predefined array. No defensive code needed.

**1b. Add `<` and `>` cases to `handleKeyDown` switch (after the `b` case, ~line 577):**

The `<` key is `Shift+,` and `>` is `Shift+.`. However, the `e.key` values are `<` and `>` directly. The existing guard at line 484 skips shortcuts when modifier keys are held — but it checks `e.ctrlKey || e.metaKey || e.altKey`, NOT `e.shiftKey`. So Shift-based shortcuts like `<`/`>` pass through correctly.

```typescript
case '<':
  e.preventDefault()
  stepPlaybackSpeed('down')
  containerRef.current?.focus({ preventScroll: true })
  break
case '>':
  e.preventDefault()
  stepPlaybackSpeed('up')
  containerRef.current?.focus({ preventScroll: true })
  break
```

**1c. Add `stepPlaybackSpeed` to the effect dependency array (line 597–611).**

### Step 2: Add `N` Key Focus-Notes Shortcut (AC2)

**2a. Add `onFocusNotes` prop to `VideoPlayerProps` interface (~line 55):**

```typescript
onFocusNotes?: () => void
```

**2b. Destructure the prop in the component function (~line 88):**

```typescript
onFocusNotes,
```

**2c. Add `n` case to `handleKeyDown` switch (after the `>` case):**

```typescript
case 'n':
  e.preventDefault()
  onFocusNotes?.()
  break
```

Note: No `containerRef.current?.focus()` here — focus should move to the editor, not stay on the video.

**2d. Add `onFocusNotes` to the effect dependency array.**

**2e. Wire the callback in LessonPlayer.tsx:**

In `LessonPlayer.tsx`, add the `onFocusNotes` handler. This needs to:
1. Open the notes panel if closed (`setNotesOpen(true)`)
2. Switch to the notes tab if not active (`setActiveTab('notes')`)
3. Focus the TipTap editor

The challenge is that the note editor may not be mounted yet if the panel was closed. We need a mechanism to focus after mount.

**Approach:** Use a ref-based flag + useEffect pattern:

```typescript
const [pendingNoteFocus, setPendingNoteFocus] = useState(false)

const handleFocusNotes = useCallback(() => {
  if (!notesOpen) {
    setNotesOpen(true)
    setPendingNoteFocus(true)  // Will focus after panel opens
  } else {
    // Panel already open — focus immediately
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
      editor?.focus()
    })
  }
}, [notesOpen])

// Effect to focus editor after panel opens
useEffect(() => {
  if (pendingNoteFocus && notesOpen) {
    requestAnimationFrame(() => {
      const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
      editor?.focus()
    })
    setPendingNoteFocus(false)
  }
}, [pendingNoteFocus, notesOpen])
```

**Alternative considered:** Adding a `focusEditor` imperative method to NoteEditor via `forwardRef`/`useImperativeHandle`. This would be cleaner but requires modifying NoteEditor.tsx, which is a large component (~1000+ lines) and not strictly necessary — the DOM query approach is simpler for this scope.

**Learning opportunity:** The `pendingNoteFocus` pattern is a common React anti-pattern detector. The user could decide between:
- Option A: DOM query (simpler, slightly fragile if contenteditable structure changes)
- Option B: Imperative handle on NoteEditor (more robust, more code)

**2f. Pass `onFocusNotes={handleFocusNotes}` to VideoPlayer in LessonPlayer.tsx.**

Also pass it in ImportedLessonPlayer.tsx if it has a notes panel (check during implementation).

### Step 3: Update Shortcuts Overlay (AC3)

**File:** `src/app/components/figma/VideoShortcutsOverlay.tsx`

**3a. Add speed entry to `playbackShortcuts` array (after PiP entry, ~line 22):**

```typescript
{ keys: ['<', '>'], description: 'Speed down/up' },
```

**3b. Add notes focus entry to `notesShortcuts` array (~line 35):**

```typescript
{ keys: ['N'], description: 'Focus note editor' },
```

### Step 4: E2E Tests (AC1, AC2, AC3, AC4)

**File:** `tests/e2e/story-e21-s02-keyboard-shortcuts.spec.ts`

Follow patterns from `tests/e2e/regression/story-e02-s02-video-controls.spec.ts`:
- Navigate to lesson player, wait for video element
- Close sidebar to prevent aria-hidden interference

**Test cases:**

```
AC1 - Speed shortcuts:
  1. Press > → verify speed display shows 1.25x (default starts at 1x)
  2. Press > repeatedly → verify stops at 2x, announces "Already at maximum speed"
  3. Press < → verify speed decreases
  4. Press < at 0.5x → verify stays at 0.5x, announces "Already at minimum speed"

AC2 - Focus notes:
  5. Press N → verify notes panel opens + contenteditable has focus
  6. Press N when notes already open → verify editor still gets focus
  7. Type in search box → press N → verify N is typed (input guard), not shortcut
  8. Verify video continues playing after N (no auto-pause)

AC3 - Shortcuts overlay:
  9. Press ? → verify overlay contains "Speed down/up" text
  10. Verify overlay contains "Focus note editor" text
  11. Verify overlay contains < and > key badges

AC4 - Accessibility:
  12. Press > → verify ARIA live region announces speed change
  13. Verify focus is not trapped after pressing N
```

**Test file structure:**
```typescript
test.describe('E21-S02: Enhanced Video Keyboard Shortcuts', () => {
  test.describe('AC1: Speed keyboard controls', () => { ... })
  test.describe('AC2: Focus note editor', () => { ... })
  test.describe('AC3: Updated shortcuts overlay', () => { ... })
  test.describe('AC4: Accessibility', () => { ... })
})
```

## Execution Order

| # | Step | Files | Depends On | Est. |
|---|------|-------|-----------|------|
| 1 | Speed step function + `<`/`>` shortcuts | VideoPlayer.tsx | — | 10 min |
| 2 | `N` key focus-notes shortcut + wiring | VideoPlayer.tsx, LessonPlayer.tsx | — | 15 min |
| 3 | Update shortcuts overlay | VideoShortcutsOverlay.tsx | — | 5 min |
| 4 | E2E tests | tests/e2e/story-e21-s02-*.spec.ts | Steps 1-3 | 20 min |
| 5 | Manual verification + cleanup | — | Steps 1-4 | 10 min |

Steps 1-3 can be implemented in any order. Step 4 requires steps 1-3 complete.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `<`/`>` conflict with browser shortcuts | Low | Low | Checked: Shift+comma/period have no default browser behavior |
| `N` key conflicts with existing shortcut | None | — | Verified: no existing `n` case in handleKeyDown |
| Note panel animation delay causes focus miss | Medium | Low | `requestAnimationFrame` + `pendingNoteFocus` pattern handles this |
| ImportedLessonPlayer missing notes panel | Low | Low | Check during implementation; may not need onFocusNotes |
| Speed not in PLAYBACK_SPEEDS array (indexOf = -1) | Very Low | Low | Speed only set via changePlaybackSpeed which uses the array |

## Definition of Done

- [ ] `<` key decreases playback speed to previous step
- [ ] `>` key increases playback speed to next step
- [ ] Boundary cases announce "Already at min/max speed"
- [ ] Speed changes persist to localStorage
- [ ] `N` key opens notes panel (if closed) and focuses the TipTap editor
- [ ] `N` key does NOT fire when typing in an input/contenteditable
- [ ] Video continues playing when notes receive focus
- [ ] Shortcuts overlay shows `<`/`>` and `N` entries
- [ ] All ARIA announcements present for new shortcuts
- [ ] E2E tests pass for all acceptance criteria
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)
