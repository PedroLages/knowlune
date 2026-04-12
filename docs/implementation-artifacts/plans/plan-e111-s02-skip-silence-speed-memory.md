# Implementation Plan: E111-S02 — Skip Silence and Speed Memory

## Context

This story delivers two related but distinct features for the audiobook player:

1. **Skip Silence (AC-1 through AC-4, AC-8)**: Wire the existing `skipSilence` toggle (currently a non-functional placeholder with "Coming soon" badge from E108-S04) to actual Web Audio API silence detection using an `AnalyserNode` connected to the singleton `HTMLAudioElement`. When enabled, the system monitors audio levels in real-time and automatically skips past silence segments exceeding 500ms below a threshold. A transient visual indicator shows each skip.

2. **Per-Book Speed Memory (AC-5 through AC-7, AC-8)**: Currently, playback speed is stored globally in `useAudioPlayerStore.playbackRate`. This story adds a `playbackSpeed` field to the `Book` type so each book remembers its preferred speed. When a user switches between books, each one restores its saved speed. First-open books fall back to the global `defaultSpeed` from `useAudiobookPrefsStore`.

Both features address listener efficiency and personalization. The skip silence feature has been awaited since E108-S04 when the toggle UI was built with `disabled` and "Coming soon" annotation. Per-book speed was explicitly noted in the E110 retro as "minimal infrastructure."

---

## Implementation Steps

### Step 1: Add `playbackSpeed` field to the `Book` type

**File to modify**: `src/data/types.ts`

- Add `playbackSpeed?: number` as an optional field on the `Book` interface (after `seriesSequence`, around line 738).
- This is a data-only field, no Dexie index needed (we never query by speed). No Dexie migration required since Dexie does not enforce column schemas on non-indexed fields; adding an optional property to the TypeScript type is sufficient.

**Scope**: Minimal (1 line addition). No breaking changes since the field is optional.

### Step 2: Add `updateBookPlaybackSpeed` action to `useBookStore`

**File to modify**: `src/stores/useBookStore.ts`

- Add a new action `updateBookPlaybackSpeed(bookId: string, speed: number): Promise<void>` to the store interface (around line 53, after `updateBookMetadata`).
- Implement it following the optimistic update + Dexie persist pattern already used by `updateBookPosition` (line 304):
  - Optimistic Zustand update: `set(state => ({ books: state.books.map(b => b.id === bookId ? { ...b, playbackSpeed: speed, updatedAt: now } : b) }))`
  - Dexie persist: `db.books.update(bookId, { playbackSpeed: speed, updatedAt: now })`
  - On failure: rollback from DB, log error, show toast.

**Reuse**: Follow the exact same optimistic-update-with-rollback pattern from `updateBookMetadata` (line 282) and `updateBookPosition` (line 304).

**Scope**: Small (~20 lines of new code).

### Step 3: Wire per-book speed into `SpeedControl`

**File to modify**: `src/app/components/audiobook/SpeedControl.tsx`

- Add `bookId: string` prop to `SpeedControl`.
- On speed selection: in addition to calling `setPlaybackRate(rate)`, also call `useBookStore.getState().updateBookPlaybackSpeed(bookId, rate)`.
- Add `data-testid="speed-button"` to the `PopoverTrigger` `Button` (the E2E tests expect this).
- Add `data-testid={`speed-option-${rate}`}` to each speed option button (the E2E tests expect `speed-option-1.5`, `speed-option-2`, etc.).

**File to modify**: `src/app/components/audiobook/AudiobookRenderer.tsx`

- Pass `bookId={book.id}` to `<SpeedControl />` (line 433).

**Scope**: Small (~10 lines of changes across two files).

### Step 4: Modify `useAudiobookPrefsEffects` Effect 1 for per-book speed restore

**File to modify**: `src/app/hooks/useAudiobookPrefsEffects.ts`

The current Effect 1 (lines 46-56) applies the global `defaultSpeed` on new book open. It needs to become per-book speed aware:

- Accept a new parameter `book: Book` (or at minimum the full book object) instead of just `bookId: string` in the hook params interface.
- In Effect 1, change the logic:
  1. Check `book.playbackSpeed` first. If it exists and is a valid speed, apply it.
  2. Otherwise, fall back to `useAudiobookPrefsStore.getState().defaultSpeed` (current behavior).
  3. Always call `useAudioPlayerStore.getState().setPlaybackRate(resolvedSpeed)`.

