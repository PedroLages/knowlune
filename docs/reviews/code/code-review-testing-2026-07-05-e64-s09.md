## Test Coverage Review: E64-S09 — Service Worker Precache Optimization

**Review type**: Pre-implementation spec review (no code written yet)
**Review date**: 2026-07-05

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (80% meets minimum threshold)

### AC Coverage Table

| AC# | Description | Proposed Unit Test | Proposed E2E Test | Verdict |
|-----|-------------|--------------------|--------------------|---------|
| 1 | Precache <3MB, only critical app shell assets (index.html, entry JS, React vendor, Router, Radix UI, Dexie, CSS, SVG, PNG) | None | `story-e64-s09.spec.ts` build-time: `verifyPrecacheContains(criticalPatterns)`, `verifyPrecacheUnderSize(<3MB)` | Covered |
| 2 | Route chunks excluded from precache via `globIgnores`; chunk cached via `StaleWhileRevalidate` runtime strategy with `cacheName: 'route-chunks'` | None | `story-e64-s09.spec.ts` build-time: `verifyPrecacheExcludes(routeChunks)`, `verifyRuntimeCacheRule('route-chunks')`, `verifyRouteOrder([..., 'fonts', 'route-chunks', ...])` | Covered |
| 3 | App shell renders offline with navigation; unvisited routes show "This page isn't available offline yet" | `OfflineRouteFallback.test.tsx` — renders heading, "Go Home" button, navigates to `/`; `ChunkErrorBoundary.test.tsx` — catches chunk TypeError, shows offline fallback | `story-e64-s09.spec.ts` SW-enabled: navigate to unvisited route offline, verify fallback message | Covered |
| 4 | Previously visited routes load JS chunk from runtime cache when offline | None | `story-e64-s09.spec.ts` SW-enabled: visit `/reports`, go offline, verify page structure renders | Covered |
| 5 | Existing features preserved (PWAUpdatePrompt, PWAInstallBanner, offline app shell, image caching) | None | Build-time: `verifyRouteOrder` confirms all 7 rules present in correct order; story mentions `npm run ci` regression pass | Partial |

**Coverage**: 4/5 ACs fully covered | 1 partial | 0 gaps

### Test Quality Findings

#### Blockers (untested ACs)

None. All ACs have at least proposed test coverage.

#### High Priority

1. **(confidence: 88)** AC 5 "Existing features preserved" has no explicit automated test for the three stated features:
   - **PWAUpdatePrompt** — no test verifies the update prompt still triggers when a new SW is detected
   - **PWAInstallBanner** — no test verifies the install banner still fires
   - **Image caching** — no test verifies that `Unsplash` or `local-images` cache rules actually serve cached images offline
   The story relies on `npm run ci` passing as a regression signal, but CI is not an exhaustive PWA feature audit. Suggested addition: a SW-enabled E2E test in `story-e64-s09.spec.ts` that verifies image cache strategy via `page.evaluate(() => caches.open('local-images').then(...))` and checks that an image URL resolves from cache when offline.

2. **(confidence: 85)** `ChunkErrorBoundary` error discrimination is untested. The implementation notes (Section 5.4) describe critical behavior:
   - Must **re-throw non-chunk errors** to `RouteErrorBoundary` (via checking `error.message` for chunk-specific patterns like `"dynamically imported module"`, `"Loading chunk"`, etc.)
   - Must **not silently suppress errors** — if unsure, delegate to `RouteErrorBoundary`
   - This is the most error-prone piece of the story yet has no proposed test case for the false-positive path (non-chunk error caught and displayed as offline)
   - **Suggested test**: In `ChunkErrorBoundary.test.tsx`, add `it('re-throws non-chunk errors to RouteErrorBoundary')` that asserts a generic TypeError (e.g., `new Error('Something broke')`) causes the fallback to NOT match offline patterns.

