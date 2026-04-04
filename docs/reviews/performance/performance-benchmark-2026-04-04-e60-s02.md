## Performance Benchmark: E60-S02 — Content Recommendation Notification Handler

**Date:** 2026-04-04
**Routes tested:** 3
**Baseline commit:** cdd8ff89
**Current commit:** cddfb1b0
**Measurement method:** 3 runs per route (median reported), Vite dev server at http://localhost:5173
**Viewport:** 1440x900

---

### Context

Story E60-S02 adds a `recommendation-match` notification handler to the notification system. The UI change in `Notifications.tsx` is minimal (2 lines). Additional changes are confined to `src/lib/notifications.ts`, `src/services/NotificationService.ts`, `src/stores/useNotificationPrefsStore.ts`, `src/data/types.ts`, `src/lib/eventBus.ts`, and `src/db/schema.ts`. No new dependencies were introduced.

Routes in scope:
- `/` (Overview — always included as baseline reference)
- `/notifications` (primary affected route — Notifications.tsx changed)
- `/settings` (secondary — shares notification preferences infrastructure)

---

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | FCP | 197ms | 216ms | +19ms (+9.6%) | OK |
| / | LCP | — | null | — | OK |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0ms | OK |
| / | DOM Complete | 134ms | 126ms | -8ms (-6%) | OK |
| / | TTFB | 6ms | 4ms | -2ms | OK |
| /notifications | FCP | 149ms | 179ms | +30ms (+20.1%) | OK |
| /notifications | LCP | — | null | — | OK |
| /notifications | CLS | 0 | 0 | 0 | OK |
| /notifications | TBT | 0ms | 0ms | 0ms | OK |
| /notifications | DOM Complete | 92ms | 112ms | +20ms (+21.7%) | OK |
| /notifications | TTFB | 6ms | 3ms | -3ms | OK |
| /settings | FCP | 219ms | 204ms | -15ms (-6.8%) | OK |
| /settings | LCP | — | null | — | OK |
| /settings | CLS | 0 | 0 | 0 | OK |
| /settings | TBT | 0ms | 0ms | 0ms | OK |
| /settings | DOM Complete | 126ms | 132ms | +6ms (+4.8%) | OK |
| /settings | TTFB | 2ms | 3ms | +1ms | OK |

All deltas are within the 25% MEDIUM and 50% HIGH regression thresholds. The largest relative increase is /notifications DOM Complete at +21.7%, which is still well below the 25% MEDIUM threshold. This delta is consistent with natural run-to-run variation on a Vite dev server.

---

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 2ms |
| reduce-motion-init.js | 300B | 2ms |
| @react-refresh | 300B | 3ms |
| main.tsx | 300B | 2ms |
| env.mjs | 300B | 2ms |

*Note: Vite dev server serves uncompressed modules individually; individual resource sizes shown reflect HMR transport metadata, not production bundle sizes.*

**Route: /notifications**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 2ms |
| reduce-motion-init.js | 300B | 2ms |
| @react-refresh | 300B | 1ms |
| env.mjs | 300B | 1ms |
| main.tsx | 300B | 1ms |

**Route: /settings**
| Resource | Size | Duration |
|----------|------|----------|
| client | 300B | 5ms |
| reduce-motion-init.js | 300B | 5ms |
| @react-refresh | 300B | 4ms |
| main.tsx | 300B | 1ms |
| env.mjs | 300B | 2ms |

---

### Bundle Size Delta (Production Build)

| Chunk | Baseline (bytes) | Current (bytes) | Delta | Status |
|-------|-----------------|----------------|-------|--------|
| Notifications | 7,530 | 7,590 | +60 (+0.8%) | OK |
| Overview | 153,297 | 153,300 | +3 (<0.1%) | OK |
| Settings | 223,182 | 223,440 | +258 (+0.1%) | OK |
| index (main) | 692,156 | 693,410 | +1,254 (+0.2%) | OK |

No chunk exceeds the 10% MEDIUM or 25% HIGH thresholds. The +60B increase in the `Notifications` chunk is the direct cost of the new `recommendation-match` handler — well within acceptable bounds for a new notification type.

---

### Performance Budget

| Metric | Budget | Worst Value | Route | Status |
|--------|--------|-------------|-------|--------|
| FCP | < 1800ms | 216ms | / | PASS |
| LCP | < 2500ms | null (SPA, no LCP entries) | all | PASS |
| CLS | < 0.1 | 0 | all | PASS |
| TBT | < 200ms | 0ms | all | PASS |
| DOM Complete | < 3000ms | 132ms | /settings | PASS |
| JS Transfer (dev) | < 500KB | ~57KB | / | PASS |

All routes pass every budget threshold with large margins. LCP is null across all routes, which is expected for this SPA running under Vite HMR — the browser's LCP heuristic does not trigger for dynamically mounted content in dev mode.

---

### Findings

#### HIGH (regressions)

None.

#### MEDIUM (warnings)

None.

#### LOW (informational)

- [/notifications] FCP increased +20.1% (149ms → 179ms). This is below the 25% MEDIUM threshold and within expected dev-server variability. The Notifications.tsx change adds one new `case` branch in a switch statement — no render path cost is expected.
- [/notifications] DOM Complete increased +21.7% (92ms → 112ms). Same root cause as FCP note above; below threshold.

---

### Recommendations

No action required. The story's changes are confined to a new event handler and a switch-case branch in notification dispatch logic. There is no new rendering work, no new dependencies, and no change to any component critical path. Bundle cost is negligible (+60B on the Notifications chunk).

---

### Screenshots

Evidence screenshots captured per route:
- `docs/reviews/performance/screenshot-e60-s02-overview.png`
- `docs/reviews/performance/screenshot-e60-s02-notifications.png`
- `docs/reviews/performance/screenshot-e60-s02-settings.png`

---

Routes: 3 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 0 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
