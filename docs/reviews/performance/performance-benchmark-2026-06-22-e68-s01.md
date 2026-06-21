## Performance Benchmark: E68-S01 — Model Download Progress UI

**Date:** 2026-06-22
**Routes tested:** 3
**Baseline commit:** 84106db0

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | 440ms | 374ms | -15% | OK |
| / | LCP | —ms | —ms | — | OK |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | - | OK |
| / | DOM Complete | 328ms | 291ms | -11% | OK |
| /courses | FCP | 442ms | 298ms | -33% | OK |
| /courses | LCP | —ms | —ms | — | OK |
| /courses | CLS | 0 | 0 | 0 | OK |
| /courses | TBT | 0ms | 0ms | - | OK |
| /courses | DOM Complete | 328ms | 217ms | -34% | OK |
| /my-class | FCP | 440ms | 302ms | -31% | OK |
| /my-class | LCP | —ms | —ms | — | OK |
| /my-class | CLS | 0 | 0 | 0 | OK |
| /my-class | TBT | 0ms | 0ms | - | OK |
| /my-class | DOM Complete | 328ms | 226ms | -31% | OK |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 1ms |
| @react-refresh | 300B | 1ms |
| main.tsx | 300B | 0ms |
| env.mjs | 300B | 1ms |

**Route: /courses**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 1ms |
| @react-refresh | 300B | 1ms |
| main.tsx | 300B | 1ms |
| env.mjs | 300B | 1ms |

**Route: /my-class**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 1ms |
| @react-refresh | 300B | 1ms |
| main.tsx | 300B | 1ms |
| env.mjs | 300B | 1ms |

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 374ms (/) | PASS |
| LCP | < 2500ms | — | N/A |
| CLS | < 0.1 | 0 (/) | PASS |
| TBT | < 200ms | 0ms (/) | PASS |
| DOM Complete | < 3000ms | 291ms (/) | PASS |

### Bundle Size Comparison

| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| Total JS | 10,681,357 bytes | 10,939,567 bytes | +2.4% | OK |
| Total CSS | 341,502 bytes | 349,694 bytes | +2.4% | OK |

No significant bundle size changes detected. The new EmbeddingModelProgressToast and useModelDownloadProgress code (~5KB source) is bundled inline into the main entry chunk — no new chunks were created.

### Findings

#### HIGH (regressions)
*None detected.*

#### MEDIUM (warnings)
*None detected.*

### Recommendations

No regressions detected. All metrics are stable or improved vs the baseline:

- FCP improved 15-33% across all tested routes
- DOM Complete improved 11-34% across all tested routes
- CLS and TBT remain at zero
- Total JS bundle increased by 2.4% — well within acceptable range (threshold: 10%)
- Total CSS bundle increased by 2.4% — well within acceptable range (threshold: 10%)

The embedding model warm-up effect (`requestIdleCallback` at 3s delay) and EmbeddingModelProgressToast component do not measurably impact page load performance. The warm-up is gated on `supportsWorkers()` and `deviceMemory >= 4GB`, ensuring low-memory devices are not affected.

---
Routes: 3 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
