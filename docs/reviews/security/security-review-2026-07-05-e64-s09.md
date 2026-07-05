## Security Review: E64-S09 — Service Worker Precache Optimization

**Date:** 2026-07-05
**Type:** Pre-implementation specification review (0 code changes)
**Phases executed:** 3/8 (spec-appropriate subset)
**Diff scope:** 0 files changed (ready-for-dev, not yet implemented)

### Executive Summary

This review analyzes the story specification for E64-S09 before implementation begins. The proposed design is sound with two notable security gaps: the route-chunks runtime cache lacks content integrity validation that other caching rules in the codebase apply, and the ChunkErrorBoundary design needs clearer error discrimination to prevent real bugs from being masked. Both are fixable at implementation time with minimal effort.

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Pre-implementation spec review | 4 vectors identified |
| 2 | Secrets Scan | Spec review | Clean — no secrets handling in scope |
| 3 | OWASP Top 10 | Spec review | 3 categories checked |
| 7 | Configuration Review | Spec review | 2 configuration concerns |

### Attack Surface Assessment

The story introduces four new attack surfaces:

1. **`route-chunks` runtime cache** — New `StaleWhileRevalidate` handler for JS assets at `src/sw.ts`. This is the most significant new surface: cached JS chunks that can be served offline.
2. **`ChunkErrorBoundary`** — New error boundary in `src/app/components/ChunkErrorBoundary.tsx`. Error boundaries have security implications when they catch errors from dynamic imports: they become a choke point that can either correctly route errors or silently swallow them.
3. **`OfflineRouteFallback`** — New component in `src/app/components/OfflineRouteFallback.tsx`. Low risk: static UI with `navigate('/')` (hardcoded safe path).
4. **Modified `globPatterns`/`globIgnores` in `vite.config.ts`** — Configuration that controls which assets enter the precache manifest. Errors here determine whether large or sensitive chunks are downloaded at install time.

### Findings

#### HIGH

- **`vite.config.ts` (proposed — Task 4)** — Route-chunks `StaleWhileRevalidate` missing `CacheableResponsePlugin` (confidence: 85)
  
  **Description:** The proposed `registerRoute` for route-chunks at `src/sw.ts` uses `StaleWhileRevalidate` without a `CacheableResponsePlugin` to validate response status codes. If the server returns a 4xx/5xx response (due to CDN issue, transient deployment glitch, or man-in-the-middle), that error response will be cached as valid content in the `route-chunks` cache for up to 7 days. The existing codebase already sets the correct pattern: both Unsplash images (line 45) and HuggingFace models (line 62) include `new CacheableResponsePlugin({ statuses: [0, 200] })`. The route-chunks rule should follow the same pattern.
  
  **Exploit scenario:** A transient CDN error returns HTTP 503 for `assets/tutor-abc123.js`. The `StaleWhileRevalidate` strategy caches this error response. For the next 7 days, the user sees a broken page or blank route when navigating to `/tutor` offline or even online (if the cache response is served before the network check completes). A malicious intermediary could inject a HTTP 200 with crafted JS that persists in cache.
  
  **Fix:** Add `CacheableResponsePlugin` to the route-chunks strategy:
  ```ts
  registerRoute(
    ({ url }) => /^\/assets\/.*\.js$/i.test(url.pathname),
    new StaleWhileRevalidate({
      cacheName: 'route-chunks',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        }),
      ],
    })
  );
  ```
  **Autofix class:** `gated_auto`

#### MEDIUM