3. **(confidence: 80)** Font runtime caching has no automated verification. The story adds a `CacheFirst` rule for `woff2` (cacheName: 'fonts', 50 entries, 30 days) and explicitly excludes fonts from precache. But no test verifies fonts load offline:
   - **Suggested test**: In the SW-enabled E2E suite, add a test that opens a page online (to cache fonts), goes offline, then verifies font loading via `document.fonts.ready` or by checking the Cache API via `page.evaluate(() => caches.open('fonts').then(cache => cache.match(url)))`.

4. **(confidence: 78)** `ChunkErrorBoundary` behavior when online but chunk fetch fails receives no test. The spec says "Show a generic error with retry button when online" but the proposed tests only cover the offline path:
   - **Suggested test**: In `ChunkErrorBoundary.test.tsx`, add `it('shows generic error with retry when online and chunk fails')` that mocks `navigator.onLine = true`, triggers a chunk load error, and asserts the generic error UI (not the offline fallback).

5. **(confidence: 75)** `ChunkErrorBoundary` reset on `online` event is untested. The spec says "Reset error state when going back online (`window.addEventListener('online', ...)`)":
   - **Suggested test**: In `ChunkErrorBoundary.test.tsx`, add `it('resets error state when going back online')` that triggers a chunk error (enters fallback state), dispatches an `online` event, and asserts the component re-renders children.

6. **(confidence: 72)** No test verifies the service worker actually registers and activates. The build-time tests verify `sw.js` content but not the runtime SW lifecycle:
   - **Suggested test**: In the SW-enabled E2E suite, add `it('SW registers and activates after page load')` that waits for `navigator.serviceWorker.ready` and asserts the active SW's scriptURL includes `sw.js`.

7. **(confidence: 70)** Precache over 3MB (boundary violation). The spec tests `underSize(3MB)` but degenerate configurations need verifying:
   - **Suggested test**: In the build-time suite, add `it('rejects precache over 3MB with clear error message')` — use `verifyPrecacheUnderSize(maxBytes)` with the computed value, verifying it fails (or warns) when exceeded.

#### Medium

8. **(confidence: 65)** `sw-verification.ts` helper operates in Node.js context (reads `dist/sw.js` via `fs`) but lives inside `tests/support/helpers/` alongside browser-interaction helpers. This is an architectural concern: build-time helpers that do pure file I/O don't need Playwright context. Consider whether these belong in a separate module or are better as pure Vitest tests (not Playwright). The story does not specify whether these helpers should be usable outside Playwright.

9. **(confidence: 60)** SW-enabled tests require `vite preview` on port 4173. The story describes a bash invocation pattern (`npm run build && npx vite preview --port 4173 &`) but does not specify how this integrates with Playwright's project configuration or CI pipeline. Missing from the spec:
   - `playwright.config.ts` project definition for `preview` that uses `BASE_URL=http://localhost:4173`
   - `webServer` config for auto-starting/stopping the preview server
   - Global setup/teardown for the preview server lifecycle
   Without this, the SW-enabled tests exist outside the normal `npx playwright test` invocation, increasing the chance they are skipped in CI.

10. **(confidence: 55)** Build-time tests (AC 1, 2) live in the same E2E spec file as SW-enabled tests. This creates a dependency: build-time tests need `dist/` to exist, SW-enabled tests need a preview server. Mixing them means the entire file can only run during specific conditions. Consider splitting into `story-e64-s09-build.spec.ts` and `story-e64-s09-sw.spec.ts` to allow independent execution.

#### Nits

11. **Nit** `sw-verification.ts` function names (`verifyPrecacheContains`, `verifyPrecacheExcludes`) would pass even if the precache manifest is empty (both assertions would be vacuously true). Suggested: `verifyPrecacheContains` should assert at least N matching entries are found, not just that the pattern exists. For example, `expect(matches.length).toBeGreaterThan(0)`.

12. **Nit** The OfflineRouteFallback unit test should check the `data-testid` or aria-label on the "Go Home" button, and verify it uses `variant="brand"`. The spec mentions design tokens (`bg-card`, `text-muted-foreground`) — asserting these via component tests requires a DOM snapshot or class assertion.

