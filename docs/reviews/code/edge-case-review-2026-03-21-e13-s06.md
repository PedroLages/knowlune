## Edge Case Review — E13-S06 (2026-03-21)

### Unhandled Edge Cases

**src/lib/quotaResilientStorage.ts:88-93** — `sessionStorage also at quota limit during fallback`
> Consequence: Toast says 'saved for this session' but data was not saved anywhere
> Guard: `catch (sessionError) { if (isQuotaExceeded(sessionError)) showThrottledWarning(); console.error(...); return; }`

**src/lib/quotaResilientStorage.ts:43-51** — `clearStaleQuizKeys removes active quiz's in-progress backup key`
> Consequence: Active quiz progress backup deleted during space reclamation
> Guard: `if (key?.startsWith('quiz-progress-') && key !== name) localStorage.removeItem(key)`

**src/stores/useQuizStore.ts:318-332** — `Subscriber toast fires unthrottled while adapter toast is throttled`
> Consequence: Duplicate warning toasts on same state change (subscriber + adapter)
> Guard: `Import and call showThrottledWarning() instead of toastWarning.storageQuota() directly`

**src/stores/useQuizStore.ts:318-332** — `Subscriber skips stale-key cleanup before sessionStorage fallback`
> Consequence: Missed opportunity to recover localStorage space and avoid fallback
> Guard: `Call clearStaleQuizKeys() before sessionStorage.setItem fallback in subscriber`

**src/app/pages/Quiz.tsx:205-211** — `Both localStorage and sessionStorage throw during beforeunload`
> Consequence: Quiz progress silently lost on tab close with no recovery path
> Guard: `Inner catch: try { sessionStorage.setItem(key, value) } catch { /* already in outer try */ }`

**src/lib/quotaResilientStorage.ts:27-30** — `System clock jumps backward after lastWarningAt is set`
> Consequence: Warning toast suppressed indefinitely until clock catches up
> Guard: `if (now - lastWarningAt < THROTTLE_MS && now >= lastWarningAt) return`

---
**Total:** 6 unhandled edge cases found.