- **`src/app/components/ChunkErrorBoundary.tsx` (proposed — Task 5)** — Error boundary must distinguish dynamic import failures from other TypeErrors (confidence: 78)

  **Description:** The story specifies that `ChunkErrorBoundary` should catch `TypeError` from failed `import()`. However, all runtime TypeErrors (null reference, incorrect module exports, etc.) produce the same `TypeError` class. Without discriminating on the error message or cause, the boundary may silently show "This page isn't available offline" for real code bugs, masking actionable errors that `RouteErrorBoundary` would otherwise surface with a retry option and error details. The `RouteErrorBoundary` at `src/app/components/RouteErrorBoundary.tsx` (line 43) shows dev-only error details; `ChunkErrorBoundary` would suppress these.

  **Exploit scenario:** A developer introduces a null-pointer bug in a lazy-loaded page module. On navigation, the dynamic `import()` resolves successfully but the component render throws a `TypeError: Cannot read properties of null`. `ChunkErrorBoundary` catches it, checks `navigator.onLine` (true), and shows "Something went wrong. Please try again." instead of the `RouteErrorBoundary`'s detailed error with stack trace. Debugging is impaired. More critically, if `navigator.onLine` returns false (browser false-positive), the user sees "not available offline" even when the root cause is a code bug.

  **Fix:** The `ChunkErrorBoundary` should check `error.message` for patterns specific to dynamic import failures (e.g., "Failed to fetch dynamically imported module", "Importing a module script failed", "Loading chunk *.js failed"). For all other errors, re-throw or delegate to the parent `RouteErrorBoundary`:
  ```ts
  componentDidCatch(error: Error, info: ErrorInfo) {
    const isChunkLoadError = error.message?.includes('dynamically imported module')
      || error.message?.includes('Loading chunk')
      || error.name === 'ChunkLoadError';
    
    if (!isChunkLoadError) {
      // Re-throw to parent RouteErrorBoundary for proper handling
      this.setState({ hasError: true, error, isChunkError: false });
      return;
    }
    this.setState({ hasError: true, error, isChunkError: true });
  }
  ```
  **Autofix class:** `manual`

- **`src/sw.ts` (proposed — Task 4)** — 7-day cache TTL for route chunks creates long cache poisoning window (confidence: 72)

  **Description:** The proposed `maxAgeSeconds: 7 * 24 * 60 * 60` (7 days) for route-chunks is longer than necessary. Vite production builds generate chunk filenames with content hashes, so each deployment produces different URLs. The old content is never requested again after a new deployment. The 7-day TTL means that if a poisoned JS chunk enters the cache (via the vulnerability described in the HIGH finding), it persists for a full week even though the correct content from the new deployment is available immediately from the network.

  **Exploit scenario:** A malicious response is cached on day 0. The app deploys a fix on day 1 with new chunk URLs. Old poisoned content is never served from network again, but persists in the cache until day 7. A user who stays on the old app version (no refresh) continues to load the poisoned content.

  **Fix:** Reduce `maxAgeSeconds` to `24 * 60 * 60` (1 day). Vite's content-hashed chunk URLs already guarantee fresh content on each deployment; the runtime cache only needs to span a single session plus one day for offline reliability:
  ```ts
  new ExpirationPlugin({
    maxEntries: 100,
    maxAgeSeconds: 24 * 60 * 60, // 1 day
  })
  ```
  **Autofix class:** `advisory`

- **`src/app/routes.tsx` (proposed — Task 5)** — ChunkErrorBoundary and RouteErrorBoundary nesting gap (confidence: 71)

  **Description:** The story proposes wrapping lazy routes in `ChunkErrorBoundary`, but the existing `SuspensePage` helper (used by all ~40+ routes in `routes.tsx`) already wraps children in `RouteErrorBoundary`. If `ChunkErrorBoundary` is placed inside `SuspensePage`'s `RouteErrorBoundary`, and it catches a non-chunk error without re-throwing, the `RouteErrorBoundary`'s error reporting (`reportError` at line 107 of RouteErrorBoundary.tsx) is bypassed. The story's integration pattern at line 219 shows:
  ```tsx
  <ChunkErrorBoundary fallback={<OfflineRouteFallback />}>
    <Suspense fallback={<PageLoadingSkeleton />}>
      <LazyRouteComponent />
    </Suspense>
  </ChunkErrorBoundary>
  ```
  If this is nested inside the existing `<RouteErrorBoundary>` from `SuspensePage`, errors caught by `ChunkErrorBoundary` never reach `reportError`.

  **Fix:** The `ChunkErrorBoundary` should explicitly re-throw errors that are NOT chunk-load failures so they propagate to `RouteErrorBoundary`. Document the two-boundary interaction in a comment. Alternatively, replace `RouteErrorBoundary` with `ChunkErrorBoundary` in the wrapper and have `ChunkErrorBoundary` delegate non-chunk errors to the `RouteErrorFallback` component.

  **Autofix class:** `manual`

