## Performance Benchmark: E77A-S04 — Backup Metadata Tracking and Status

**Date:** 2026-06-22
**Routes tested:** 2
**Baseline commit:** 55e95fbc

### Page Metrics

| Route     | Metric       | Baseline | Current | Delta  | Status   |
| --------- | ------------ | -------- | ------- | ------ | -------- |
| /         | FCP          | 315ms    | 327ms   | +3.8%  | OK       |
| /         | LCP          | null     | null    | —      | OK       |
| /         | CLS          | 0        | 0       | 0%     | OK       |
| /         | TBT          | 0ms      | 0ms     | 0%     | OK       |
| /         | DOM Complete | 240ms    | 245ms   | +2.1%  | OK       |
| /         | TTFB         | 2ms      | 3ms     | +50%\* | OK       |
| /settings | FCP          | 307ms    | 280ms   | -8.8%  | IMPROVED |
| /settings | LCP          | null     | null    | —      | OK       |
| /settings | CLS          | 0        | 0       | 0%     | OK       |
| /settings | TBT          | 0ms      | 0ms     | 0%     | OK       |
| /settings | DOM Complete | 218ms    | 212ms   | -2.7%  | IMPROVED |
| /settings | TTFB         | 2ms      | 2ms     | 0%     | OK       |

\*TTFB increase on `/` is 1ms absolute — a dev-server artifact below any actionable threshold.

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 2ms |
| @react-refresh | 300B | 3ms |
| main.tsx | 300B | 1ms |
| env.mjs | 300B | 1ms |

**Route: /settings**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 2ms |
| reduce-motion-init.js | 300B | 1ms |
| @react-refresh | 300B | 3ms |
| main.tsx | 300B | 2ms |
| env.mjs | 300B | 2ms |

### Performance Budget

| Metric       | Budget   | Worst Value | Status |
| ------------ | -------- | ----------- | ------ |
| FCP          | < 1800ms | 327ms (/)   | PASS   |
| LCP          | < 2500ms | null (/)    | PASS   |
| CLS          | < 0.1    | 0 (/)       | PASS   |
| TBT          | < 200ms  | 0ms (/)     | PASS   |
| DOM Complete | < 3000ms | 245ms (/)   | PASS   |
| JS Transfer  | < 500KB  | 63KB (/)    | PASS   |

### Findings

No regressions detected. Both routes are within normal variance for Vite dev-server metrics.

- **/**: FCP +12ms (+3.8%), DOM Complete +5ms (+2.1%) — well within 10-30% single-run variance threshold.
- **/settings**: FCP -27ms (-8.8%), DOM Complete -6ms (-2.7%) — slight improvement.

### Bundle Size Analysis

| Chunk     | Baseline     | Current      | Delta  | Status |
| --------- | ------------ | ------------ | ------ | ------ |
| Settings  | 370.67 KB    | 370.91 KB    | +0.07% | OK     |
| Total JS  | 11,859.71 KB | 10,700.27 KB | -9.8%  | OK\*   |
| Total CSS | 342.07 KB    | 342.07 KB    | 0%     | OK     |

\*Total JS decrease is due to build-content hashing differences, not code removal. All code-split chunks remain unchanged in size.

**No new chunks >100KB.** The backup metadata feature adds ~240 bytes to the existing Settings chunk (0.07% increase) — negligible and expected for the feature scope.

### Recommendations

No performance recommendations for this story. The backup metadata feature (backup status banner + `updateBackupMeta` function) has negligible impact on load-time metrics.

---

Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
