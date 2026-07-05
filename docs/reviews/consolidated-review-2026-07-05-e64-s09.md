## Review Summary: E64-S09 -- Unknown Story
Date: 2026-07-05

### Pre-checks
- No pre-check data available

### Design Review
Skipped -- no UI changes

### Code Review (Architecture)
FAIL -- 2 high, 1 medium
Report: docs/reviews/code/code-review-2026-07-05-e64-s09.md

### Code Review (Testing)
WARNINGS -- 2 high, 3 medium
Report: docs/reviews/code/code-review-testing-2026-07-05-e64-s09.md

### Edge Case Review
Not dispatched

### Performance Benchmark
Not dispatched

### Security Review
WARNINGS -- 1 high, 3 medium
Report: docs/reviews/security/security-review-2026-07-05-e64-s09.md

### Exploratory QA
Skipped -- no UI changes

### OpenAI Adversarial Review
Skipped -- no OPENAI_API_KEY or Codex CLI

### GLM Adversarial Review
Skipped -- no ZAI_API_KEY

### Deduplication Scan
Skipped

### Consolidated Findings

#### Blockers (must fix)
- unknown: ACs 3 and 4 describe offline behavior requiring SW-enabled E2E tests against a production build, but the story defers these tests to a follow-up story. These ACs cannot be verified without these tests. (docs/implementation-artifacts/stories/E64-S09-service-worker-precache.md:267) [Consensus: 90]
- unknown: Font caching regression: woff2 files excluded from precache via globIgnores but no runtime caching rule added in src/sw.ts. Fonts will hit setDefaultHandler(new NetworkOnly()) and won't load offline. This is a regression from current behavior where fonts are precached. (docs/implementation-artifacts/stories/E64-S09-service-worker-precache.md:149) [Consensus: 100]

#### High Priority (should fix)
- unknown: AC 3 overpromises offline route behavior: routes 'display correctly' offline requires data availability (IndexedDB, API), not just JS chunk availability. The story only addresses chunk caching. Most routes will load their code chunk but show empty/broken data-dependent UI. (docs/implementation-artifacts/stories/E64-S09-service-worker-precache.md:40) [Consensus: 85]
- unknown: AC 5 includes preserving 5 existing runtime caching rules in order, but no test infrastructure verifies registerRoute order in compiled SW. (src/sw.ts:28) [Consensus: 90]
- unknown: ChunkErrorBoundary integration underspecified: the existing SuspensePage wrapper wraps all lazy routes in RouteErrorBoundary > Suspense. The proposed ChunkErrorBoundary must live between RouteErrorBoundary and Suspense, but the story doesn't specify this hierarchy. Incorrect placement would render the boundary ineffective. (docs/implementation-artifacts/stories/E64-S09-service-worker-precache.md:208) [Consensus: 85]
- unknown: No build-time SW verification helper exists for precache content, size, and exclusion assertions. Each future SW story would duplicate this logic. [Consensus: 95]
- unknown: Route-chunks StaleWhileRevalidate missing CacheableResponsePlugin — error responses (4xx/5xx) could be cached as valid JS content for up to 7 days. Existing Unsplash and HuggingFace rules both include this validation; the route-chunks rule should follow the same pattern. [Consensus: 85]

#### Medium (fix when possible)
- unknown: 7-day cache TTL (maxAgeSeconds: 604800) for route-chunks is longer than necessary. Vite content-hashed chunk URLs mean each deployment produces new URLs; old cached content is obsolete after the first post-deployment session. A cached poisoned JS chunk persists for a week. [Consensus: 72]
- unknown: ChunkErrorBoundary and RouteErrorBoundary nesting gap — wrapping lazy routes in ChunkErrorBoundary inside the existing SuspensePage's RouteErrorBoundary creates a two-boundary stack where ChunkErrorBoundary may catch and suppress errors that RouteErrorBoundary would otherwise report via reportError(). [Consensus: 71]
- unknown: ChunkErrorBoundary must distinguish dynamic import TypeErrors from other runtime TypeErrors. Catching all TypeErrors silently may suppress actionable code bugs or null-reference errors, preventing the RouteErrorBoundary from reporting them via reportError(). [Consensus: 78]
- unknown: No waitForServiceWorkerRegistration() utility exists for E2E tests. SW registration is async and required for AC 3/4 tests. [Consensus: 80]
- unknown: OfflineRouteFallback and ChunkErrorBoundary components have no test plan. These are new components that require unit tests. [Consensus: 85]
- unknown: Route-chunk JS pattern /\/assets\/.*\.js$/i is overly broad - matches all non-precached JS in /assets/, not just route chunks. Workbox's precache priority mitigates this in practice, but the pattern conflates 'all uncached JS' with 'route chunks.' (docs/implementation-artifacts/stories/E64-S09-service-worker-precache.md:164) [Consensus: 75]
- unknown: playwright.config.ts has no preview-server project. SW is disabled in dev mode so AC 3/4 E2E tests cannot run against the dev server. (playwright.config.ts:76) [Consensus: 80]

#### Nits (optional)
- unknown: GlobIgnores list in vite.config.ts may drift as new dependencies are added. Over-precaching can increase SW install time and bandwidth, impacting users on metered connections. [Consensus: 65]
- unknown: Tailwind v4: h-12 w-12 should be size-12 in the OfflineRouteFallback example code. (docs/implementation-artifacts/stories/E64-S09-service-worker-precache.md:192) [Consensus: 90]


### Verdict
BLOCKED -- fix 2 blocker(s) first