#### LOW

- **`vite.config.ts` (proposed — Tasks 2-3)** — GlobIgnores drift risk for new dependencies (confidence: 65)

  **Description:** The `globIgnores` list must be maintained as new large libraries are added to the project. If a new dependency (e.g., a heavy visualization library) is added without updating `globIgnores`, it will be included in the precache manifest, defeating the optimization goal. While not a direct vulnerability, over-precaching increases initial SW install time and bandwidth consumption on metered connections, which IS a security-relevant concern for users in low-bandwidth environments who rely on the PWA's lean install.

  **Fix:** Add a build step or CI check that warns if the precache manifest exceeds 3 MB, OR add a comment in `vite.config.ts` above the `globIgnores` block listing the commit/review checklist item for new dependency additions.

  **Autofix class:** `advisory`

### Secrets Scan

Clean — no secrets handling introduced in this story. The service worker does not handle BYOK API keys, tokens, or authentication credentials.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS2: Client-Side Injection (XSS) | Yes | No | The OfflineRouteFallback is static. No `dangerouslySetInnerHTML` or user-controlled `href`. The error boundary's error message display in dev mode follows the same safe pattern as the existing RouteErrorBoundary. |
| CS5: Flawed Client-Side Integrity | Yes | Yes | Missing `CacheableResponsePlugin` on route-chunks cache could allow error responses to be cached as valid content (HIGH finding). |
| CS7: Client-Side Security Logging | Yes | Advisory | The ChunkErrorBoundary may log error messages in dev mode. Ensure it does NOT log stack traces containing user data, consistent with existing RouteErrorBoundary pattern (line 105 only logs error message, not stack). |
| CS9: Client-Side Communication | Yes | No | No new postMessage handlers or cross-window communication introduced. The existing service worker's SKIP_WAITING message listener is unchanged. |
| A05: Security Misconfiguration | Yes | Advisory | globPatterns/globIgnores configuration drift is a maintenance concern (LOW finding). |

### What's Done Well

1. **Safe navigation in OfflineRouteFallback**: The "Go Home" button uses `navigate('/')` with a hardcoded relative path, preventing any open-redirect or script-injection via navigation.

2. **Design token usage specified**: The story explicitly requires `bg-card`, `text-muted-foreground`, and `variant="brand"` for the fallback component, following the project's design token system rather than hardcoded colors.

3. **RegisterRoute ordering awareness**: The story correctly notes that the route-chunks handler must be placed AFTER specific caching rules and BEFORE the navigation fallback. Wrong ordering in service worker routing can cause security bypasses (e.g., navigation requests being handled by a less restrictive cache handler).

4. **Pre-existing security patterns preserved**: The injectManifest strategy, existing 5 runtime caching rules, and SW lifecycle handlers are explicitly noted as preserved. The story builder appears to have read and respected the existing security-sensitive SW code (URL validation in push handlers, whitelisted notification fields, etc.).

### Recommendations for Implementation

1. Add `CacheableResponsePlugin` to route-chunks strategy as described in the HIGH fix.
2. Implement error type discrimination in `ChunkErrorBoundary` to distinguish chunk load failures from runtime errors.
3. Reduce route-chunks cache TTL to 1 day (content-hashed URLs make 7-day retention unnecessary).
4. Define the `ChunkErrorBoundary` / `RouteErrorBoundary` interaction in a code comment to prevent future maintenance errors.
5. Add a build-time warning if precache manifest exceeds 3 MB.

---
Phases: 3/8 | Findings: 5 total | Blockers: 0 | High: 1 | Medium: 3 | Low: 1 | False positives filtered: 0
