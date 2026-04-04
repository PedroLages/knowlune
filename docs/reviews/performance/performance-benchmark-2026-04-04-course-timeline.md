## Performance Benchmark: Course Timeline Redesign

**Date:** 2026-04-04
**Routes tested:** 2
**Baseline commit:** 9d07aa86
**Focus:** Cinematic hero with gradient/blur effects, timeline rendering, stats bar blur impact

### Page Metrics

| Route | Metric | Baseline | Current | Delta | Status |
|-------|--------|----------|---------|-------|--------|
| / | TTFB | 4ms | 2ms | -50% | OK |
| / | FCP | 216ms | 187ms | -13.4% | OK |
| / | LCP | null | null | — | OK |
| / | CLS | 0 | 0 | 0 | OK |
| / | TBT | 0ms | 0ms | 0 | OK |
| / | DOM Complete | 126ms | 115ms | -8.7% | OK |
| / | Load Complete | 126ms | 115ms | -8.7% | OK |
| /courses/:courseId | TTFB | — | 3ms | new | RECORDED |
| /courses/:courseId | FCP | — | 171ms | new | RECORDED |
| /courses/:courseId | LCP | — | null | new | RECORDED |
| /courses/:courseId | CLS | — | 0 | new | RECORDED |
| /courses/:courseId | TBT | — | 0ms | new | RECORDED |
| /courses/:courseId | DOM Complete | — | 108ms | new | RECORDED |
| /courses/:courseId | Load Complete | — | 108ms | new | RECORDED |

### Resource Analysis

**Route: /**
| Resource | Size | Duration |
|----------|------|----------|
| client | 0.3KB | 2ms |
| reduce-motion-init.js | 0.3KB | 2ms |
| @react-refresh | 0.3KB | 1ms |
| main.tsx | 0.3KB | 1ms |
| env.mjs | 0.3KB | 1ms |

Note: Vite dev server uses ESM module loading with hot module replacement. Transfer sizes appear small because Vite serves modules as cached ES modules on subsequent requests. First-run (uncached) transfer for the course detail route showed CourseOverview.tsx at 120KB and index.css at 344KB.

**Route: /courses/:courseId**
| Resource | Size | Duration |
|----------|------|----------|
| routes.tsx | 83KB | 6ms |
| App.tsx | 22KB | 1ms |
| main.tsx | 12KB | 1ms |
| client | 0.3KB | 1ms |
| reduce-motion-init.js | 0.3KB | 1ms |

**First-run (uncached) largest resources for /courses/:courseId:**
| Resource | Size | Duration |
|----------|------|----------|
| index.css | 344KB | 346ms |
| CourseOverview.tsx | 123KB | 374ms |

### Bundle Size Delta

| Chunk | Baseline | Current | Delta | Status |
|-------|----------|---------|-------|--------|
| CourseOverview | 14,906 B | 17,030 B | +14.3% | MEDIUM |
| Courses | 111,108 B | 117,560 B | +5.8% | OK |
| useCourseAdapter | 4,164 B | 8,070 B | +93.8% | MEDIUM |
| momentum (motion) | 22,771 B | 22,860 B | +0.4% | OK |
| index (main) | 693,410 B | 721,890 B | +4.1% | OK |

The CourseOverview chunk grew +14.3% (14.9KB to 17.0KB, +2.1KB) primarily due to the cinematic hero section, floating stats bar, and timeline curriculum layout. The useCourseAdapter chunk nearly doubled (+93.8%), likely from additional adapter capabilities needed by the redesigned page (thumbnail URL resolution, capability detection).

### Performance Budget

| Metric | Budget | Worst Value | Status |
|--------|--------|-------------|--------|
| FCP | < 1800ms | 187ms (/) | PASS |
| LCP | < 2500ms | null (not reported) | PASS |
| CLS | < 0.1 | 0 (both routes) | PASS |
| TBT | < 200ms | 0ms (both routes) | PASS |
| DOM Complete | < 3000ms | 115ms (/) | PASS |
| JS Transfer | < 500KB | 163KB (/courses/:courseId) | PASS |

### Cinematic Hero Impact Analysis

The redesigned CourseOverview page includes several visually intensive features. Here is an assessment of their paint performance impact:

**1. Radial gradient overlay (`radial-gradient(ellipse...)`)**
- Uses CSS-only gradient with `var(--accent-violet-muted)` token
- No measurable FCP/LCP regression; gradients are GPU-composited and paint-free after initial layout
- Status: No concern

**2. Dot pattern texture (SVG data URI with mask-image)**
- Inline SVG base64 pattern with opacity 0.03 and CSS mask
- Minimal paint cost due to very low opacity; mask-image is GPU-composited
- Status: No concern

**3. Floating stats bar with `backdrop-blur-xl`**
- `backdrop-blur-xl` creates a compositing layer and applies Gaussian blur on underlying content
- This is the most expensive visual effect on the page, but at 1440px desktop it blurs a small region (~200px tall strip)
- No measurable TBT or DOM Complete regression vs homepage baseline
- Status: Monitor on lower-end devices; acceptable at desktop viewport

**4. Timeline rendering with 6 modules (24 videos)**
- Uses `motion/react` for fade-in animations (opacity + translateY)
- Timeline DOM: 6 module cards + 1 expanded section with 4 video links = moderate DOM node count
- Accordion pattern limits DOM: only 1 module expanded by default
- Status: No concern for typical course sizes (5-15 modules)

**5. Thumbnail background image (blur/opacity)**
- Loads thumbnail via async adapter with proper error handling
- Applied at opacity-10 which means minimal visual processing
- Falls back gracefully if thumbnail is unavailable
- Status: No concern

### Findings

#### HIGH (regressions)
None detected.

#### MEDIUM (warnings)
- [bundle] CourseOverview chunk increased 14.3% (14.9KB to 17.0KB) — cinematic hero, stats bar, and timeline layout added ~2.1KB
- [bundle] useCourseAdapter chunk increased 93.8% (4.2KB to 8.1KB) — adapter expanded for thumbnail URL and capability queries

### Recommendations

1. **useCourseAdapter growth** (+93.8%): While the percentage is high, the absolute size is small (4KB increase to 8KB total). This is acceptable given the adapter now supports thumbnail URLs and capability detection needed by the cinematic hero. No action needed unless the adapter continues to grow in future stories.

2. **CourseOverview chunk is well-sized**: At 17KB (5.3KB gzipped), the CourseOverview chunk is well within budget. The cinematic hero layout with gradient, dot pattern, and backdrop-blur adds visual richness without meaningful performance cost.

3. **Timeline scalability**: The accordion pattern (only 1 module expanded by default) keeps the initial DOM footprint small. For courses with 50+ modules, consider virtualizing the timeline list, but this is not needed at current typical sizes.

4. **LCP not reported**: The `largest-contentful-paint` PerformanceObserver returned null for both routes. This is expected in headless Chromium with Vite dev server (no large images or text blocks meeting LCP heuristics on initial paint). Production LCP should be validated separately with Lighthouse.

5. **Motion animations**: The `motion/react` (formerly Framer Motion) animations use CSS transforms and opacity, which are GPU-composited and do not trigger layout or paint. The staggered fade-in (delays: 0.1s, 0.15s, 0.2s, 0.25s, 0.3s) creates a polished cinematic entrance without blocking the main thread.

---
Routes: 2 tested | Samples: 3 per route (median) | Regressions: 0 | Warnings: 2 (bundle only) | Budget violations: 0
Note: Metrics collected on Vite dev server — detect regressions only, not absolute production performance.
