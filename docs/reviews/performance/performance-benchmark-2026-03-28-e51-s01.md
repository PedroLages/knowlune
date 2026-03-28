## Performance Benchmark: E51-S01 — Settings Infrastructure & Display Section Shell

**Date:** 2026-03-28
**Routes tested:** 2
**Baseline commit:** 10159bb6
**Environment:** Vite dev server (http://localhost:5173)

> **Dev server note:** Transfer sizes reflect uncompressed Vite dev-mode modules served individually (no bundling, no gzip). The JS transfer totals (12–15 MB) are normal for a dev server and are not indicative of production bundle size. The production bundle baseline is 7.1 MB total JS (see `baseline.json → bundle`). Timing metrics (TTFB, FCP, DOM Complete) are the meaningful indicators across benchmark runs.

---

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| `/` | TTFB | — | 1ms | new | RECORDED |
| `/` | FCP | — | 352ms | new | RECORDED |
| `/` | DOM Complete | — | 222ms | new | RECORDED |
| `/` | Load Complete | — | 222ms | new | RECORDED |
| `/settings` | TTFB | — | 2ms | new | RECORDED |
| `/settings` | FCP | — | 336ms | new | RECORDED |
| `/settings` | DOM Complete | — | 206ms | new | RECORDED |
| `/settings` | Load Complete | — | 206ms | new | RECORDED |

Both routes are new entries — the `page_metrics` section of `baseline.json` was previously empty. No regression comparison is available for this run; these measurements become the baseline for future benchmarks.

---

### Resource Analysis

**Route: /**

| Resource | Size | Duration |
|----------|------|----------|
| @sentry_react.js | 1,879 KB | 21ms |
| recharts.js | 1,239 KB | 33ms |
| lucide-react.js | 1,023 KB | 23ms |
| react-dom_client.js | 982 KB | 27ms |
| react-day-picker.js | 788 KB | 23ms |

Total resources: 238 (232 JS, 0 CSS separately tracked)
Total transfer: 14,877 KB (dev server uncompressed)

**Route: /settings**

| Resource | Size | Duration |
|----------|------|----------|
| @sentry_react.js | 1,879 KB | 22ms |
| lucide-react.js | 1,023 KB | 12ms |
| react-dom_client.js | 982 KB | 22ms |
| @supabase_supabase-js.js | 564 KB | 15ms |
| chunk-KAB4QYW4.js | 459 KB | 11ms |

Total resources: 202 (201 JS)
Total transfer: 12,650 KB (dev server uncompressed)

---

### Performance Budget

> Budget checks use dev-server timing metrics; JS transfer budget is not evaluated against dev server values (see dev server note above).

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 352ms (/) | PASS |
| DOM Complete | < 3000ms | 222ms (/) | PASS |
| JS Transfer (prod bundle) | < 500 KB/chunk | ~149 KB Settings chunk | PASS |

All timing metrics pass with significant headroom. The `/settings` route renders slightly faster than `/` on both FCP (336ms vs 352ms) and DOM Complete (206ms vs 222ms), which is expected given the settings page is a lighter initial render than the overview dashboard.

---

### Findings

#### HIGH (regressions)
None. Both routes are new entries with no prior baseline to compare against.

#### MEDIUM (warnings)
None.

#### Observations
- **TTFB is excellent** at 1–2ms, consistent with a local dev server with no network latency.
- **FCP under 400ms** on both routes is well within the 1800ms budget. The onboarding wizard overlay is present on both routes (visible in screenshots) but does not measurably impact FCP.
- **Settings route is 7% lighter** than the homepage in DOM Complete (206ms vs 222ms), and loads 2,228 KB fewer resources. The E51-S01 story adds a `DisplayAccessibilitySection` component and settings infrastructure but does not introduce heavyweight new dependencies that would bloat the `/settings` chunk.
- **`@sentry_react.js` (1,879 KB) is the largest single resource** across both routes in dev mode. In production this would be tree-shaken and gzip-compressed — the production Sentry chunk is not explicitly listed in the production bundle baseline, suggesting it is bundled into the main vendor chunk.
- **`recharts.js` (1,239 KB)** only appears on `/` (overview charts), not on `/settings` — correct code-splitting behavior.

---

### Recommendations

1. **No action required for E51-S01.** The story adds settings infrastructure (tab shell, display/accessibility section) without introducing new heavyweight dependencies. Timing metrics are well within budget.

2. **Future benchmark: track FCP regression threshold at 500ms** for `/settings`. This run establishes 336ms as the new baseline. A future story that inflates the settings page significantly (e.g., loading user preferences from a remote API) should be flagged if FCP exceeds 500ms.

3. **Sentry bundle size.** The `@sentry_react.js` dev module is 1.9 MB uncompressed. Verify in a production build that Sentry is code-split or lazy-loaded and does not contribute disproportionately to the initial bundle. The production baseline shows 7.1 MB total JS, so this appears to be handled correctly.

4. **Consider CSS resource tracking.** The current dev server serves CSS via JS injection (Vite HMR), causing `css_resource_count: 0`. Future baseline updates should also run a production build check to track the CSS chunk (`index-R7j1of8u.css`, 242 KB raw in production baseline).

---

### Screenshot Evidence

Screenshots captured at:
- `/tmp/screenshot-.png` — homepage (`/`)
- `/tmp/screenshot-settings.png` — settings page (`/settings`)

Both pages rendered fully with sidebar navigation, top header, and main content area visible. The onboarding wizard overlay was present on both routes (expected first-run state in the test environment).

---

Routes: 2 tested | Regressions: 0 | Warnings: 0 | Budget violations: 0
