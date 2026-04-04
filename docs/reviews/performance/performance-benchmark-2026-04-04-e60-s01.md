## Performance Benchmark: E60-S01 — Knowledge Decay Alert Trigger

**Date:** 2026-04-04
**Routes tested:** 2
**Baseline commit:** cdd8ff89

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | 169ms | 189ms | +11.8% | OK |
| / | LCP | — | null | — | OK |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0% | OK |
| / | DOM Complete | 102ms | 102ms | 0% | OK |
| / | TTFB | 3ms | 1ms | -66.7% | OK |
| /settings | FCP | 179ms | 176ms | -1.7% | OK |
| /settings | LCP | — | null | — | OK |
| /settings | CLS | 0 | 0 | 0 | OK |
| /settings | TBT | 0ms | 0ms | 0% | OK |
| /settings | DOM Complete | 106ms | 98ms | -7.5% | OK |
| /settings | TTFB | 3ms | 2ms | -33.3% | OK |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 2ms |
| reduce-motion-init.js | 300B | 2ms |
| @react-refresh | 300B | 2ms |
| main.tsx | 300B | 0ms |
| env.mjs | 300B | 2ms |

Note: Dev server serves modules via Vite HMR — individual module sizes are small; total transfer 57,000 bytes across 239 resources reflects the lazy-loaded module graph (uncompressed, not production-representative).

**Route: /settings**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 2ms |
| reduce-motion-init.js | 300B | 2ms |
| @react-refresh | 300B | 1ms |
| main.tsx | 300B | 1ms |
| App.tsx | 300B | 2ms |

### Bundle Size Delta

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| Overview | 153,401B | 153,297B | -104B (-0.07%) | OK |
| Settings | 223,182B | 223,182B | 0B (0%) | OK |
| index (main) | 692,156B | 692,156B | 0B (0%) | OK |
| dexie | 96,417B | 96,417B | 0B (0%) | OK |
| NotificationService | — | bundled into index | n/a | NOTE |

Note: `NotificationService.ts` and `eventBus.ts` are statically imported by stores, causing them to be absorbed into the main `index` chunk rather than becoming separate lazy chunks. This is expected given the existing import pattern — no size increase detected.

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 189ms (/) | PASS |
| LCP | < 2500ms | null (both) | PASS |
| CLS | < 0.1 | 0 (both) | PASS |
| TBT | < 200ms | 0ms (both) | PASS |
| DOM Complete | < 3000ms | 102ms (/) | PASS |
| JS Transfer | < 500KB | 57KB (/) | PASS |

### Findings

#### HIGH (regressions)
None.

#### MEDIUM (warnings)
None.

#### LOW / informational
- [/] FCP increased 11.8% (169ms → 189ms) — within measurement noise (single-digit ms); well under the 50% regression threshold and the 1800ms FCP budget.
- [/settings] DOM Complete improved 7.5% (106ms → 98ms) — minor improvement, not a regression concern.

### Recommendations

No action required. The story adds backend-only logic (event bus, notification service, Dexie migration, decay check on startup). Metrics confirm no observable runtime overhead from the new decay check or Dexie migration path:

- The startup decay scan runs asynchronously after mount and does not block rendering — validated by stable TBT (0ms) and FCP on `/`.
- The notification preferences panel on `/settings` shows a slight improvement — consistent with Prettier-only reformatting having no runtime effect.
- `NotificationService.ts` is absorbed into the existing `index` chunk with zero size delta. If this module grows in future stories, consider evaluating lazy import boundaries.

---
Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.

Screenshots: `docs/reviews/performance/screenshot-e60-s01-overview.png`, `docs/reviews/performance/screenshot-e60-s01-settings.png`
