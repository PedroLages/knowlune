## Security Review: E111-S02 — Skip Silence and Speed Memory

**Date:** 2026-04-12
**Phases executed:** 4/8
**Diff scope:** 40 files changed, 1183 insertions, 302 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 3 vectors identified |
| 2 | Secrets Scan | Always | Clean (diff) |
| 3 | OWASP Top 10 | Always | 4 categories checked |
| 4 | Dependencies | package.json changed | N/A — no package.json changes |
| 5 | Auth & Access | auth files changed | N/A — no auth files changed |
| 6 | STRIDE | new routes/components | N/A — no new routes |
| 7 | Configuration | config files changed | N/A — no config files changed |
| 8 | Config Security | Always-on | 1 informational finding |

### Attack Surface Changes

1. **Web Audio API integration** (`useSilenceDetection.ts`): New module-level `AudioContext`, `AnalyserNode`, and `MediaElementAudioSourceNode`. Processes audio time-domain data via `getByteTimeDomainData()` to detect silence. No external network calls, no cross-origin audio sources.

2. **IndexedDB write path** (`useBookStore.ts:updateBookPlaybackSpeed`): New method writes `playbackSpeed` field to the `books` table in Dexie. Accepts `bookId: string` and `speed: number` from UI-controlled `SpeedControl` component.

3. **Keyboard shortcut** (`AudiobookRenderer.tsx`): New `s` key binding toggles skip silence via `toggleSkipSilence()` from the prefs store. Toggle is a boolean flip — no user-controlled input.

### Findings

#### Blockers
None.

#### High Priority
None.

#### Medium

- **`src/stores/useBookStore.ts:335`** (confidence: 72): **No input validation on playbackSpeed before IndexedDB write.** The `updateBookPlaybackSpeed(bookId, speed)` method writes the `speed` parameter directly to IndexedDB without bounds checking. While the UI constrains speed to `SPEED_OPTIONS` (0.5-3.0), the store method is a public API callable from anywhere (e.g., `useBookStore.getState().updateBookPlaybackSpeed(id, 999)`). A malicious or buggy caller could persist an invalid playback rate.
  **Exploit:** Limited — requires code-level access or a separate XSS vector to call the store directly. The `HTMLAudioElement.playbackRate` clamps at browser limits, but the persisted value would be restored on next session, causing unexpected behavior.
  **Fix:** Add bounds validation at the store level:
  ```typescript
  updateBookPlaybackSpeed: async (bookId, speed) => {
    const clampedSpeed = Math.min(3.0, Math.max(0.5, speed))
    // ... rest of method using clampedSpeed
  }
  ```

#### Informational

- **`src/app/hooks/useSilenceDetection.ts:21-23`** (confidence: 70): **Module-level Web Audio singletons persist across navigation.** The `_audioCtx`, `_mediaSource`, and `_analyser` variables are module-scoped and never cleaned up. This is intentional (documented in the JSDoc — `createMediaElementSource` can only be called once) and not exploitable, but worth noting: if the app ever supports multiple audio elements or concurrent playback, these singletons would conflict. No action needed for current architecture.

- **`.mcp.json` (local only, not in git)**: Contains plaintext API keys (`OPENAI_API_KEY`, `ZAI_API_KEY`). File is correctly gitignored and not tracked. No action needed — this is the expected local-only configuration pattern. Recommend using environment variable references (`${OPENAI_API_KEY}`) if MCP supports it, to avoid plaintext keys on disk.

### Secrets Scan

Clean — no secrets detected in the diff. The `.mcp.json` keys noted above are local-only and not part of any commit.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No premium gating or route changes |
| CS2: Client-Side Injection (XSS) | Yes | No | No `dangerouslySetInnerHTML`, no `href={variable}`, no `.innerHTML`. All new components render static text via React JSX auto-escaping. `displayText` in SilenceSkipIndicator is derived from a numeric value (`toFixed(1)`), not user input. |
| CS3: Sensitive Data in Client Storage | No | No | Only `playbackSpeed` (number) written to IndexedDB — not sensitive data |
| CS5: Client-Side Integrity | Yes | Yes | Medium finding: `updateBookPlaybackSpeed` lacks input validation (see above) |
| CS7: Client-Side Security Logging | Yes | No | `console.error` calls log generic error messages, no sensitive data exposed |
| CS9: Client-Side Communication | No | No | No postMessage, no cross-window communication |
| A05: Security Misconfiguration | No | No | No config file changes |
| A06: Vulnerable Components | No | No | No new dependencies |
| A07: Auth Failures | No | No | No auth changes |

### What's Done Well

1. **Correct AudioContext lifecycle management.** The module-level singleton pattern for `createMediaElementSource()` prevents the `InvalidStateError` that would crash audio playback. The `AudioContext.resume()` call correctly handles browser autoplay policy.

2. **No sensitive data in new storage paths.** The only new IndexedDB field (`playbackSpeed`) is a non-sensitive numeric preference. No API keys, tokens, or PII are introduced.

3. **Proper optimistic update with rollback.** The `updateBookPlaybackSpeed` store method captures previous state and rolls back on IndexedDB write failure, with a user-visible `toast.error()` — no silent failures.

---
Phases: 4/8 | Findings: 1 total | Blockers: 0 | False positives filtered: 1 (Web Audio fingerprinting — theoretical only, no cross-origin audio, user's own local files)
