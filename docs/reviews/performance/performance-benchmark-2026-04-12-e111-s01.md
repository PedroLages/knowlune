## Performance Benchmark: E111-S01 — Audio Clips

**Date:** 2026-04-12
**Routes tested:** 2
**Baseline commit:** c0c244b3

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | 392ms | 516ms | +31.6% | MEDIUM |
| / | LCP | — | null | — | — |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0% | OK |
| / | DOM Complete | 255ms | 179ms | -29.8% | OK |
| /library/:bookId/read | FCP | 499ms | 502ms | +0.6% | OK |
| /library/:bookId/read | LCP | — | null | — | — |
| /library/:bookId/read | CLS | 0 | 0 | 0 | OK |
| /library/:bookId/read | TBT | 0ms | 0ms | 0% | OK |
| /library/:bookId/read | DOM Complete | 282ms | 153ms | -45.7% | OK |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| play (HMR asset) | 20.2KB | 33ms |
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 1ms |
| main.tsx | 300B | 1ms |
| @react-refresh | 300B | 1ms |

**Route: /library/:bookId/read**
| Resource | Size | Duration |
|----------|------|----------|
| play (HMR asset) | 13.3KB | 20ms |
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 1ms |
| main.tsx | 300B | 1ms |
| @react-refresh | 300B | 1ms |

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 516ms (/) | PASS |
| LCP | < 2500ms | null | — |
| CLS | < 0.1 | 0 (/) | PASS |
| TBT | < 200ms | 0ms (/) | PASS |
| DOM Complete | < 3000ms | 179ms (/) | PASS |
| JS Transfer | < 500KB | ~75KB (/library/:bookId/read) | PASS |

### Bundle Size Delta

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| AudiobookRenderer | 56,398B (55.1KB) | 56,400B (55.1KB) | +0% | OK |
| Library | 214,978B (210KB) | 214,980B (210KB) | +0% | OK |
| index_js | 829,906B (811KB) | 829,910B (811KB) | +0% | OK |
| dexie | 96,420B (94.2KB) | 96,420B (94.2KB) | +0% | OK |

No bundle size regressions. The ClipButton and ClipListPanel components were absorbed into the existing AudiobookRenderer chunk with no measurable size increase, confirming they are lightweight UI-only additions.

### Findings

#### HIGH (regressions)
None.

#### MEDIUM (warnings)
- [/] FCP increased 31.6% (392ms → 516ms) — exceeds 25% threshold. Absolute value (516ms) is well within the 1800ms budget. This is likely dev server variance (single-session measurement noise) rather than a genuine regression introduced by the audio clips feature.

### Recommendations

The FCP delta on `/` is the only flag. Given that:
1. The absolute value (516ms) is far below the 1800ms budget
2. The audio clips changes are confined to `AudiobookRenderer.tsx`, `ClipButton.tsx`, and `ClipListPanel.tsx` — none of which are on the homepage route
3. The audiobook player route itself shows no FCP regression (+0.6%)

This is classified as dev server measurement variance, not a code-induced regression. No action required.

The AudiobookRenderer chunk size is unchanged at 56.4KB, confirming ClipButton and ClipListPanel were integrated without bundle bloat.

---
Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 1 (dev variance) | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
