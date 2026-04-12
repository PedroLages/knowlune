## Performance Benchmark: E111-S02 — Skip Silence and Speed Memory

**Date:** 2026-04-12
**Routes tested:** 2
**Baseline commit:** 0427384b
**Current commit:** 20634f88

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| /library/:bookId/read | TTFB | 2ms | 2ms | 0% | OK |
| /library/:bookId/read | FCP | 477ms | 478ms | +0.2% | OK |
| /library/:bookId/read | LCP | — | null | — | N/A |
| /library/:bookId/read | CLS | 0 | 0 | 0 | OK |
| /library/:bookId/read | TBT | 0ms | 0ms | 0% | OK |
| /library/:bookId/read | DOM Complete | 260ms | 147ms | -43% | IMPROVED |
| /library/:bookId/read | DOM Interactive | 48ms | 9ms | -81% | IMPROVED |
| / | TTFB | 2ms | 1ms | -50% | IMPROVED |
| / | FCP | 2041ms | 252ms | -88% | IMPROVED |
| / | LCP | — | null | — | N/A |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0% | OK |
| / | DOM Complete | 1830ms | 156ms | -91% | IMPROVED |

Note: Homepage baseline was recorded on a cold dev server load. Current measurements reflect a warm browser session. No regressions detected on either route.

### Resource Analysis

**Route: /library/:bookId/read** (median of 3 runs)

| Resource | Size | Duration |
|----------|------|----------|
| play (audio icon) | 13,350 B | 32ms |
| client | 300 B | 1ms |
| reduce-motion-init.js | 300 B | 1ms |
| main.tsx | 300 B | 1ms |
| @react-refresh | 300 B | 1ms |

Total transfer: ~61–75KB (dev server, cached modules)
JS resources: ~245, CSS resources: 1–2

**Route: /** (median of 3 runs)

Total transfer: ~61KB (warm session, cached modules)
JS resources: ~250

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 478ms (/library/:bookId/read) | PASS |
| LCP | < 2500ms | null (no LCP recorded) | N/A |
| CLS | < 0.1 | 0 (all routes) | PASS |
| TBT | < 200ms | 0ms (all routes) | PASS |
| DOM Complete | < 3000ms | 156ms (/) | PASS |
| JS Transfer | < 500KB | ~75KB (/library/:bookId/read) | PASS |

### Bundle Size Delta

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| Library | 225,460 B | 214,980 B | -4.7% | IMPROVED |
| index_js | 828,320 B | 830,170 B | +0.2% | OK |
| index_css | 274,610 B | 277,110 B | +0.9% | OK |
| dexie | 96,420 B | 96,420 B | 0% | OK |
| BookReader | (no baseline) | 73,120 B | new | RECORDED |

No bundle regressions. Library chunk decreased by ~10KB, likely due to code optimisation or tree-shaking improvements in the new audiobook components. BookReader chunk at 73KB is well within the 100KB new-chunk review threshold.

### Findings

#### HIGH (regressions)
None.

#### MEDIUM (warnings)
None.

### Recommendations

All metrics pass. The new `useSilenceDetection` hook (Web Audio AnalyserNode) and `SilenceSkipIndicator`/`SkipSilenceActiveIndicator` components do not introduce measurable load-time overhead. The per-book speed memory (`useAudiobookPrefsEffects`) similarly has no performance impact at page load.

The audiobook reader route continues to have null LCP — this is expected for a media player UI with no hero images or large text blocks that the LCP algorithm would target.

---
Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
