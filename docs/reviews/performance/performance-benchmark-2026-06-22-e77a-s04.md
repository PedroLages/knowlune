## Performance Benchmark: E77A-S04 — Backup Metadata Tracking and Status

**Date:** 2026-06-22
**Routes tested:** 2
**Baseline commit:** 55e95fbc

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | — | 315ms | new | RECORDED |
| / | LCP | — | null | new | RECORDED |
| / | CLS | — | 0 | new | RECORDED |
| / | TBT | — | 0ms | new | RECORDED |
| / | DOM Complete | — | 240ms | new | RECORDED |
| / | TTFB | — | 2ms | new | RECORDED |
| /settings | FCP | — | 307ms | new | RECORDED |
| /settings | LCP | — | null | new | RECORDED |
| /settings | CLS | — | 0 | new | RECORDED |
| /settings | TBT | — | 0ms | new | RECORDED |
| /settings | DOM Complete | — | 218ms | new | RECORDED |
| /settings | TTFB | — | 2ms | new | RECORDED |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 1ms |
| @react-refresh | 300B | 1ms |
| main.tsx | 300B | 1ms |
| env.mjs | 300B | 1ms |

**Route: /settings**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 1ms |
| reduce-motion-init.js | 300B | 1ms |
| @react-refresh | 300B | 1ms |
| main.tsx | 300B | 1ms |
| env.mjs | 300B | 1ms |

> Note: Resource sizes reflect Vite dev server HMR modules (not production). Production transfer sizes are significantly different.

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 315ms (/) | PASS |
| LCP | < 2500ms | null | N/A |
| CLS | < 0.1 | 0 (/, /settings) | PASS |
| TBT | < 200ms | 0ms (/, /settings) | PASS |
| DOM Complete | < 3000ms | 240ms (/) | PASS |
| JS Transfer | < 500KB | 63KB (/, /settings) | PASS |

### Bundle Size Delta

Current production build at commit 55e95fbc compared to baseline at 012ba4ae:

| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| Total JS | 10,700KB | 11,860KB | +7.7% | OK |
| Settings chunk | 370.7KB | 370.7KB | 0% | OK |
| Main entry | 1,205.9KB | 1,205.9KB | 0% | OK |

No chunk exceeded the 10% regression threshold. The Settings chunk — the only route affected by this story — is identical in size.

### Findings

No regressions detected. This is the initial baseline capture for page metrics; all values are recorded as new baselines.

#### RECORDED (new baselines)
- [/**/**] All page metrics recorded for first time (FCP, LCP, CLS, TBT, DOM Complete)
- [/settings/**] All page metrics recorded for first time (FCP, LCP, CLS, TBT, DOM Complete)

### Recommendations

1. **No action needed** — this story adds backup metadata tracking and a status banner to the Settings page. The changes are lightweight (a read from existing settings, a conditional UI banner, and metadata update calls after async operations). No rendering or bundle regressions detected.

---
Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
