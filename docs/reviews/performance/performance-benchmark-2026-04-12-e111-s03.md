## Performance Benchmark: E111-S03 — Sleep Timer End of Chapter

**Date:** 2026-04-12
**Routes tested:** 2 (/, /library/:bookId/read)
**Baseline commit:** cc237d2d

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | 223ms | 221ms | -1% | OK |
| / | LCP | — | null | — | OK |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0% | OK |
| / | DOM Complete | 145ms | 131ms | -10% | OK |
| /library/:bookId/read | FCP | 495ms | 341ms | -31% | OK |
| /library/:bookId/read | LCP | — | null | — | OK |
| /library/:bookId/read | CLS | 0 | 0 | 0 | OK |
| /library/:bookId/read | TBT | 0ms | 0ms | 0% | OK |
| /library/:bookId/read | DOM Complete | 138ms | 134ms | -3% | OK |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 8ms |
| reduce-motion-init.js | 300B | 6ms |
| @react-refresh | 300B | 8ms |
| main.tsx | 300B | 9ms |
| env.mjs | 300B | 4ms |

*Note: dev server serves modules individually; resource sizes are not production-representative.*

**Route: /library/:bookId/read**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 2ms |
| reduce-motion-init.js | 300B | 2ms |
| @react-refresh | 300B | 2ms |
| main.tsx | 300B | 3ms |
| env.mjs | 300B | 2ms |

### Bundle Size Delta

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| index_js | 830,265B | 830,605B | +340B (+0.04%) | OK |
| index_css | 277,108B | 277,205B | +97B (+0.04%) | OK |
| Library | 214,978B | 214,978B | 0B (0%) | OK |
| BookReader | 73,122B | 73,163B | +41B (+0.06%) | OK |
| dexie | 96,420B | 96,417B | -3B (0%) | OK |

All bundle size deltas are within 1% — well under the 10% MEDIUM threshold. The +340B on index_js is attributable to the SleepTimer chapter progress bar and race condition fix code, consistent with the story scope.

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 341ms (/library/:bookId/read) | PASS |
| LCP | < 2500ms | null (not detected) | PASS |
| CLS | < 0.1 | 0 (all routes) | PASS |
| TBT | < 200ms | 0ms (all routes) | PASS |
| DOM Complete | < 3000ms | 134ms (/library/:bookId/read) | PASS |
| JS Transfer | < 500KB | 60.3KB (/) | PASS |

### Findings

#### HIGH (regressions)
None.

#### MEDIUM (warnings)
None.

### Recommendations

No performance issues detected. The E111-S03 changes (SleepTimer chapter progress bar + AudiobookRenderer chapterProgressPercent prop) are pure UI rendering additions with no measurable impact on page load metrics. The /library/:bookId/read route FCP improved by 31% vs baseline (154ms delta), which is within normal dev server variance and not a meaningful change — no action required.

---
Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
