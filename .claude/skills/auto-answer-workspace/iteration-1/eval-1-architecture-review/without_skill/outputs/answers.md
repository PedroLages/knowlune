# Architecture Review: Dashboard Analytics Page

## 1. Server-Side vs Client-Side Rendering

**Recommendation: Client-side rendering (CSR) -- stay consistent with the existing architecture.**

### Rationale

Knowlune is a Vite + React 19 SPA with `createBrowserRouter` (React Router v7). Every page is already client-rendered with `React.lazy` code-splitting and `Suspense` fallbacks. There is no SSR framework (no Next.js, no Remix SSR mode) in the stack.

Key factors supporting CSR for the analytics page:

- **Local-first data model.** All learning data lives in IndexedDB via Dexie (27+ tables: `studySessions`, `contentProgress`, `quizAttempts`, `flashcards`, etc.) and localStorage (`course-progress`). Analytics computations read directly from these client-side stores -- there is no backend database to query server-side.
- **No SEO requirement.** Dashboard analytics is an authenticated, personal page. Search engine indexing is irrelevant.
- **Existing patterns.** The Reports page (`src/app/pages/Reports.tsx`) already performs client-side analytics aggregation using functions like `calculateCompletionRate()`, `getCourseCompletionData()`, `getCategoryCompletionForRadar()`, and renders charts with Recharts -- all entirely client-side. The Overview page (`src/app/pages/Overview.tsx`) follows the same pattern.
- **PWA architecture.** Knowlune is configured as a PWA with Workbox service worker caching. Offline capability depends on client-side data access, which SSR would complicate.
- **Infrastructure cost.** Adding SSR would require a Node.js server runtime (currently only an optional Express server exists for AI proxy at port 3001). This adds deployment complexity for a self-hosted/local-first app.

### What to watch for

- If analytics datasets grow large (thousands of sessions), consider Web Workers for heavy computations to keep the UI thread responsive. The codebase already uses workers for vector search and embeddings (`src/ai/lib/workerCapabilities.ts`).
- Use `React.lazy` for the analytics page (consistent with all other pages in `src/app/routes.tsx`) to avoid increasing the initial bundle.

---

## 2. State Management for Cross-Page Data Sharing

**Recommendation: Continue using Zustand stores with Dexie as the persistence layer.**

### Rationale

Knowlune already has a well-established state management architecture:

- **22 Zustand stores** in `src/stores/` covering sessions, courses, quizzes, bookmarks, notes, flashcards, challenges, auth, learning paths, career paths, content progress, and more.
- **Dexie/IndexedDB** as the persistence layer for structured data (schema at `src/db/schema.ts` with 27+ tables).
- **localStorage** for lightweight state (course progress cache, settings, dashboard preferences).
- **Supabase** for auth state (`useAuthStore`) with hydration from `user_metadata`.

For the analytics page, the recommended approach:

1. **Read from existing stores.** Most analytics data already exists in `useSessionStore`, `useCourseStore`, `useQuizStore`, `useContentProgressStore`, etc. The analytics page should consume these stores directly, not duplicate data.
2. **Create a `useAnalyticsStore` only if needed.** If the analytics page requires derived/aggregated state that is expensive to compute and needed across multiple components, create a dedicated Zustand store. Follow the existing pattern: `create<AnalyticsState>((set, get) => ({...}))`.
3. **Use `src/lib/` for pure computation functions.** The existing pattern (seen in `src/lib/progress.ts`, `src/lib/analytics.ts`, `src/lib/reportStats.ts`) is to keep aggregation logic in pure utility functions that query Dexie, with stores calling these functions. This keeps stores thin and logic testable.
4. **Use `dexie-react-hooks`** (already a dependency) for reactive IndexedDB queries where store-level caching is unnecessary.

### What to avoid

- Do not introduce React Context for this. The codebase has no Context-based state management; Zustand handles all cross-component state.
- Do not introduce Redux, TanStack Query, or other state libraries. Zustand + Dexie covers the local-first use case well and the team is invested in this pattern.
- Do not put computed analytics into IndexedDB unless they are genuinely expensive (multi-second computations). Prefer recomputing from source data on page load.

---

## 3. Caching Strategy

**Recommendation: Yes, add a layered caching approach -- but leverage what already exists before adding new infrastructure.**

### Existing Caching Infrastructure

Knowlune already has several caching mechanisms:

1. **PWA/Workbox runtime caching** (configured in `vite.config.ts`):
   - `CacheFirst` for local images (200 entries, 30-day TTL)
   - `StaleWhileRevalidate` for Unsplash images (80 entries, 30-day TTL)
   - `CacheFirst` for HuggingFace models (20 entries, 90-day TTL)
   - `NetworkOnly` for AI API calls
2. **Module-level in-memory caches** -- e.g., `_progressCache` in `src/lib/progress.ts` avoids repeated localStorage parsing per render cycle.
3. **`lru-cache` dependency** already installed (v11.2.7) but usage appears limited.
4. **IndexedDB itself** acts as a persistent cache for imported courses, video progress, thumbnails (`courseThumbnails` table), YouTube video metadata (`youtubeVideoCache` table), and entitlements (`entitlements` table).

### Recommended Caching Strategy for Analytics

**Layer 1: In-memory memoization (primary)**
- Use `useMemo` in components for derived analytics that depend on store state. This is already the pattern in `Overview.tsx` and `Reports.tsx`.
- For expensive cross-store aggregations, use a module-level cache with a version/timestamp invalidation key (like the existing `_progressCache` pattern in `progress.ts`).

**Layer 2: LRU cache for computed aggregates**
- Use the already-installed `lru-cache` for expensive computed results (e.g., "last 90 days trend data", "skill proficiency radar data").
- Key by a hash of the input parameters + a data version counter that increments when underlying data changes.
- Set a short TTL (5-10 minutes) since the user may be actively studying and data changes frequently.

**Layer 3: IndexedDB for heavy historical aggregations (only if needed)**
- If computing analytics over months of historical data becomes slow (>500ms), consider persisting pre-aggregated daily/weekly summaries to a new Dexie table (e.g., `analyticsSnapshots`).
- Invalidate when new sessions are recorded or lessons are completed.
- This is an optimization to add only when profiling shows a need -- not upfront.

### What to avoid

- Do not add Redis, Memcached, or any server-side cache. The app is local-first with no backend database.
- Do not cache at the HTTP/network layer for analytics data -- it all comes from IndexedDB, not API calls.
- Do not over-cache. IndexedDB reads are fast (sub-millisecond for indexed queries via Dexie). Only cache when aggregation logic is the bottleneck, not data access.

---

## Summary Table

| Question | Decision | Justification |
|----------|----------|---------------|
| Rendering | Client-side (CSR) | Local-first SPA, no SEO need, all data in IndexedDB, consistent with 30+ existing pages |
| State management | Zustand + Dexie (existing) | 22 stores already cover most data; add analytics-specific store only if needed |
| Caching | Layered: useMemo > lru-cache > IndexedDB snapshots | Leverage existing infrastructure; add layers only when profiling shows need |