**File to modify**: `src/app/components/audiobook/AudiobookRenderer.tsx`

- Update the `useAudiobookPrefsEffects` call to pass the full `book` object (or a prop including `book.playbackSpeed`) instead of just `book.id` as `bookId`.

**Reuse**: The `VALID_SPEEDS` set from `useAudiobookPrefsStore` can be used for validation.

**Scope**: Small (~15 lines changed).

### Step 5: Create the `useSilenceDetection` hook (new file)

**File to create**: `src/app/hooks/useSilenceDetection.ts`

This is the core new module. It bridges the Web Audio API to the singleton `HTMLAudioElement`.

**Design**:
```typescript
interface UseSilenceDetectionParams {
  enabled: boolean        // skipSilence pref state
  audioRef: RefObject<HTMLAudioElement | null>
  isPlaying: boolean
}

interface UseSilenceDetectionReturn {
  /** Whether silence detection is currently active */
  isActive: boolean
  /** Transient skip info for the visual indicator, null when no recent skip */
  lastSkip: { durationSeconds: number; timestamp: number } | null
}
```

**Implementation approach (following "Start Simple, Escalate If Needed" from engineering-patterns.md)**:

1. **AudioContext + MediaElementSourceNode + AnalyserNode**: Create an `AudioContext` and connect the singleton audio element via `createMediaElementSource()`. This call can only be made ONCE per element (critical constraint). Use a module-level ref guard (`let _mediaSource: MediaElementAudioSourceNode | null = null`) to ensure single creation.

2. **`AnalyserNode`**: Create an `AnalyserNode` with `fftSize: 2048`, connect `mediaSource -> analyser -> ctx.destination` (must reconnect to destination or audio output is lost).

3. **Silence detection loop** (using `requestAnimationFrame`):
   - Get time-domain data via `analyser.getByteTimeDomainData(dataArray)`.
   - Calculate RMS amplitude. If RMS < threshold (e.g., 0.01 or ~-40dB), mark as silence.
   - Track consecutive silence duration. When silence exceeds 500ms, calculate the skip target time and `audio.currentTime = skipTarget`.
   - Set `lastSkip` state with the duration for the visual indicator.