13. **Nit** Story specifies `create tests/support/helpers/sw-verification.ts` (Task 6.6) but the file path has a typo: `sw-verification.ts` vs typo `sw-verification.ts` in the task description (the filename is correct as `sw-verification.ts`). No impact — just confirming the naming.

### Edge Cases to Consider

1. **Empty precache manifest**: If `globPatterns` matches zero files (e.g., wrong patterns after build output changes), the SW compile succeeds but no assets are precached. The build-time test should verify at minimum `index.html` is always precached.

2. **Hash changes in chunk names**: Vite content-hashed filenames change on every build. The `globPatterns` patterns (e.g., `assets/index-*.js`) use wildcards, which should tolerate hash changes. But if Vite changes its output naming convention, the tests would need updating. The `verifyPrecacheContains` helper should report which critical patterns are missing, not just pass/fail.

3. **Cross-browser SW behavior**: Chromium and WebKit have different SW implementations. The SW-enabled tests target Chromium (desktop) only per the story. Mobile Safari and Firefox SW behavior (e.g., `Cache-Control: no-cache` headers blocking cache puts) are untested. This is an acceptable scope limitation for this story but should be documented.

4. **Route order regression**: If a future developer adds a new `registerRoute` call in the wrong position (between `route-chunks` and `navigation-fallback`), the `verifyRouteOrder` test catches it only if the expected array is updated. The test should use an explicit ordered array (as proposed) and fail loudly on unexpected routes.

5. **Concurrent SW updates**: While the SW is being updated (install -> waiting -> activate cycle), there's a window where the old SW handles requests but the precache manifest has changed. The "existing features preserved" AC should note this race condition is out of scope.

6. **ChunkErrorBoundary suppressing genuine TypeError for reportError**: If a TypeError is thrown for non-chunk reasons (e.g., a bug in component code that throws `TypeError: Cannot read properties of null`), the error discrimination logic must not misclassify it as a chunk load error. The check for `navigator.onLine` provides a secondary guard, but if offline, a genuine TypeError in app code would incorrectly show "not available offline" instead of the RouteErrorFallback. The story notes this risk explicitly (Section 5.4: "Never silently suppress errors") but there is no test for this false-positive path.

### Feasibility Assessment

**SW testing approach is feasible** overall, with these practical observations:

1. **`context.setOffline(true)` + SW**: Playwright's `setOffline` causes `fetch()` to reject, which the SW runtime handlers intercept. The SW's `StaleWhileRevalidate` strategy falls back to cache on fetch failure. This works correctly in Chromium and matches the pattern used in the existing `offline-awareness.spec.ts`.

2. **Build-time tests in Playwright**: Reading `dist/sw.js` with `fs.readFileSync` works in Playwright spec files (Node.js context before page navigation). The `sw-verification.ts` helper can safely import `fs` and `path`.

3. **SW lifecycle timing**: Tests must wait for SW activation before testing offline behavior. Using `page.waitForFunction(() => navigator.serviceWorker.ready.then(...))` ensures the SW is active. The story does not mention this wait — it should be added to the test pattern.

4. **Preview server management**: The two-env approach (dev server for build tests, preview for SW tests) adds CI complexity. Recommend defining a Playwright `webServer` config in `playwright.config.ts` for the preview project.

5. **Component-testing ChunkErrorBoundary**: The error discrimination logic checks `error.message` for chunk-specific patterns and `navigator.onLine`. Both are straightforward to mock in Vitest/jsdom:
   - `error.message` is just a string match — easy to test with different error objects
   - `navigator.onLine` can be mocked via `Object.defineProperty(navigator, 'onLine', { value: false })`
   - The `window.addEventListener('online', ...)` reset can be triggered by dispatching `window.dispatchEvent(new Event('online'))`
   - The existing `ErrorBoundary.test.tsx` pattern (lines 1-105) provides a solid template for this approach

---
ACs: 4 covered / 5 total | Findings: 13 | Blockers: 0 | High: 7 | Medium: 3 | Nits: 3
