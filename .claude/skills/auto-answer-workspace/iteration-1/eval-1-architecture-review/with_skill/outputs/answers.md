# Auto-Answer: Architecture Session — Dashboard Analytics Page

## Q1: Should we use server-side or client-side rendering for the new dashboard analytics page?

**Recommendation:** Client-side rendering (CSR), consistent with the existing architecture.

**Why:** Knowlune is a Vite + React 19 SPA with `createBrowserRouter`. There is no SSR infrastructure in the project — no Next.js, no Remix, no server-side React rendering pipeline. The entire app is client-rendered with code-splitting via `React.lazy`. The data layer is local-first, backed by IndexedDB (Dexie), meaning analytics data already lives in the browser. There is no server-side data source to pre-render against. The existing Reports page (`src/app/pages/Reports.tsx`) already follows this pattern: it loads data from Dexie and zustand stores, then renders Recharts visualizations entirely on the client.

Adding SSR would require migrating from Vite SPA to a framework like Next.js or building a custom SSR pipeline — a massive architectural change with no clear benefit for a local-first learning platform where data originates in the browser.

**Trade-offs:**
- *SSR advantage you lose:* Faster first contentful paint for data-heavy pages, better SEO. Neither matters here — analytics pages are behind authentication and the data is local, not fetched from a remote API.
- *CSR advantage you keep:* Zero architectural disruption, consistent with all 30+ existing pages, no server infrastructure needed, and the PWA/ServiceWorker caching already handles static asset performance via `vite-plugin-pwa` with CacheFirst and StaleWhileRevalidate strategies.
- *Mitigation for CSR perceived slowness:* The project already uses `React.lazy` with `Suspense` + skeleton fallbacks (`PageLoader` component), which provides good perceived performance. If the analytics page has heavy computations, offload them to a Web Worker (the project already uses ES module workers — see `vite.config.ts` worker config).

---

## Q2: What state management approach for cross-page data sharing?

**Recommendation:** Continue using zustand stores with Dexie as the persistence layer — the established pattern in this codebase.

**Why:** Knowlune already has 22 zustand stores in `src/stores/` covering sessions, courses, bookmarks, quizzes, flashcards, reviews, career paths, and more. Every store follows the same pattern: zustand for in-memory reactive state + Dexie (IndexedDB) for persistence. Cross-page data sharing is already solved — any page can import any store (e.g., `Reports.tsx` imports `useCourseStore`, `Overview.tsx` imports multiple stores). The `dexie-react-hooks` package provides `useLiveQuery` for reactive IndexedDB queries when direct store access is insufficient.

For the analytics page specifically, create a `useAnalyticsStore.ts` that aggregates data from existing stores (`useSessionStore`, `useCourseStore`, `useContentProgressStore`) and computes derived metrics. The lib layer already has analytics utilities (`src/lib/analytics.ts`, `src/lib/reportStats.ts`, `src/lib/progress.ts`) that can be reused.

**Trade-offs:**
- *React Query / TanStack Query:* Would add a dependency for caching and deduplication of remote fetches. But Knowlune's data is local-first (IndexedDB), not fetched from REST APIs. The project has no `@tanstack/react-query` dependency and adding it would introduce a competing data-fetching paradigm alongside the established Dexie pattern. Not worth the inconsistency.
- *React Context:* Too limited for complex state with actions. Zustand is already the standard and provides better performance (no unnecessary re-renders from context propagation).
- *Redux:* Heavier boilerplate, no benefit over zustand for this codebase. The project deliberately chose zustand (lightweight, hook-based, no providers).
- *Risk of store proliferation:* With 22 stores, there is some cognitive overhead. Mitigate by keeping the new analytics store focused on computed/derived data rather than duplicating raw data already in other stores.

---

## Q3: Should we add a caching layer and if so, what strategy?

**Recommendation:** Yes, but use in-memory memoization within the zustand store — not a separate caching infrastructure.

**Why:** The analytics page will compute aggregate metrics (total study time, completion rates, streak data, category breakdowns) from potentially thousands of IndexedDB records. These computations are CPU-bound, not network-bound. The project already has patterns for this:

1. **PWA ServiceWorker caching** (`vite-plugin-pwa` in `vite.config.ts`) handles static assets and images with CacheFirst/StaleWhileRevalidate. This is already configured and covers network resources.
2. **Zustand store state** naturally acts as an in-memory cache — once loaded, data stays in memory until the page is closed.
3. **`useLiveQuery`** from Dexie provides reactive queries that re-run only when underlying IndexedDB data changes.

The right strategy for analytics is: compute expensive aggregations once (on page mount or data change), store the results in the zustand store, and expose them reactively. Use `useMemo` for derived computations within components. For especially heavy calculations (e.g., heatmap data spanning months), debounce recomputation or move it to a Web Worker.

**Trade-offs:**
- *LRU cache (the project has `lru-cache` as a dependency):* Appropriate for server-side or API-proxy caching (it is used in the Express server layer). Overkill for client-side analytics where zustand state already serves as the cache. Adding LRU for in-browser computed data adds complexity without meaningful benefit.
- *IndexedDB-based cache (store precomputed analytics):* Worth considering if analytics computations take >500ms and data changes infrequently. You could store precomputed daily/weekly rollups in a dedicated Dexie table and invalidate on new session end. But start without this — optimize only if profiling shows a bottleneck.
- *React Query caching:* As noted in Q2, not aligned with the local-first architecture. React Query's cache is designed for server-fetched data with TTL-based invalidation, which does not match the IndexedDB source-of-truth model.
- *What you gain:* Fast page loads (computed data in memory), no stale data (reactive to IndexedDB changes via Dexie), no new dependencies, consistent with all existing pages.