4. **Cleanup**: On `enabled` becoming false or unmount:
   - Stop the rAF loop.
   - Disconnect the analyser. Do NOT close the `AudioContext` (it can be resumed later).
   - The `MediaElementSourceNode` stays alive (can't re-create it).

**Key constraint**: `createMediaElementSource()` can only be called once per `HTMLAudioElement`. The module-level guard `_mediaSource` persists across React re-renders and component unmounts. If the source was already created, reuse it.

**Scope**: Medium (~100-120 lines). This is the largest single piece of new code.

### Step 6: Create the `SilenceSkipIndicator` component (new file)

**File to create**: `src/app/components/audiobook/SilenceSkipIndicator.tsx`

A small, transient visual indicator that shows when a silence skip occurs.

**Design**:
- Accept `lastSkip: { durationSeconds: number; timestamp: number } | null` prop.
- When `lastSkip` changes (new skip), show a subtle badge/toast-like element (e.g., "Skipped 2.3s silence") that fades out after ~2 seconds using CSS animation.
- Use `data-testid="silence-skip-indicator"` for E2E test targeting.
- Include `aria-live="polite"` for screen reader announcement.

**Styling**: Use design tokens: `bg-brand-soft`, `text-brand-soft-foreground`, standard rounded-full pill shape. Follow the badge pattern from the bookmark count badge in AudiobookRenderer.

**Scope**: Small (~40 lines).

### Step 7: Create the `SkipSilenceActiveIndicator` component (new file)

**File to create**: `src/app/components/audiobook/SkipSilenceActiveIndicator.tsx`

A small persistent indicator shown when skip silence is active, so the user knows the feature is running.

- Accept `isActive: boolean` prop.
- When active, render a small pill/badge near the playback controls (e.g., a subtle "Skip Silence" label or icon).
- Use `data-testid="skip-silence-active-indicator"` for E2E test targeting.
- Include appropriate ARIA attributes.

**Scope**: Small (~25 lines).

### Step 8: Integrate silence detection into `AudiobookRenderer`

**File to modify**: `src/app/components/audiobook/AudiobookRenderer.tsx`

- Import `useSilenceDetection` and the two new indicator components.
- Read `skipSilence` from `useAudiobookPrefsStore`.
- Call `useSilenceDetection({ enabled: skipSilence, audioRef, isPlaying })`.
- Render `<SkipSilenceActiveIndicator isActive={silenceDetection.isActive} />` near the secondary controls bar (around line 432).
- Render `<SilenceSkipIndicator lastSkip={silenceDetection.lastSkip} />` as a floating/absolute element positioned near the player.

**Note**: KI-057 warns about pre-existing TypeScript errors in AudiobookRenderer. Be aware but do not fix unrelated issues.

**Scope**: Small (~10 lines of integration).

### Step 9: Update `AudiobookSettingsPanel` to remove placeholder state

**File to modify**: `src/app/components/audiobook/AudiobookSettingsPanel.tsx`

- Remove the `disabled` attribute from the skip silence `Switch` (line 129).
- Remove the "Coming soon" badge `<span>` (lines 114-116).
- Remove the `opacity-60` class from the container `<div>` (line 110).
- Update the description text to remove "not yet available" (line 119-120).
- Update the `aria-label` to remove "(coming soon)" (line 128).

**Scope**: Small (delete/modify ~10 lines).

### Step 10: Add keyboard shortcut for skip silence toggle

**File to modify**: `src/app/components/audiobook/AudiobookRenderer.tsx`

- Add a new keyboard shortcut entry in the `useKeyboardShortcuts` array (around line 277) for toggling skip silence (e.g., key `s`):
  ```
  { key: 's', description: 'Toggle skip silence', action: () => useAudiobookPrefsStore.getState().toggleSkipSilence() }
  ```
  
This satisfies AC-8 (keyboard accessibility for skip silence).

**Scope**: Minimal (3 lines).

### Step 11: Update E2E tests to align with implementation

**File**: `tests/e2e/story-e111-s02.spec.ts`

The ATDD tests are already written. Minor adjustments may be needed after implementation:
- Ensure the `mockAudioElement` pattern is used (borrowed from `tests/e2e/audiobookshelf/bookmarks.spec.ts`) since headless browsers cannot play audio.
- For silence detection tests (AC-1, AC-2), either mock the `AudioContext`/`AnalyserNode` to simulate silence detection, or test that the UI elements appear correctly when skip silence is toggled (component-state testing, not actual audio analysis).
- For per-book speed tests (AC-5, AC-6, AC-7), the existing test logic references `speed-button` and `speed-option-*` test IDs that Step 3 adds.

**Scope**: Medium (may need mock setup code for WebAudio in tests).

---

## Verification

### Dev Server Manual Testing

1. **Skip Silence**:
   - Open an audiobook, open settings, toggle skip silence ON.
   - Verify the "Coming soon" badge is gone and the toggle is enabled.
   - Verify the `SkipSilenceActiveIndicator` appears when enabled.
   - Play audio with intentional silence pauses; verify the player skips past them.
   - Verify the `SilenceSkipIndicator` shows "Skipped X.Xs silence" briefly.
   - Toggle OFF; verify indicator disappears and silence is no longer skipped.

2. **Per-Book Speed Memory**:
   - Open book A, set speed to 1.5x.
   - Navigate to book B, set speed to 2x.
   - Navigate back to book A; verify speed shows 1.5x.
   - Open a brand new book (never opened before); verify it uses the global default speed from settings.

3. **Accessibility**:
   - Navigate all controls via keyboard only (Tab, Enter, Space, arrow keys).
   - Test with a screen reader (VoiceOver on macOS) to verify ARIA labels are announced.
   - Verify focus indicators visible on speed options and skip silence toggle.

### E2E Tests

```bash
npx playwright test tests/e2e/story-e111-s02.spec.ts
```

### Type Checking and Lint

```bash
npx tsc --noEmit
npx eslint src/app/hooks/useSilenceDetection.ts src/app/components/audiobook/SilenceSkipIndicator.tsx src/app/components/audiobook/SkipSilenceActiveIndicator.tsx
```

---

## Risk Assessment

### Risk 1: `createMediaElementSource()` One-Shot Constraint (HIGH)

**Problem**: The Web Audio API's `createMediaElementSource()` can only be called once per `HTMLAudioElement`. The singleton audio element (`_sharedAudio` in `useAudioPlayer.ts`) survives route changes. If `createMediaElementSource` is called again (e.g., after navigating away and back), it throws `InvalidStateError`.

**Mitigation**: Use a module-level guard variable (`let _mediaSource: MediaElementAudioSourceNode | null = null`) outside any React component. Check this guard before creating the source. Once created, the source persists for the lifetime of the audio element. The `AnalyserNode` can be disconnected/reconnected freely.

**Rollback**: If the Web Audio approach proves unreliable across browsers, fall back to a simpler approach: periodic sampling of `audio.currentTime` progress (if `currentTime` does not advance for >500ms while `isPlaying`, treat as silence). This is less accurate but has zero Web Audio API dependency.

### Risk 2: AudioContext Suspended State

**Problem**: Browsers suspend `AudioContext` until a user gesture occurs. If the context is created before the user taps play, `analyser.getByteTimeDomainData()` returns all-128 (silence) even if audio is playing.

**Mitigation**: Only create/resume the `AudioContext` when both `enabled` and `isPlaying` are true. The play button click satisfies the user gesture requirement. Call `audioContext.resume()` on each activation.

### Risk 3: Wide Blast Radius Across Audiobook Subsystem

**Problem**: This story touches ~6 existing files (types, book store, player store, prefs effects, speed control, settings panel, renderer) plus creates 3 new files. Any regression in the audiobook playback pipeline is high-impact.

**Mitigation**: Granular commits (see commit strategy below) so each change can be isolated and reverted independently. The per-book speed feature is fully independent from skip silence and can be merged separately if one feature has issues.

**Pattern references**:
- Optimistic UI with Rollback (engineering-patterns.md)
- Ref Guard for One-Shot Actions (engineering-patterns.md)
- useEffect Cleanup (engineering-patterns.md)
- Start Simple, Escalate If Needed (engineering-patterns.md)

---

## Commit Strategy

Each commit is a granular save point that leaves the codebase in a compilable, non-breaking state:

1. **Commit 1 (data layer)**: Add `playbackSpeed?: number` to `Book` type + `updateBookPlaybackSpeed` action to `useBookStore`.
   - Files: `src/data/types.ts`, `src/stores/useBookStore.ts`
   - Safe: optional field, new action, no consumers yet.

2. **Commit 2 (per-book speed wiring)**: Wire `SpeedControl` to save per-book speed + add test IDs. Update `useAudiobookPrefsEffects` Effect 1 to restore per-book speed. Pass `bookId` through `AudiobookRenderer`.
   - Files: `src/app/components/audiobook/SpeedControl.tsx`, `src/app/hooks/useAudiobookPrefsEffects.ts`, `src/app/components/audiobook/AudiobookRenderer.tsx`
   - Satisfies: AC-5, AC-6, AC-7

3. **Commit 3 (silence detection hook)**: Create `useSilenceDetection` hook with Web Audio AnalyserNode.
   - Files: `src/app/hooks/useSilenceDetection.ts` (new)
   - Safe: new file, no consumers yet.

4. **Commit 4 (silence UI components)**: Create `SilenceSkipIndicator` and `SkipSilenceActiveIndicator` components.
   - Files: `src/app/components/audiobook/SilenceSkipIndicator.tsx` (new), `src/app/components/audiobook/SkipSilenceActiveIndicator.tsx` (new)
   - Safe: new files, no consumers yet.

5. **Commit 5 (silence integration)**: Wire silence detection into `AudiobookRenderer`, update `AudiobookSettingsPanel` to remove placeholder, add keyboard shortcut.
   - Files: `src/app/components/audiobook/AudiobookRenderer.tsx`, `src/app/components/audiobook/AudiobookSettingsPanel.tsx`
   - Satisfies: AC-1, AC-2, AC-3, AC-4, AC-8

6. **Commit 6 (tests)**: Update E2E test file if adjustments are needed for mock setup.
   - Files: `tests/e2e/story-e111-s02.spec.ts`
