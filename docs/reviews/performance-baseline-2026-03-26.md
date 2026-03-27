# Performance Baseline Report — 2026-03-26

Baseline metrics captured from the Knowlune production build on `main` branch (commit `c646a7d2`).
This report serves as a reference point for measuring optimization impact.

---

## 1. Bundle Size Breakdown

### Summary

| Metric | Value |
|--------|-------|
| **Total dist/** | 78 MB |
| **Total JS (uncompressed)** | 6.7 MB across 166 files |
| **Total JS (gzipped)** | 1.9 MB |
| **Total CSS** | 235 KB across 2 files |
| **dist/assets/ only** | 8.5 MB |
| **Bloat file** | `design-tokens.source.json` — 59.6 MB (in `public/`, copied verbatim to dist) |

### Top 20 Largest JS Chunks

| # | File | Raw | Gzipped | Category |
|---|------|-----|---------|----------|
| 1 | `index-*.js` (main bundle) | 614 KB | 176 KB | App core |
| 2 | `tiptap-emoji-*.js` | 457 KB | 58 KB | Note editor (emoji data) |
| 3 | `pdf-*.js` | 451 KB | 133 KB | PDF viewer (pdfjs-dist) |
| 4 | `chart-C7X*.js` | 412 KB | 118 KB | Charts (Recharts) |
| 5 | `jspdf.es.min-*.js` | 382 KB | 125 KB | PDF export (jsPDF) |
| 6 | `tiptap-*.js` | 348 KB | — | Note editor (Tiptap core) |
| 7 | `ai-zhipu-*.js` | 293 KB | — | AI provider (zhipu) |
| 8 | `prosemirror-*.js` | 245 KB | — | Note editor (ProseMirror) |
| 9 | `react-vendor-*.js` | 233 KB | 74 KB | React + React DOM |
| 10 | `ai-sdk-core-*.js` | 223 KB | 57 KB | AI SDK core |
| 11 | `html2canvas.esm-*.js` | 198 KB | — | Frame capture |
| 12 | `ai-anthropic-*.js` | 185 KB | — | AI provider (Anthropic) |
| 13 | `seedCourses-*.js` | 179 KB | — | Demo data |
| 14 | `AnswerFeedback-*.js` | 174 KB | — | Quiz feedback |
| 15 | `index.es-*.js` | 156 KB | — | Embla carousel / misc |
| 16 | `Overview-*.js` | 150 KB | — | Overview page |
| 17 | `Settings-*.js` | 140 KB | — | Settings page |
| 18 | `radix-ui-*.js` | 134 KB | — | Radix UI primitives |
| 19 | `LessonPlayer-*.js` | 131 KB | — | Lesson player |
| 20 | `Courses-*.js` | 118 KB | — | Courses page |

**Top 20 account for 5.1 MB (76%) of total 6.7 MB JS.**

### CSS Breakdown

| File | Size |
|------|------|
| `index-*.css` | 231 KB |
| `pdf-*.css` | 9.2 KB |

### Critical Finding: 59.6 MB design-tokens.source.json

The file `public/design-tokens.source.json` (59.6 MB) is copied verbatim into `dist/` on every build. This is a Figma design token export containing embedded SVG icons as inline strings. It should be excluded from production builds (add to `.gitignore` for `public/` or move to `docs/`).

---

## 2. Component Size Audit (Top 15 Largest .tsx Files)

| # | File | Lines | Notes |
|---|------|-------|-------|
| 1 | `components/figma/VideoPlayer.tsx` | 1,334 | Candidate for decomposition |
| 2 | `pages/Settings.tsx` | 1,168 | Multiple settings sections — could be split |
| 3 | `components/notes/NoteEditor.tsx` | 1,110 | Rich text editor wrapper |
| 4 | `pages/LessonPlayer.tsx` | 1,074 | Complex player with many modes |
| 5 | `components/figma/ImportWizardDialog.tsx` | 1,006 | Multi-step wizard |
| 6 | `pages/LearningPathDetail.tsx` | 959 | Path detail with progress tracking |
| 7 | `components/figma/YouTubeImportDialog.tsx` | 920 | YouTube import wizard |
| 8 | `components/figma/YouTubeChapterEditor.tsx` | 894 | Chapter editing UI |
| 9 | `components/settings/SubscriptionCard.tsx` | 876 | Subscription management |
| 10 | `components/figma/CourseCard.tsx` | 784 | Course card with multiple variants |
| 11 | `components/figma/AIConfigurationSettings.tsx` | 737 | AI settings panel |
| 12 | `pages/Notes.tsx` | 693 | Notes listing page |
| 13 | `pages/LearningPaths.tsx` | 690 | Learning paths listing |
| 14 | `components/ui/sidebar.tsx` | 688 | Sidebar navigation |
| 15 | `components/figma/BulkImportDialog.tsx` | 673 | Bulk import dialog |

**6 files exceed 1,000 lines** — these are the top candidates for decomposition.

---

## 3. Image Audit

| Metric | Count |
|--------|-------|
| `<img>` tags | 28 across 19 files |
| `alt=` attributes | 40 across 27 files |
| Images missing `alt` (same-line check) | 0 (all `<img>` tags have `alt` on the same element or nearby) |
| `srcset`/`srcSet` usage | 8 across 3 files |
| `loading="lazy"` usage | 12 across 9 files |

### Image Optimization Status

- **Alt text coverage**: Good — all images appear to have alt attributes
- **Lazy loading**: Partial — 12 out of 28 img tags use `loading="lazy"` (43%)
- **Responsive images (srcset)**: Minimal — only 3 components use srcset:
  - `ContinueLearning.tsx` (2 usages)
  - `RecentActivity.tsx` (1 usage)
  - `CourseCard.tsx` (5 usages)
- **Missing srcset**: LearningPathDetail, YouTubeCourseDetail, ImportWizardDialog, and others with images

---

## 4. Dependency Analysis

### Package Counts

| Category | Count |
|----------|-------|
| Production dependencies | 95 |
| Dev dependencies | 29 |
| Total | 124 |

### Virtualization Libraries

**None installed.** No `@tanstack/react-virtual`, `react-window`, or `react-virtuoso` found in dependencies.

Pages that would benefit from virtualization:
- **Courses.tsx** (646 lines) — course list can grow large
- **SessionHistory** — session log entries
- **ReviewQueue** — review items list
- **Authors.tsx** (592 lines) — author list

### Performance Monitoring

**Existing: `web-vitals` v5.1.0** — already installed and integrated:
- `src/lib/performanceMonitoring.ts` captures all 5 Core Web Vitals (LCP, CLS, FCP, TTFB, INP)
- Route transition timing via `performance.mark()`/`performance.measure()`
- In-memory buffer with 100-entry cap
- Dev-mode console logging

### Memoization Gaps

| Page | `useMemo` / `useCallback` Count | Status |
|------|----------------------------------|--------|
| **MyClass.tsx** | **0** | Needs optimization — has sort/filter computations |
| Courses.tsx | Present (per audit plan) | OK |

### Heavy Dependencies (by bundle impact)

| Package | Bundle Chunk Size | Used For |
|---------|------------------|----------|
| Tiptap + ProseMirror | ~1,050 KB (3 chunks) | Note editor |
| Recharts | 412 KB | Charts/reports |
| pdfjs-dist | 451 KB | PDF viewer |
| jsPDF | 382 KB | PDF export |
| AI SDK + providers | ~700 KB (5 chunks) | AI features |
| html2canvas | 198 KB | Frame capture |
| React + ReactDOM | 233 KB | Core framework |

---

## 5. Code Splitting & Lazy Loading

### Route-Level Code Splitting

**Excellent.** All 40+ page routes use `React.lazy()` in `src/app/routes.tsx`. This is well-implemented.

### Component-Level Lazy Loading

3 additional lazy imports within pages:
- `Notes.tsx`: `ReadOnlyContent`, `QAChatPanel`, `RelatedConceptsPanel`
- `premium/index.ts`: `PremiumAnalyticsDashboard`

---

## 6. Optimization Recommendations (Priority Order)

### P0 — Quick Wins (High Impact, Low Effort)

1. **Remove `design-tokens.source.json` from `public/`** — saves 59.6 MB from dist. Move to `docs/` or add a build-time exclusion.

2. **Add `loading="lazy"` to remaining 16 `<img>` tags** — currently only 43% coverage.

### P1 — Medium Effort, High Impact

3. **Install `@tanstack/react-virtual`** for long lists (Courses, SessionHistory, ReviewQueue, Authors). Prevents DOM bloat when lists grow.

4. **Add `useMemo`/`useCallback` to MyClass.tsx** — zero memoization on sort/filter computations.

5. **Add `srcset`/`sizes` to image-heavy components** — only 3 of 19 image-using components provide responsive images.

### P2 — Larger Refactors

6. **Decompose 1,000+ line components** — VideoPlayer (1,334), Settings (1,168), NoteEditor (1,110), LessonPlayer (1,074), ImportWizardDialog (1,006) are candidates for extraction into sub-components.

7. **Evaluate Tiptap emoji data** (457 KB chunk) — consider lazy-loading emoji data only when the emoji picker is opened, rather than with the editor bundle.

8. **Consider lighter alternatives for html2canvas** (198 KB) — if frame capture is a rarely-used feature, ensure it's lazy-loaded (verify it's not in the main bundle).

### P3 — Long-term / Nice-to-Have

9. **AI provider tree-shaking** — 5 AI provider chunks total ~700 KB. If users typically only configure 1-2 providers, consider dynamically importing only the configured provider(s).

10. **seedCourses chunk** (179 KB) — demo/seed data should not be shipped in production builds. Gate behind a feature flag or environment variable.

---

## 7. Baseline Metrics Summary

These numbers serve as the baseline for before/after comparison:

```
Total dist size:              78 MB (59.6 MB is design-tokens bloat)
Total JS (uncompressed):      6.7 MB (166 files)
Total JS (gzipped):           1.9 MB
Total CSS:                    235 KB
Main bundle (index.js):       614 KB raw / 176 KB gzipped
React vendor:                 233 KB raw / 74 KB gzipped
Largest page chunk:           Overview 150 KB, Settings 140 KB
Route-level code splitting:   Yes (40+ routes)
Virtualization:               None
Performance monitoring:       web-vitals integrated
Image lazy loading:           43% coverage (12/28)
srcset usage:                 3/19 image components
Components > 1000 lines:      6 files
Production dependencies:      95
```

---

*Report generated 2026-03-26 as part of TODO 6 (Performance Benchmarks) from the production-readiness audit.*
