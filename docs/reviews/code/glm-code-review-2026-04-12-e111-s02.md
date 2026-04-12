## External Code Review: E111-S02 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-12
**Story**: E111-S02

### Findings

#### Blockers
- **`src/app/hooks/useSilenceDetection.ts:78-95` (confidence: 92)**: **Infinite silence skip loop.** Once silence exceeds 500ms and `audio.currentTime` is advanced by `SKIP_LOOKAHEAD_S` (0.1s), the audio is still in the silent region (silence segments are typically many seconds long). The code resets `silenceStartRef.current = null` and immediately starts tracking again. On the next animation frame (~16ms later), silence is still detected, and after another ~500ms, another skip of 0.1s fires. This creates an infinite loop of tiny 0.1s skips (roughly 6 skips/second) until non-silent audio is reached. This produces constant UI flashing ("Skipped 0.5s silence" ~6 times/second), rapid seeking that degrades audio playback, and high CPU usage. Fix: After a skip, continue scanning forward to find non-silent audio (or jump by a much larger increment like 5–10 seconds), or implement a cooldown that prevents re-triggering for several seconds after a skip.

#### High Priority
- **`src/app/hooks/useSilenceDetection.ts:117-125` (confidence: 85)**: **Module-level singletons coupled to per-element instance — cross-element contamination.** `_mediaSource`, `_audioCtx`, and `_analyser` are module-level singletons, but `createMediaElementSource(audio)` binds to a specific `HTMLAudioElement`. If `useSilenceDetection` is ever used with a different audio element (e.g., app switches audio elements, or HMR replaces the component with a different ref), `_mediaSource` is non-null so it won't be recreated, but it's still connected to the old element. The `_analyser` is also never disconnected/reconnected. Fix: Track which element `_mediaSource` is bound to (e.g., `let _sourceElement: HTMLAudioElement | null = null`) and verify it matches `audioRef.current` before reusing. Alternatively, reset all module-level state when a different element is detected.

- **`src/app/hooks/useAudiobookPrefsEffects.ts:58-61` (confidence: 82)**: **`book.playbackSpeed` in dependency array causes re-application on every speed change.** When the user changes speed via `SpeedControl`, the optimistic store update changes `book.playbackSpeed`, which triggers this effect (since `book.playbackSpeed` is in the dep array). The effect's guard (`defaultSpeedAppliedForBookRef.current === book.id`) returns early, but that's only because it was already set. However, if `book.playbackSpeed` changes from `undefined` to a value (first speed change on a book), the dep array change fires the effect — which runs `setPlaybackRate(resolvedSpeed)` with the same value the user just set, creating a no-op but unnecessary effect execution. More critically, if the book object reference changes due to an unrelated field update, the effect could re-fire. Fix: Remove `book.playbackSpeed` from the dependency array and read it via a ref or inside the effect from the store. The effect should only fire when `book.id` changes.

- **`src/app/components/audiobook/SilenceSkipIndicator.tsx:43-49` (confidence: 75)**: **`opacity: 0` elements with `aria-live="polite"` cause ghost screen reader announcements.** When `visible` is `false`, the indicator div still has `aria-live="polite"` and `aria-atomic="true"`, and the `displayText` span remains in the DOM. Screen readers may announce stale "Skipped Xs silence" text when other DOM changes occur nearby, since `aria-live` regions are monitored for any change. Fix: Only render `aria-live="polite"` when `visible` is true, or clear `displayText` when `visible` becomes false, or use `aria-hidden` when not visible.

#### Medium
- **`src/app/hooks/useSilenceDetection.ts:133` (confidence: 72)**: **AnalyserNode is never disconnected — `isActive` may be incorrect across sessions.** The cleanup function explicitly does NOT disconnect `_analyser` (comment says "disconnecting and reconnecting causes audio glitches"). But `_analyser` persists as a module-level singleton forever. If `enabled` becomes true again after being false, the existing analyser is reused, which is fine. However, if the `AudioContext` is closed by the browser (e.g., after extended inactivity), `_audioCtx` will be in a `'closed'` state and all operations on it will fail silently. Fix: Add a check for `_audioCtx.state === 'closed'` and reset all module-level singletons to null if so, forcing re-creation.

- **`src/app/hooks/useSilenceDetection.ts:46-48` (confidence: 68)**: **`SKIP_LOOKAHEAD_S = 0.1` is too small to be useful.** A 0.1 second skip means the algorithm must detect silence, skip 0.1s, re-detect silence, wait another 500ms, skip another 0.1s. For a 10-second silence gap, this triggers ~15 skip events. Combined with Finding #1 (the infinite loop), this is largely moot, but even with a proper implementation, 0.1s is an unreasonably small skip distance. Fix: Use a larger skip amount (e.g., 2–5 seconds) and optionally scan forward to find non-silent audio.

#### Nits
- **`src/app/hooks/useAudiobookPrefsEffects.ts:60` (confidence: 55)**: The comment says "Reads from get() inside the callback to avoid stale closure on book.playbackSpeed" but the effect directly references `book.playbackSpeed` from the outer scope (the destructured prop), not from any `get()` call. The comment is misleading.

---
Issues found: 7 | Blockers: 1 | High: 3 | Medium: 2 | Nits: 1
