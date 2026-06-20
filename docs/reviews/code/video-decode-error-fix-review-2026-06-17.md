# Code Review: Fix MEDIA_ERR_DECODE Death-Spiral

**Date:** 2026-06-17
**PR:** [#598](https://github.com/PedroLages/knowlune/pull/598) (merged)
**Scope:** 5 files, 75 lines changed
**Base:** `69a04600`

## Intent

Fix MEDIA_ERR_DECODE death-spiral in video playback. Three interrelated bugs from the error-recovery PR (#596):

- **Bug A:** `useVideoFromHandle` cleanup ran `URL.revokeObjectURL` synchronously before React's batched state update could unmount the `<video>` element
- **Bug B:** Error handler only triggered auto-recovery for code 2 (network), not code 3 (decode)
- **Bug C:** Retry button called `videoRef.load()` — reloaded the same dead blob URL

## Findings

### P0 — Critical

#### 1. `setTimeout(0)` races with async `load()`, causing premature blob URL revocation

- **File:** [src/hooks/useVideoFromHandle.ts:88](src/hooks/useVideoFromHandle.ts#L88)
- **Reviewer:** correctness
- **Confidence:** 0.98

**Problem:** The cleanup function schedules `setTimeout(fn, 0)` to distinguish dep-change from unmount. It compares `activeUrlRef.current === urlAtCleanup` to decide whether to revoke. But the new effect's `load()` function is async — it yields at the first `await` (`fileHandle.queryPermission()`). The `setTimeout(0)` fires as the next macrotask, BEFORE any `await` resolves. At that point `activeUrlRef.current` still points to the OLD URL. The check passes and the old URL is revoked while the `<video>` element still references it — causing MEDIA_ERR_DECODE. **This defeats the entire purpose of Fix 1.**

**Reproduction:**
1. User plays a video (blob URL = `url1`)
2. A recovery event fires (handle changes or retryKey increments)
3. Old effect cleanup runs: `cancelled = true`, `setTimeout(revokeUrl1, 0)` scheduled
4. New effect runs: `load()` starts, yields at first `await`
5. `setTimeout(0)` fires: `activeUrlRef.current` is still `url1` (load hasn't progressed) → revokes `url1`
6. Video element's src is now invalid → MEDIA_ERR_DECODE
7. Error handler fires → another recovery attempt → same race → infinite loop

**Fix:**
Move the deferred-revocation logic out of the main effect's cleanup and into a separate `useEffect` with empty deps (genuine-unmount-only). In the main effect's cleanup, only set `cancelled = true` — do not touch any URL.

```typescript
// Main effect (handle, retryKey deps) — handles dep-change and mount
useEffect(() => {
  if (!handle) {
    setState(prev => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
      return { blobUrl: null, error: 'file-not-found', loading: false }
    })
    return
  }

  let cancelled = false

  async function load() {
    // ... existing logic unchanged ...
  }

  load()

  return () => {
    cancelled = true
    // NO revocation here — let the atomic setState updater handle dep changes
    // and let the empty-deps useEffect handle genuine unmount
  }
}, [handle, retryKey])

// Empty-deps effect: cleanup only runs on genuine unmount
useEffect(() => {
  return () => {
    const url = activeUrlRef.current
    if (url) {
      // setTimeout(0) here is safe — there's no competing async effect
      // on unmount (the main effect's cleanup has already set cancelled=true)
      setTimeout(() => {
        if (activeUrlRef.current === url) {
          URL.revokeObjectURL(url)
          activeUrlRef.current = null
        }
      }, 0)
    }
  }
}, [])
```

**Why this works:**
- **Dep-change:** Only the main effect's cleanup runs (sets `cancelled = true`). The empty-deps effect does NOT re-run. The new main effect's `load()` creates a new URL and revokes the old one atomically in the `setState` updater.
- **Genuine unmount:** Both cleanups run. The main cleanup sets `cancelled = true`. The empty-deps cleanup schedules the `setTimeout` — safe here because there's no new `load()` competing. The `activeUrlRef` comparison still guards against Strict Mode double-invocation.

---

### P2 — Moderate

#### 2. Code 3 auto-recovery test doesn't verify error overlay is hidden

- **File:** [src/app/components/figma/__tests__/VideoPlayer.test.tsx:909](src/app/components/figma/__tests__/VideoPlayer.test.tsx#L909)
- **Reviewer:** testing
- **Confidence:** 0.95

**Problem:** The code 3 test only asserts `onRecoveryNeeded` was called — it never checks that the error overlay was suppressed. The code 2 test includes this assertion. Without it, the test would pass even if `handleVideoError` showed the error overlay AND called the callback.

**Fix:** Add `expect(screen.queryByRole('alert')).not.toBeInTheDocument()` after the error event:

```typescript
it('calls onRecoveryNeeded for decode errors (code 3)', () => {
  const onRecoveryNeeded = vi.fn()
  renderPlayer({ onRecoveryNeeded })
  fireLoadedMetadata()

  const video = getVideo()
  Object.defineProperty(video, 'error', {
    configurable: true,
    value: { code: 3 },
  })
  fireEvent.error(video)

  expect(onRecoveryNeeded).toHaveBeenCalledWith(0)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()  // ← add this
})
```

---

#### 3. Retry button with `onRecoveryNeeded` prop — new code path untested

- **File:** [src/app/components/figma/VideoPlayer.tsx:1094](src/app/components/figma/VideoPlayer.tsx#L1094)
- **Reviewer:** testing
- **Confidence:** 0.90

**Problem:** The retry button was changed to call `onRecoveryNeeded(currentPos ?? 0)` when the prop is present. All existing retry button tests render without `onRecoveryNeeded`, so they only exercise the `else` branch (`videoRef.current?.load()`). The recovery path from manual Retry is completely untested.

**Fix:** Add a test that renders VideoPlayer with `onRecoveryNeeded`, triggers a non-recoverable error (code 1), clicks Retry, and asserts `onRecoveryNeeded` was called:

```typescript
it('retry button calls onRecoveryNeeded when prop is provided', () => {
  const onRecoveryNeeded = vi.fn()
  renderPlayer({ onRecoveryNeeded })
  fireLoadedMetadata()

  const video = getVideo()
  // Set currentTime to a known value
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    value: 45,
  })
  // Trigger a non-recoverable error (code 1)
  Object.defineProperty(video, 'error', {
    configurable: true,
    value: { code: 1 },
  })
  fireEvent.error(video)

  const retryButton = screen.getByRole('button', { name: /retry/i })
  fireEvent.click(retryButton)

  expect(onRecoveryNeeded).toHaveBeenCalledWith(45)
  // Error overlay should be hidden after retry
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
```

---

#### 4. Non-finite `currentTime` guard has zero test coverage

- **File:** [src/app/components/figma/VideoPlayer.tsx:557](src/app/components/figma/VideoPlayer.tsx#L557)
- **Reviewer:** testing
- **Confidence:** 0.85

**Problem:** `handleVideoError` has a guard `if (!isFinite(currentPos))` that falls back to the error overlay when currentTime is NaN or Infinity. No test sets up a video element with non-finite currentTime.

**Fix:** Add a test:

```typescript
it('shows error overlay when currentTime is NaN (non-finite guard)', () => {
  const onRecoveryNeeded = vi.fn()
  renderPlayer({ onRecoveryNeeded })
  fireLoadedMetadata()

  const video = getVideo()
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    value: NaN,
  })
  Object.defineProperty(video, 'error', {
    configurable: true,
    value: { code: 2 },
  })
  fireEvent.error(video)

  // Auto-recovery should NOT fire (non-finite position)
  expect(onRecoveryNeeded).not.toHaveBeenCalled()
  // Error overlay should be shown
  expect(screen.getByRole('alert')).toBeInTheDocument()
})
```

---

#### 5. `activeUrlRef.current` not cleared when handle becomes null or permission denied

- **File:** [src/hooks/useVideoFromHandle.ts:23](src/hooks/useVideoFromHandle.ts#L23)
- **Reviewer:** correctness
- **Confidence:** 0.85

**Problem:** When handle becomes null or permission is denied, the old URL is revoked inside `setState` but `activeUrlRef.current` still points to the stale URL. While double-revocation is safe (no-op), the stale ref is misleading for debugging.

**Fix:** After P0 fix, this is automatically resolved because the empty-deps cleanup will handle it. Optionally, also clear it explicitly:

```typescript
if (!handle) {
  setState(prev => {
    if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
    return { blobUrl: null, error: 'file-not-found', loading: false }
  })
  activeUrlRef.current = null  // ← add this
  return
}
```

---

### P3 — Low

#### 6. RetryKey test doesn't assert revocation happened

- **File:** [src/hooks/__tests__/useVideoFromHandle.test.ts:125](src/hooks/__tests__/useVideoFromHandle.test.ts#L125)
- **Reviewer:** testing
- **Confidence:** 0.80

**Problem:** The test comment says "should revoke old blob URL and create a new one" but only checks `createObjectURLSpy` was called. Combined with the mock always returning `'blob:mock-url'`, the `prev.blobUrl !== newUrl` guard in the `setState` updater is never exercised.

**Fix:** Make the mock return unique URLs per call, and assert revocation:

```typescript
it('regenerates blob URL when retryKey changes', async () => {
  const handle = makeHandle()
  let callCount = 0
  createObjectURLSpy.mockImplementation(() => `blob:mock-url-${++callCount}`)

  // ... rest of test ...

  await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1))
  expect(result.current.blobUrl).toBe('blob:mock-url-2')
  expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-1')
})
```

---

## Applied Fixes (from this review session)

- P0 #1: Fixed `setTimeout(0)` race condition — moved unmount revocation to empty-deps `useEffect` (see fix code above)

---

## Residual Actionable Work

| Priority | Issue | Fix |
|----------|-------|-----|
| P2 | #2: Code 3 test missing overlay assertion | Add `expect(screen.queryByRole('alert')).not.toBeInTheDocument()` |
| P2 | #3: Retry button `onRecoveryNeeded` path untested | Add test with `onRecoveryNeeded` prop and Retry click |
| P2 | #4: Non-finite currentTime guard untested | Add test with NaN/Infinity currentTime |
| P2 | #5: `activeUrlRef` not cleared in null-handle path | Add `activeUrlRef.current = null` |
| P3 | #6: RetryKey test missing revocation assertion | Make mock return unique URLs, assert revocation |

---

## Residual Risks

- The `useVideoFromHandle` mock always returns identical URL strings (`'blob:mock-url'`), so the `prev.blobUrl !== newUrl` guard in the `setState` updater is never exercised by any test. In production, each `URL.createObjectURL()` returns a unique string, so this path IS exercised in production but not in tests.
- The `recoveryPositionRef` (LocalVideoContent) and `retryPositionRef` (VideoPlayer) track similar information through different mechanisms. A future consumer that skips LocalVideoContent's pattern could lose position on recovery.
- No integration test covers the full recovery chain: VideoPlayer error → `onRecoveryNeeded` callback → LocalVideoContent increments `retryKey` → `useVideoFromHandle` regenerates blob URL → VideoPlayer re-renders with new `src` → position restored.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
