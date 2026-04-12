## Performance Benchmark: E111-S02 — Skip Silence and Speed Memory for Audiobook Player

**Date:** 2026-04-12
**Routes tested:** 2
**Baseline commit:** 20634f88

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | 252ms | 223ms | -11% | OK |
| / | LCP | — | null | — | OK |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0% | OK |
| / | DOM Complete | 156ms | 145ms | -7% | OK |
| /library/:bookId/read | FCP | 478ms | 495ms | +4% | OK |
| /library/:bookId/read | LCP | — | null | — | OK |
| /library/:bookId/read | CLS | 0 | 0 | 0 | OK |
| /library/:bookId/read | TBT | 0ms | 0ms | 0% | OK |
| /library/:bookId/read | DOM Complete | 147ms | 138ms | -6% | OK |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 1ms |
| main.tsx | 300B | 1ms |
| @react-refresh | 300B | 1ms |
| env.mjs | 300B | 4ms |

Note: Dev server serves uncompressed modules via HMR — resource sizes reflect Vite dev cache entries, not production bundle sizes.

**Route: /library/:bookId/read**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 2ms |
| @react-refresh | 300B | 1ms |
| main.tsx | 300B | 2ms |
| env.mjs | 300B | 4ms |

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 495ms (/library/:bookId/read) | PASS |
| LCP | < 2500ms | null (n/a) | PASS |
| CLS | < 0.1 | 0 (all routes) | PASS |
| TBT | < 200ms | 0ms (all routes) | PASS |
| DOM Complete | < 3000ms | 145ms (/) | PASS |
| JS Transfer | < 500KB | ~61KB (dev server cache) | PASS |

### Bundle Size Delta

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| index.js | 830,170B | 830,265B | +95B (+0.01%) | OK |
| Library.js | 214,980B | 214,978B | -2B (0%) | OK |
| BookReader.js | 73,120B | 73,122B | +2B (0%) | OK |
| index.css | 277,110B | 277,108B | -2B (0%) | OK |

No meaningful bundle size changes. All deltas are within noise margin (<1%).

### Findings

#### HIGH (regressions)
None.

#### MEDIUM (warnings)
None.

### Recommendations

All metrics are within baseline tolerances. The E111-S02 changes (skip silence detection, speed memory persistence) introduce no measurable performance regression:

- `useSilenceDetection` hook runs audio-side analysis and does not add render overhead
- `useAudiobookPrefsEffects` persists prefs to IndexedDB asynchronously — no blocking work detected (TBT = 0ms on both routes)
- `SilenceSkipIndicator` and `SkipSilenceActiveIndicator` are small UI-only components with no measurable FCP impact

---
Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
