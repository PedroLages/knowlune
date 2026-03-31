## Performance Benchmark: E91-S14 — Clickable Note Timestamps

**Date:** 2026-03-30
**Routes tested:** 1 (bundle analysis only — browser metrics unavailable, see note below)
**Baseline commit:** ef320994 (captured 2026-03-28)
**Current commit:** 34518935

> **Note on browser metrics:** Live browser performance collection (FCP, LCP, CLS, TBT) was
> not possible in this run — the Chrome MCP tool requires interactive permission grant which
> is unavailable in agent context. Metrics below are based on bundle size analysis only.
> Prior story baselines (E69-S01, captured 2026-03-30) are used as FCP/DOM references.

---

### Changed Files

| File | Change |
|------|--------|
| `src/app/components/course/PlayerSidePanel.tsx` | +22 / -3 lines — adds `currentTime` prop threading and `onVideoSeek` callback wiring |
| `src/app/components/notes/NoteEditor.tsx` | +4 / -2 lines — renders timestamp badges as clickable `<button>` elements |
| `tests/e2e/regression/story-e91-s14.spec.ts` | +183 lines — new E2E regression suite (no production bundle impact) |

The diff is intentionally small: clicking a timestamp triggers a seek callback already
provided by the player. No new libraries or large algorithmic changes.

---

### Bundle Size Delta

#### Key Chunks (affected by story)

| Chunk | Baseline (raw) | Current (raw) | Delta | Status |
|-------|---------------|---------------|-------|--------|
| `LessonPlayer` → `UnifiedLessonPlayer` | 134,870 B | 192,890 B | +43% | ⚠️ SEE NOTE |
| `NoteEditor` (standalone) | 70,848 B | merged ↑ | — | MERGED |
| Combined (LessonPlayer + NoteEditor) | 205,718 B | 192,890 B | **-6.2%** | ✅ OK |
| CSS `index` | 241,627 B | 241,580 B | -0.02% | ✅ OK |

> **⚠️ Chunk rename note:** The `LessonPlayer` + `NoteEditor` chunks from baseline were
> consolidated into `UnifiedLessonPlayer` by a prior Epic 89/91 story (Unified course page
> refactor). When measured as combined bytes, the current build is *smaller* (-6.2%) than
> the baseline split chunks. No regression attributable to E91-S14.

#### Total Bundle (all chunks)

| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| Total JS (raw) | 7,139,724 B (6.8 MB) | 8,516,590 B (8.1 MB) | +19.3% | ⚠️ MEDIUM |
| Total CSS (raw) | 250,849 B | 241,580 B | -3.7% | ✅ OK |

> **⚠️ Total JS context:** The +19.3% overall JS increase accumulates across all stories
> since baseline commit `ef320994` (2026-03-28), which includes Epic 89, 90, and 91 stories.
> E91-S14's net contribution to this number is estimated at < 0.1% (the diff adds ~26 lines
> of logic — timestamp click handlers and prop wiring — with no new imports).

---

### Top 15 JS Chunks (current build)

| Chunk | Size (kB) |
|-------|-----------|
| sql-js | 1,304.88 |
| index (vendor) | 682.26 |
| tiptap-emoji | 467.78 |
| pdf | 461.35 |
| chart | 422.29 |
| jspdf.es.min | 390.90 |
| tiptap | 355.96 |
| ai-zhipu | 300.02 |
| prosemirror | 250.90 |
| ai-sdk-core | 238.98 |
| react-vendor | 238.69 |
| html2canvas | 202.38 |
| **UnifiedLessonPlayer** | **192.89** |
| Settings | 192.46 |
| ai-anthropic | 189.12 |

---

### Page Metrics

Browser metrics were not collected this run. Reference values from last recorded baseline
(E69-S01 on 2026-03-30, commit 3085f078):

| Route | Metric | Baseline Value | Status |
|-------|--------|---------------|--------|
| `/` | FCP | 677ms | REFERENCE |
| `/` | DOM Complete | 485ms | REFERENCE |
| `/` | TTFB | 4ms | REFERENCE |
| `/settings` | FCP | 627ms | REFERENCE |
| `/settings` | DOM Complete | 458ms | REFERENCE |

Since E91-S14 modifies only `PlayerSidePanel.tsx` and `NoteEditor.tsx` — components that
are lazy-loaded exclusively within the lesson player route — no impact to `/` or `/settings`
page metrics is expected.

---

### Performance Budget

| Metric | Budget | Assessment |
|--------|--------|------------|
| FCP | < 1800ms | Baseline 677ms — well within budget |
| LCP | < 2500ms | Not measured this run |
| CLS | < 0.1 | Not measured — clickable buttons replace static spans; no layout shift expected |
| TBT | < 200ms | Not measured this run |
| DOM Complete | < 3000ms | Baseline 485ms — well within budget |
| JS per-route transfer | < 500KB | UnifiedLessonPlayer gzips to 58.95 kB — well within budget |

---

### Findings

#### HIGH (regressions)
_None_

#### MEDIUM (warnings)
- **[bundle/total]** Overall JS bundle grew +19.3% since baseline `ef320994`. This is a
  cumulative drift across multiple Epic 89–91 stories, not caused by E91-S14. Recommend
  scheduling a bundle audit after Epic 91 completes to identify tree-shaking opportunities
  (sql-js at 1.3MB and tiptap-emoji at 468KB are candidates for lazy-loading improvements).

#### LOW (observations)
- **[bundle/chunk-rename]** `LessonPlayer` + `NoteEditor` consolidation into
  `UnifiedLessonPlayer` (192KB) is a net improvement over the split approach (205KB combined).
  Baseline JSON should be updated to track the unified chunk name.

---

### Recommendations

1. **Update baseline chunk names** — Replace `LessonPlayer` and `NoteEditor` entries in
   `baseline.json` with `UnifiedLessonPlayer` to prevent false regression alerts on future
   stories.

2. **Schedule bundle audit (post-Epic 91)** — `sql-js` (1.3MB) appears to not be
   code-split. Verify it's loaded lazily; if not, it may be inflating every page's JS
   transfer unnecessarily.

3. **Re-run browser metrics** — For a route with note timestamps, use `/lesson/:id` with
   a seeded course in a future benchmark run to capture LCP/CLS impact of the clickable
   timestamp badges.

4. **E91-S14 is clear** — The story's net bundle contribution is negligible (<0.1%). The
   CLS risk from converting static `<span>` timestamps to `<button>` elements is minimal
   (inline elements, same dimensions), but worth confirming visually.

---

Routes: 0 live (browser metrics unavailable) | Bundle: analyzed | Story contribution: negligible | Cumulative drift: MEDIUM (tracked separately)

Note: Metrics collected against Vite dev server build output — detects regressions only, not absolute production performance.
