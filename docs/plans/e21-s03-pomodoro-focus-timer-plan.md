# E21-S03: Pomodoro Focus Timer — Implementation Plan

**Story:** As a learner practicing sustained study sessions, I want a Pomodoro timer (25min focus / 5min break) integrated in the lesson player, so that I maintain optimal focus and avoid burnout.

**Estimated Effort:** 4 hours
**Created:** 2026-03-23

---

## Architecture Overview

The Pomodoro timer is a self-contained feature with three layers:

1. **Hook** (`usePomodoroTimer`) — drift-free countdown logic with phase management
2. **Component** (`PomodoroTimer`) — popover UI with controls, counter, and preferences
3. **Integration** — timer button in LessonPlayer header, audio system, localStorage persistence

```
LessonPlayer.tsx
  └── PomodoroTimer.tsx (Popover)
        ├── usePomodoroTimer.ts (hook)
        ├── pomodoroAudio.ts (Web Audio API chime)
        └── localStorage (pomodoro-preferences)
```

No database schema changes required. No new Zustand stores — this is a local-only feature using a React hook + localStorage.

---

## Step 1: Create `usePomodoroTimer` Hook

**File:** `src/hooks/usePomodoroTimer.ts`
**AC:** 1, 2, 3, 4, 5

### Design Decisions

**Follow `useQuizTimer` pattern** (`src/hooks/useQuizTimer.ts`):
- Drift-free countdown anchored to `Date.now()` (not decrementing counter)
- `visibilitychange` listener for tab-return accuracy
- Refs for callbacks to avoid stale closures

**State machine with 3 phases:**
```
idle → focus → break → focus → break → ...
         ↑       ↓
         └───────┘  (cycle increments on break→focus transition)

Any phase → idle (via reset)
Any running phase can be paused/resumed
```

### Interface

```typescript
type PomodoroPhase = 'idle' | 'focus' | 'break'
type PomodoroStatus = 'stopped' | 'running' | 'paused'

interface PomodoroState {
  phase: PomodoroPhase
  status: PomodoroStatus
  timeRemaining: number        // seconds
  completedSessions: number    // count of completed focus+break cycles
}

interface PomodoroActions {
  start: () => void            // Start focus timer from idle/stopped
  pause: () => void            // Pause running timer
  resume: () => void           // Resume paused timer
  reset: () => void            // Reset to idle state
  skip: () => void             // Skip current phase (focus→break or break→focus)
}

interface UsePomodoroTimerOptions {
  focusDuration?: number       // seconds, default 25*60
  breakDuration?: number       // seconds, default 5*60
  onFocusComplete?: () => void // callback when focus phase ends
  onBreakComplete?: () => void // callback when break phase ends
  autoStartBreak?: boolean     // auto-start break after focus (default: true)
  autoStartFocus?: boolean     // auto-start next focus after break (default: false)
}
```

### Implementation Notes

- Use `useRef` for endTime anchor (not state — avoids re-render loop)
- `setInterval(recalculate, 1000)` with `Math.max(0, Math.floor((endTime - Date.now()) / 1000))`
- On phase transition: clear interval, call callback, start new phase (or go idle)
- `completedSessions` increments when break phase completes (full cycle = focus + break)
- Pause stores `remainingAtPause` and clears interval; resume reanchors endTime

### Key Pattern from `useQuizTimer`

```typescript
// Drift-free: anchor to wall clock, not tick count
const endTime = Date.now() + durationMs
const interval = setInterval(() => {
  const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
  setTimeRemaining(remaining)
  if (remaining === 0 && !hasFiredRef.current) {
    hasFiredRef.current = true
    onPhaseComplete()
  }
}, 1000)
```

---

## Step 2: Create Audio Notification Module

**File:** `src/lib/pomodoroAudio.ts`
**AC:** 7

### Design Decision: Web Audio API vs `<audio>` Element

Use **Web Audio API** for programmatic chime generation:
- No audio file dependency (no asset to load/bundle)
- Precise timing control
- Volume control via GainNode
- Works offline (no network fetch)

### Implementation

```typescript
export function playChime(volume: number = 0.5): void {
  // Create AudioContext on demand (browser requires user gesture first)
  const ctx = new AudioContext()
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.connect(gain)
  gain.connect(ctx.destination)

  // Pleasant two-tone chime: C5 → E5
  oscillator.frequency.value = 523.25 // C5
  gain.gain.value = volume
  oscillator.start()

  // Transition to second tone
  oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15) // E5

  // Fade out
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  oscillator.stop(ctx.currentTime + 0.5)

  // Cleanup
  oscillator.onended = () => ctx.close()
}
```

