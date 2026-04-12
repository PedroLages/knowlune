# OpenAI Adversarial Code Review — E111-S02: Skip Silence and Speed Memory

**Date:** 2026-04-12
**Story:** E111-S02 — Skip Silence and Speed Memory for Audiobook Player
**Reviewer:** Orion (openai-code-review agent)
**Model:** Internal adversarial review (OpenAI API: insufficient_quota — fallback to direct analysis)
**Scope:** `src/app/hooks/useSilenceDetection.ts`, `src/app/hooks/useAudiobookPrefsEffects.ts`, `src/app/components/audiobook/AudiobookSettingsPanel.tsx`, `src/app/components/audiobook/SpeedControl.tsx`, `src/app/components/audiobook/SilenceSkipIndicator.tsx`, `src/app/components/audiobook/SkipSilenceActiveIndicator.tsx`, `src/app/components/audiobook/AudiobookRenderer.tsx`, `tests/e2e/story-e111-s02.spec.ts`, `src/app/hooks/__tests__/useSilenceDetection.test.ts`

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | 0     |
| HIGH     | 2     |
| MEDIUM   | 3     |
| NIT      | 3     |
| **Total**| **8** |

**Overall status:** WARNINGS

---

## Findings

### HIGH-1 — Module-level AudioContext shared across all component instances leaks on src change

**File:** `src/app/hooks/useSilenceDetection.ts` (lines 21–23)

`_audioCtx`, `_mediaSource`, and `_analyser` are module-level singletons. `createMediaElementSource()` is called once and the node is permanently connected to `_audioCtx.destination`. If the user navigates between two different audiobooks (different `HTMLAudioElement` instances), the second mount silently skips `_mediaSource` creation because `_mediaSource !== null` — but `_mediaSource` still points to the first book's element. Audio from the second book therefore bypasses the analyser entirely, meaning silence detection runs forever against a stale source while outputting nothing (the analyser reads zeroed-out buffers from a disconnected source). The silence-skip loop will never trigger a skip for the second book, but also never exit skip-mode if it entered it for the first book.

**Suggestion:** Store `_mediaSourceElement` (the `HTMLAudioElement` reference) alongside `_mediaSource`. On mount, if `audioRef.current !== _mediaSourceElement`, treat the context as stale: disconnect, null-out `_mediaSource` and `_analyser`, and reconnect for the new element. A closed-context check already handles the `AudioContext` GC case; the same pattern should guard element identity.

---

### HIGH-2 — `SpeedControl` SPEED_OPTIONS and `useAudiobookPrefsStore` VALID_SPEEDS diverge silently

**File:** `src/app/components/audiobook/SpeedControl.tsx` (line 19) vs `src/stores/useAudiobookPrefsStore.ts` (line 42)

`SpeedControl` hard-codes `[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]` (9 entries, missing 2.25 and 2.75). `VALID_SPEEDS` in the prefs store has 11 entries including 2.25 and 2.75. `updateBookPlaybackSpeed` in `useBookStore` validates against its own independent range `[0.5–3.0]` (continuous, not set-based), so 2.25/2.75 are writable via the prefs default-speed picker but never reachable from the in-player speed control. If a user sets the default to 2.25x via AudiobookSettingsPanel, the player UI will apply it on load (per-book restore), but the SpeedControl popover will show no checked option for that speed because 2.25 is absent from its list. This causes confusing silent desync — the speed is playing at 2.25x but no option appears selected.

`AudiobookSettingsPanel` correctly imports `VALID_SPEEDS` from the store, which is the intended single source of truth. `SpeedControl` should do the same.

**Suggestion:** Replace the local `SPEED_OPTIONS` constant in `SpeedControl.tsx` with `import { VALID_SPEEDS } from '@/stores/useAudiobookPrefsStore'`.

---

### MEDIUM-1 — `SkipSilenceActiveIndicator` receives `isActive={skipSilence}` (preference) instead of `silenceDetection.isActive` (runtime state)

**File:** `src/app/components/audiobook/AudiobookRenderer.tsx` (line 448)

```tsx
<SkipSilenceActiveIndicator isActive={skipSilence} />
```

`skipSilence` is the stored preference (true if the user has enabled the feature). `silenceDetection.isActive` is only `true` when the AudioContext is also running and `isPlaying` is true. The indicator therefore lights up as soon as the toggle is flipped — even before the user presses Play, and while the AudioContext is still suspended. This misleads the user into thinking detection is running when it is not. The `isActive` return from `useSilenceDetection` was designed for exactly this purpose (it is set only inside the `enabled && isPlaying` branch).

**Suggestion:** Change to `<SkipSilenceActiveIndicator isActive={silenceDetection.isActive} />`.

---

### MEDIUM-2 — `lastSkip.timestamp` uses `Date.now()` inside the detection loop (non-deterministic in tests)

