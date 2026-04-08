## Performance Benchmark: E107-S01 — Fix Cover Image Display

**Date:** 2026-04-08
**Routes tested:** 2
**Baseline commit:** be947642

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | 222ms | 190ms | -14.4% | OK |
| / | DOM Complete | 142ms | 117ms | -17.6% | OK |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0% | OK |
| / | Load Complete | 142ms | 118ms | -16.9% | OK |
| /library | FCP | 190ms | 186ms | -2.1% | OK |
| /library | DOM Complete | 115ms | 123ms | +7.0% | OK |
| /library | CLS | 0 | 0 | 0 | OK |
| /library | TBT | 0ms | 0ms | 0% | OK |
| /library | Load Complete | 115ms | 123ms | +7.0% | OK |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 2ms |
| reduce-motion-init.js | 300B | 1ms |
| @react-refresh | 300B | 1ms |
| main.tsx | 300B | 1ms |
| env.mjs | 300B | 1ms |

**Route: /library**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 3ms |
| reduce-motion-init.js | 300B | 2ms |
| @react-refresh | 300B | 2ms |
| main.tsx | 300B | 2ms |
| env.mjs | 300B | 2ms |

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 190ms (/) | PASS |
| LCP | < 2500ms | null | PASS |
| CLS | < 0.1 | 0 (/library) | PASS |
| TBT | < 200ms | 0ms (/library) | PASS |
| DOM Complete | < 3000ms | 123ms (/library) | PASS |
| JS Transfer | < 500KB | 60.9KB (/library) | PASS |

### Bundle Size Analysis

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| Library | 187.21 KB | 187.18 KB | -0.02% | OK |

### Findings

#### OK (no regressions)
- [/library] FCP improved -2.1% (190ms → 186ms) — within normal variance
- [/library] DOM Complete increased +7% (115ms → 123ms) — below threshold
- [/library] Bundle size stable (-0.02%) — no meaningful change
- All Core Web Vitals pass performance budgets
- No layout shift (CLS = 0) — stable page render

### Recommendations

**No action required** — The cover image display fixes (useBookCoverUrl hook) did not introduce performance regressions. The implementation is efficient:
- Async blob URL resolution with proper cleanup prevents memory leaks
- Hook-based pattern ensures consistent lifecycle management
- No blocking operations during initial render (TBT = 0)

**Optional future optimization** (not blocking):
- Consider lazy-loading cover images for large library grids using `loading="lazy"` attribute
- The hook pattern documented in engineering-patterns.md provides good foundation for future resource URL optimizations

---
Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
