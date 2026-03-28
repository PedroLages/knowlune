# Performance Optimization — Exploration

> **Date:** 2026-03-28
> **Status:** Future Exploration (ongoing concern)
> **Priority:** Medium — audit after Wave 1 features ship, optimize before public launch

---

## Vision

Ensure Knowlune remains fast as features grow. Establish baselines, identify bottlenecks, and optimize systematically across bundle size, runtime performance, Core Web Vitals, and memory usage.

## Current State

### What's Already in Place

| Area | Current | File |
|------|---------|------|
| Lazy route loading | ✅ All pages use `React.lazy()` | `src/app/routes.tsx` |
| Virtualized lists | ✅ Courses, notes, authors use virtualization | Various page components |
| Performance benchmark agent | ✅ Runs during `/review-story` — measures TTFB, FCP, LCP | `.claude/agents/performance-benchmark.md` |
| Bundle analysis script | ⚠️ Exists in review workflow but no standalone baseline | `/review-story` pre-checks |
| Memory profiling E2E test | ✅ Exists | `tests/e2e/` |
| Code splitting | ✅ Per-route, but heavy libs (Tiptap, recharts) not lazy-loaded within routes |  |

### What's Unknown

- Current bundle size (main chunk, vendor chunks, total)
- Lighthouse scores on key pages (Overview, Lesson Player, Courses)
- IndexedDB query performance with large datasets (10K+ records)
- Re-render frequency in heavy components (Overview with 8+ widgets)
- Memory usage over long sessions (study sessions can run for hours)

## Optimization Areas

### 1. Bundle Size

| Target | Approach | Estimated Savings |
|--------|----------|------------------|
| Tiptap editor | Lazy load only when note editor opens (not on page load) | ~150-200KB |
| Recharts | Lazy load only on Reports/Overview pages that use charts | ~100KB |
| date-fns | Check for tree shaking — ensure not importing entire library | ~50KB |
| Lucide icons | Verify tree shaking — should only bundle used icons | ~10-50KB |
| epub.js (future) | Only load when EPUB reader opens (Books, Section 19) | ~100KB |
| Source maps | Ensure production build doesn't include source maps | Varies |

**Tools:** `npx vite-bundle-visualizer`, `npx source-map-explorer`

### 2. Runtime Performance

| Target | Issue | Solution |
|--------|-------|----------|
| IndexedDB queries | 29 tables, some queries scan full table | Add compound indexes where missing, use `.limit()` |
| Zustand re-renders | Stores with many fields cause broad subscriptions | Use selector functions: `useStore(s => s.specificField)` |
| Overview dashboard | 8+ widgets, each with own data fetching | Stagger widget loading, virtualize off-screen sections |
| Lesson Player | Heavy component (video + transcript + notes + AI + timer) | Code-split sub-panels, lazy load transcript/notes |
| Course import | YouTube bulk import can freeze UI | Move to Web Worker (already have worker infrastructure) |

**Tools:** React DevTools Profiler, Chrome Performance tab, `React.memo()`, `useMemo()`

### 3. Core Web Vitals

| Metric | Target | How to Measure |
|--------|--------|---------------|
| TTFB | <200ms (local), <800ms (remote) | Lighthouse, performance benchmark agent |
| FCP | <1.0s | Lighthouse |
| LCP | <2.5s | Lighthouse — likely the hero widget or course grid |
| CLS | <0.1 | Lighthouse — check for layout shifts during lazy loading |
| INP | <200ms | Chrome DevTools — check click responsiveness on heavy pages |

**Baseline pages to measure:** Overview, Courses, Lesson Player, Notes, Reports

### 4. Memory

| Concern | Risk | Mitigation |
|---------|------|-----------|
| IndexedDB data in Zustand | Stores cache full table contents in memory | Paginate/virtualize store data, don't load all records |
| Long study sessions | User keeps app open for hours, memory accumulates | Periodic cleanup of stale refs, weak references |
| Multiple Dexie connections | Each table access opens a transaction | Connection pooling, batch reads |
| Tiptap editor | Rich text editor can accumulate history nodes | Limit undo history depth |
| Embeddings in memory | Large Float32Arrays for vector search | Keep on-disk, load on-demand |

**Tools:** Chrome DevTools Memory tab, `performance.memory`, existing memory profiling E2E test

## Phased Approach

| Phase | What | Effort | When |
|-------|------|--------|------|
| 1 | **Audit** — run bundle analysis, Lighthouse on 5 key pages, profile 3 heavy components, establish baselines | Small (2-3 stories) | After Wave 1 ships |
| 2 | **Quick wins** — lazy load Tiptap/recharts, fix obvious re-renders, add Zustand selectors | Small (2-3 stories) | After audit |
| 3 | **IndexedDB optimization** — query profiling, missing indexes, pagination for large tables | Medium (3-4 stories) | When data grows (post-sync) |
| 4 | **CI monitoring** — bundle size check in pre-push hook, Lighthouse in /review-story, regression detection | Small (2 stories) | Before public launch |

## Existing Infrastructure to Reuse

| Component | File | Purpose |
|-----------|------|---------|
| Performance benchmark agent | `.claude/agents/performance-benchmark.md` | Already measures TTFB, FCP, LCP via Playwright MCP |
| Bundle analysis in review | `/review-story` pre-checks | Compares bundle against baseline, blocks on >25% regression |
| Memory profiling E2E | `tests/e2e/` | Existing memory profiling test |
| Vite config | `vite.config.ts` | Build optimization, chunk splitting |

## Decision Gates

| Gate | Question |
|------|----------|
| Before Phase 1 | "Have users reported slowness, or is this premature optimization?" |
| Before Phase 3 | "Do users have 10K+ records? Is IndexedDB actually a bottleneck?" |
| Before Phase 4 | "Is the app going public? Does CI need perf gates?" |

## Effort: Small-Medium (1-2 epics for audit + quick wins). Phase 3-4 ongoing.
