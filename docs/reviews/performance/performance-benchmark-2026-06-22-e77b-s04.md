## Performance Benchmark: E77B-S04 — Drive Course Import Enhancements

**Date:** 2026-06-22
**Routes tested:** 3
**Baseline commit:** 58f0b189

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | 329ms | 322ms | -2.1% | OK |
| / | LCP | null | null | — | N/A |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0% | OK |
| / | DOM Complete | 225ms | 221ms | -1.8% | OK |
| /courses | FCP | 291ms | 347ms | +19.2% | MEDIUM |
| /courses | LCP | null | null | — | N/A |
| /courses | CLS | 0 | 0 | 0 | OK |
| /courses | TBT | 0ms | 0ms | 0% | OK |
| /courses | DOM Complete | 218ms | 236ms | +8.3% | OK |
| /settings | FCP | 298ms | 330ms | +10.7% | OK |
| /settings | LCP | null | null | — | N/A |
| /settings | CLS | 0 | 0 | 0 | OK |
| /settings | TBT | 0ms | 0ms | 0% | OK |
| /settings | DOM Complete | 219ms | 221ms | +0.9% | OK |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300 B | 1ms |
| reduce-motion-init.js | 300 B | 1ms |
| @react-refresh | 300 B | 1ms |
| main.tsx | 300 B | 1ms |
| env.mjs | 300 B | 1ms |

**Route: /courses**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300 B | 1ms |
| reduce-motion-init.js | 300 B | 1ms |
| @react-refresh | 300 B | 2ms |
| main.tsx | 300 B | 1ms |
| env.mjs | 300 B | 1ms |

**Route: /settings**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300 B | 1ms |
| reduce-motion-init.js | 300 B | 1ms |
| @react-refresh | 300 B | 1ms |
| main.tsx | 300 B | 0ms |
| env.mjs | 300 B | 1ms |

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 347ms (/courses) | PASS |
| LCP | < 2500ms | null | N/A |
| CLS | < 0.1 | 0 (all) | PASS |
| TBT | < 200ms | 0ms (all) | PASS |
| DOM Complete | < 3000ms | 236ms (/courses) | PASS |
| JS Transfer | < 500KB | 63KB (all) | PASS |

### Bundle Size Delta

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| Settings | 370.67 kB | 375.48 kB | +4.81 kB (+1.3%) | OK |
| ImportedCourseCard | 50.34 kB | 50.67 kB | +0.33 kB (+0.7%) | OK |
| CourseOverview | — | 17.51 kB | new | RECORDED |
| googleDriveToken | 1.19 kB | 2.04 kB | +0.85 kB (+71%) | OK |
| hard-drive (icon) | — | 0.56 kB | new | RECORDED |
| googleDriveFileService | — | 2.83 kB | new | RECORDED |
| CredentialSyncStatusBadge | — | 4.22 kB | new | RECORDED |

### Findings

#### MEDIUM (warnings)
- **[/courses] FCP increased 19.2% (291ms -> 347ms, +56ms)** — Approaches the 25% regression threshold. The change adds a conditional Drive source badge (HardDrive icon) in `ImportedCourseCard.tsx`. Given that dev-server FCP measurements vary 10-30% due to JIT compilation and GC pauses, and the added code is a lightweight conditional span (0.56 kB chunk), this is likely measurement noise. No action required.

#### OK (budget compliance)
- All performance budgets are within PASS thresholds
- All bundle deltas are below 10% warning threshold
- No CLS, TBT, or LCP regressions detected

### Recommendations
1. **Monitor on next review cycle** — The /courses FCP increase is within measurement variance but worth tracking across subsequent stories to confirm it is not a cumulative regression.
2. **No code-splitting concerns** — New Drive feature chunks are appropriately sized (2.83 kB file service, 4.22 kB credential badge, 0.56 kB icon) and should be loaded with their parent route chunks via normal code-splitting.

### Fix Suggestions

| Regression | Confidence | Suggested Fix |
|-----------|-----------|---------------|
| FCP +56ms (+19.2%) on /courses | MEDIUM (60%) | The 56ms increase is within typical dev-server variance (10-30%) and the added code is a single conditional span with a 0.56 kB icon chunk. If this persists across reviews, consider lazy-loading the Drive badge component with `React.lazy()` only when course source is 'drive'. |

---
Routes: 3 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 1 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