### Edge Cases

- **AudioContext blocked until user gesture:** The timer requires a button click to start, which satisfies this requirement. No special handling needed.
- **Volume = 0:** Skip audio entirely (check before creating context)
- **Error handling:** Wrap in try/catch — audio failure should never block timer flow

---

## Step 3: Create Pomodoro Preferences (localStorage)

**File:** `src/lib/pomodoroPreferences.ts`
**AC:** 6

### Design Decision: Separate localStorage Key vs Extending AppSettings

Use a **separate localStorage key** (`pomodoro-preferences`):
- Keeps concerns isolated (Pomodoro is optional feature)
- Avoids touching `AppSettings` interface (used across the app)
- Follows `STORAGE_KEY_PLAYBACK_SPEED` pattern from VideoPlayer

### Interface

```typescript
interface PomodoroPreferences {
  focusDuration: number        // minutes (default: 25)
  breakDuration: number        // minutes (default: 5)
  autoStartBreak: boolean      // default: true
  autoStartFocus: boolean      // default: false
  notificationVolume: number   // 0-1 (default: 0.5)
}
```

### Implementation

Follow `src/lib/settings.ts` pattern:
```typescript
const STORAGE_KEY = 'pomodoro-preferences'
const defaults: PomodoroPreferences = { ... }

export function getPomodoroPreferences(): PomodoroPreferences
export function savePomodoroPreferences(prefs: Partial<PomodoroPreferences>): PomodoroPreferences
```

---

## Step 4: Create `PomodoroTimer` Component

**File:** `src/app/components/figma/PomodoroTimer.tsx`
**AC:** 1, 4, 5

### UI Design

Popover anchored to a timer button in the lesson header. Compact, non-intrusive.

```
┌─────────────────────────────┐
│  🍅 Focus Time              │
│                             │
│       24:37                 │  ← Large countdown display
│                             │
│  [⏸ Pause]  [⟲ Reset]      │  ← Control buttons
│  [⏭ Skip]                   │
│                             │
│  Sessions: 3                │  ← Completed cycle count
│                             │
│  ─── Preferences ────       │
│  Focus:  25 min  [+][-]     │
│  Break:   5 min  [+][-]     │
│  Auto-start break: [✓]      │
│  Volume: ━━━━━━━○━━         │
└─────────────────────────────┘
```

### Component Structure

```
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm">
      <Timer className="h-4 w-4" />
      {isRunning && <span>{formatTime(timeRemaining)}</span>}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-72" align="end">
    {/* Phase indicator */}
    {/* Countdown display */}
    {/* Controls */}
    {/* Session counter */}
    {/* Collapsible preferences */}
  </PopoverContent>
</Popover>
```

### Existing Components to Use

| Component | Import | Purpose |
|-----------|--------|---------|
| `Popover` | `@/app/components/ui/popover` | Container |
| `Button` | `@/app/components/ui/button` | Controls |
| `Slider` | `@/app/components/ui/slider` | Volume control |
| `Switch` | `@/app/components/ui/switch` | Auto-start toggles |
| `Timer` icon | `lucide-react` | Trigger button icon |
| `formatTime` | `@/hooks/useQuizTimer` | MM:SS formatting |

### Visual States

| Phase | Background | Label | Icon color |
|-------|-----------|-------|------------|
| idle | `bg-card` | "Ready" | `text-muted-foreground` |
| focus | `bg-brand-soft` | "Focus Time" | `text-brand-soft-foreground` |
| break | `bg-success/10` | "Break Time" | `text-success` |

### Accessibility

- `role="timer"` on countdown display
- `aria-live="polite"` on phase indicator
- `aria-label` on all buttons
- Keyboard navigable (Radix Popover handles focus trapping)

---

## Step 5: Integrate into LessonPlayer

**File:** `src/app/pages/LessonPlayer.tsx` (modify)
**AC:** 1

### Placement

Add Pomodoro button in the lesson header toolbar, next to the Notes toggle button:

```tsx
{/* Line ~640: Inside the flex items-center gap-2 div */}
<div className="flex items-center gap-2">
  {/* Mobile lesson list button (existing) */}
  <Sheet>...</Sheet>

  {/* Pomodoro timer — NEW */}
  <PomodoroTimer />

  {/* Notes toggle — desktop only (existing) */}
  {isDesktop && !isTheaterMode && (
    <Button ...>Notes</Button>
  )}
</div>
```

### Integration with Study Session Tracking

The Pomodoro timer is **independent** of the study session tracking system:
- Study sessions track time spent on content (video/PDF)
- Pomodoro tracks focus/break cycles as a productivity tool
- They coexist: the study session heartbeat continues during Pomodoro focus periods
- The Pomodoro break does NOT pause the study session (user may still be reviewing notes)

