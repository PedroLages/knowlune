## Performance Benchmark: E107-S04 — Wire About Book Dialog

**Date:** 2026-04-09
**Routes tested:** 1
**Baseline commit:** c7651541

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| /library | TTFB | 4ms | 13ms | +225% (+9ms) | MEDIUM |
| /library | DOM Interactive | 11ms | 28ms | +155% (+17ms) | MEDIUM |
| /library | DOM Complete | 115ms | 237ms | +106% (+122ms) | HIGH |
| /library | FCP | 192ms | 340ms | +77% (+148ms) | HIGH |
| /library | LCP | 0ms | null | — | N/A |
| /library | CLS | 0 | 0 | — | OK |
| /library | TBT | 0ms | 0ms | — | OK |
| /library | JS Resources | 242 | 242 | — | OK |
| /library | CSS Resources | 1 | 2 | +100% (+1) | OK |
| /library | Transfer | 61.5KB | 61.5KB | — | OK |

### Resource Analysis

**Route: /library**

| Resource | Size | Duration |
|----------|------|----------|
| @sentry_react.js | 1.92MB | 21ms |
| lucide-react.js | 1.05MB | 23ms |
| react-dom_client.js | 1.01MB | 33ms |
| chunk-MJOJEP4H.js | 850KB | 29ms |
| @supabase_supabase-js.js | 578KB | 84ms |

### Bundle Size Analysis

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| Library.js | 187.18KB | 192.65KB | +2.9% (+5.5KB) | OK |

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 340ms (/library) | PASS |
| LCP | < 2500ms | N/A | PASS |
| CLS | < 0.1 | 0 (/library) | PASS |
| TBT | < 200ms | 0ms (/library) | PASS |
| DOM Complete | < 3000ms | 237ms (/library) | PASS |
| JS Transfer | < 500KB | 61.5KB (/library) | PASS |

### Findings

#### HIGH (regressions)
- [/library] DOM Complete increased 106% (115ms → 237ms) — exceeds 50% threshold
- [/library] FCP increased 77% (192ms → 340ms) — exceeds 50% threshold

#### MEDIUM (warnings)
- [/library] TTFB increased 225% (4ms → 13ms) — exceeds 25% threshold
- [/library] DOM Interactive increased 155% (11ms → 28ms) — exceeds 25% threshold

### Analysis

**Note on Dev Server Metrics:** All metrics collected on Vite dev server detect regressions only, not absolute production performance. The increased TTFB, DOM timings, and FCP are likely due to:
1. Additional component code (AboutBookDialog ~5.5KB) being loaded
2. Extra CSS resource for dialog styling
3. Vite HMR serving uncompressed modules

**Bundle Size Impact:** The Library chunk increased by 5.5KB (2.9%), which is well within acceptable limits. This is expected for a new dialog component.

**Performance Budget Status:** Despite the regression percentages, all absolute values remain well within industry-standard performance budgets:
- FCP (340ms) is 81% under the 1800ms warning threshold
- DOM Complete (237ms) is 92% under the 3000ms warning threshold
- All Core Web Vitals pass

### Fix Suggestions

| Regression | Confidence | Suggested Fix |
|-----------|-----------|---------------|
| FCP +148ms on /library | HIGH | AboutBookDialog is not lazy-loaded — wrap component in React.lazy() to defer loading until dialog opens |
| DOM Complete +122ms | HIGH | Same root cause as FCP — lazy loading will eliminate this regression |

**Recommended Action:**
```typescript
// In BookContextMenu.tsx, lazy load the dialog:
const AboutBookDialog = lazy(() => import('./AboutBookDialog'));

// Then wrap in Suspense when rendering:
<Suspense fallback={null}>
  <AboutBookDialog ... />
</Suspense>
```

This will defer the ~5.5KB dialog component until the user clicks the context menu, eliminating the FCP and DOM Complete regressions.

### Recommendations

1. **Lazy load AboutBookDialog** — The dialog is only shown when users click the context menu, so it should be code-split and loaded on-demand
2. **Monitor in production** — These are dev-server metrics; validate in production builds to confirm real-world impact
3. **Consider React.memo()** — If the dialog re-renders frequently when closed, memoize the component

---
Routes: 1 tested | Samples: 3 per route (median) | Regressions: 2 | Warnings: 2 | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