**File:** `src/app/hooks/useSilenceDetection.ts` (line 129)

```ts
setLastSkip({
  durationSeconds: Math.max(0, endPos - startPos),
  timestamp: Date.now(),
})
```

`timestamp` is set inside the RAF loop with `Date.now()`. The test suite (`useSilenceDetection.test.ts`) only tests `calculateRms` and does not exercise the hook loop, so this is not caught. The ESLint `test-patterns/deterministic-time` rule targets test files, not source files, so it passes. In practice `timestamp` is used downstream by `SilenceSkipIndicator` only to detect "new" skips via `useEffect([lastSkip])` — the actual value is ignored. The `Date.now()` is therefore harmless at runtime but is a latent footgun: any future consumer of `SilenceSkip.timestamp` (e.g. analytics, duration display) will be non-deterministic. `performance.now()` is already used for `silenceStartRef` — consistency would improve auditability.

**Suggestion:** Replace `Date.now()` with `performance.now()` or a monotonic epoch offset, matching the rest of the timing logic in the hook. Document the choice in the `SilenceSkip` interface comment.

---

### MEDIUM-3 — RAF tick allocates a new `Uint8Array(FFT_SIZE)` inside the closure, not inside the loop

**File:** `src/app/hooks/useSilenceDetection.ts` (lines 89–142)

`const dataArray = new Uint8Array(FFT_SIZE)` is declared once in `runDetectionLoop` before the `tick` closure — this is good. However, `runDetectionLoop` is recreated every time its `useCallback` deps change (currently `[audioRef]`). Because `audioRef` is a stable ref object, this is effectively stable, but if deps were ever extended the array would be reallocated without the tick loop being aware. More concretely: calling `stopLoop` + `runDetectionLoop` (which happens on every enable/disable cycle) recreates the `dataArray`. Minor allocation pressure in a RAF loop. Move `dataArray` to a `useRef` allocated once on component mount.

---

### NIT-1 — `formatSpeed` functions in `SpeedControl` and `AudiobookSettingsPanel` are duplicated with subtle difference

**File:** `src/app/components/audiobook/SpeedControl.tsx` (line 21), `src/app/components/audiobook/AudiobookSettingsPanel.tsx` (line 44)

`SpeedControl.formatSpeed`: `` `${rate % 1 === 0 ? rate.toFixed(1) : rate}×` ``
`AudiobookSettingsPanel.formatSpeed`: `` `${Number.isInteger(rate) ? rate.toFixed(1) : rate}x` ``

Two issues: (1) the unicode multiplication sign `×` vs ASCII `x` means the labels differ, and (2) the integer check differs (`rate % 1 === 0` vs `Number.isInteger(rate)` — both correct for valid speeds but semantically different). Extract to a shared utility.

---

### NIT-2 — E2E test AC-7 seeds `defaultSpeed` but does not set `skipSilence` field, relying on missing-key fallback

**File:** `tests/e2e/story-e111-s02.spec.ts` (lines 183–185)

```ts
localStorage.setItem(key, JSON.stringify({ defaultSpeed: 1.25, skipSilence: false }))
```

The prefs store hydration code reads from `parsed.defaultSpeed` directly without schema validation of the full object. If `skipSilence` is later removed from the schema or renamed, this test will silently pass against a store that ignored the seed. The seed should match the full expected shape or use a typed factory function.

---

### NIT-3 — `handleBookmarkDeleted` in `AudiobookRenderer` captures stale `onBookmarkChange` ref

**File:** `src/app/components/audiobook/AudiobookRenderer.tsx` (lines 133–139)

```tsx
const handleBookmarkDeleted = useCallback((bookmarkId: string) => {
  setSessionBookmarkIds(prev => {
    const next = new Set(prev)
    next.delete(bookmarkId)
    onBookmarkChange?.()   // ← called inside setState updater
    return next
  })
}, [])  // ← empty deps, onBookmarkChange not listed
```

`onBookmarkChange` is called inside the `setState` updater, which is an anti-pattern — side effects inside updaters are not safe in concurrent React. It also captures the initial `onBookmarkChange` value because the dep array is empty. Should be moved outside the updater and added to deps.

---

## Non-Issues Noted

- Module-level guard pattern for `createMediaElementSource` is well-documented and correct for its stated purpose (guard against `InvalidStateError`).
- `stopLoop`/cleanup in `useSilenceDetection` correctly avoids disconnecting the analyser to prevent audio glitches — the comment is accurate.
- `useAudiobookPrefsEffects` correctly uses `getState()` inside effects to avoid stale closures on preference values.
- `SilenceSkipIndicator` correctly keeps the element in the DOM (not conditionally rendered) to support E2E test attachment.
- Per-book speed rollback in `updateBookPlaybackSpeed` is well-implemented.