### Theater Mode

The Pomodoro timer button stays visible in theater mode (it's in the lesson header which is always visible).

---

## Step 6: Write Tests

### Unit Tests

**File:** `src/hooks/__tests__/usePomodoroTimer.test.ts`

Test cases:
1. Initial state is idle with correct duration
2. Start transitions to focus phase with countdown
3. Focus countdown reaches 0 → fires onFocusComplete callback
4. Auto-start break after focus (when enabled)
5. Break countdown reaches 0 → fires onBreakComplete, increments session count
6. Pause freezes countdown, resume continues from paused position
7. Reset returns to idle state, clears session count
8. Skip advances to next phase
9. Drift-free: uses Date.now() anchoring (mock with vi.useFakeTimers)

**Testing approach:** Follow `src/hooks/__tests__/useQuizTimer.test.ts` patterns:
- `vi.useFakeTimers()` / `vi.advanceTimersByTime(ms)`
- `renderHook()` from `@testing-library/react`
- `act()` wrapper for state updates

### E2E Tests

**File:** `tests/e2e/regression/story-e21-s03.spec.ts`

Test cases (mapped to ACs):
1. **AC1:** Timer button visible in lesson player → click opens popover with "25:00"
2. **AC2:** Start timer → verify countdown decreasing → verify phase change at 0
3. **AC3:** Break timer completes → session counter shows "1 session"
4. **AC5:** Start/pause/resume/reset controls work correctly
5. **AC6:** Change preferences → reload page → preferences restored
6. **AC7:** Audio notification fires (verify AudioContext creation via page.evaluate)

**E2E time simulation strategy:**
- Use `page.evaluate(() => Date.now = ...)` to mock time advancement
- Or start with very short durations (e.g., 3-second focus) via preferences for E2E
- Test actual countdown with short durations to avoid 25-minute test waits

---

## File Manifest

### New Files (5)

| File | Type | Purpose |
|------|------|---------|
| `src/hooks/usePomodoroTimer.ts` | Hook | Drift-free countdown with phase management |
| `src/lib/pomodoroAudio.ts` | Utility | Web Audio API chime generation |
| `src/lib/pomodoroPreferences.ts` | Utility | localStorage preference persistence |
| `src/app/components/figma/PomodoroTimer.tsx` | Component | Popover UI with controls |
| `tests/e2e/regression/story-e21-s03.spec.ts` | Test | E2E acceptance tests |

### Modified Files (1)

| File | Change |
|------|--------|
| `src/app/pages/LessonPlayer.tsx` | Add `<PomodoroTimer />` to lesson header toolbar |

### Optional New File (1)

| File | Type | Purpose |
|------|------|---------|
| `src/hooks/__tests__/usePomodoroTimer.test.ts` | Unit Test | Hook logic tests with fake timers |

### No Changes Needed

| File | Reason |
|------|--------|
| `src/db/schema.ts` | No database changes — Pomodoro is localStorage-only |
| `src/stores/useSessionStore.ts` | Study session tracking is independent |
| `src/lib/settings.ts` | Using separate `pomodoro-preferences` key |
| `src/app/routes.tsx` | No new routes |

---

## Implementation Order

```
Step 1: usePomodoroTimer hook (core logic)          ~1.5h
  └── Unit tests for hook
Step 2: pomodoroAudio.ts (audio notification)       ~15min
Step 3: pomodoroPreferences.ts (localStorage)       ~15min
Step 4: PomodoroTimer.tsx component (UI)            ~1h
Step 5: LessonPlayer.tsx integration (~5 lines)     ~15min
Step 6: E2E tests                                   ~45min
```

**Total: ~4 hours**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Web Audio API blocked by browser autoplay policy | Timer requires user click to start (satisfies gesture requirement) |
| Timer drift on background tabs | Use Date.now() anchoring + visibilitychange (proven in useQuizTimer) |
| E2E tests slow with real 25-min timers | Use short durations (3-5s) in test preferences, or mock Date.now |
| Popover closes on outside click while timer runs | Timer state lives in hook (survives popover close/reopen). Show mini-display on trigger button. |

---

## Design Tokens

All colors use design tokens per project conventions:

| Element | Token |
|---------|-------|
| Focus phase background | `bg-brand-soft` |
| Focus phase text | `text-brand-soft-foreground` |
| Break phase background | `bg-success/10` |
| Break phase text | `text-success` |
| Idle state | `text-muted-foreground` |
| Timer display | `text-foreground` (large, `font-mono`) |
| Session count | `text-muted-foreground` |
