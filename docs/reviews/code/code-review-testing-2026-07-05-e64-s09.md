## Test Coverage Review: E64-S09 — Service Worker Precache Optimization

**Review type:** Pre-implementation testability analysis
**Status:** Story is `ready-for-dev` with 0 code changes — no tests exist yet to review
**Focus:** AC testability assessment, infrastructure gaps, and recommendations for test creation

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 0/5 ACs tested (**0%**)

**COVERAGE GATE:** Not applicable — story is pre-implementation. The gate will apply once code is committed.

### AC Coverage Table

| AC# | Description | Test Exists | Verdict | Notes |
|-----|-------------|-----------|---------|-------|
| 1 | `injectManifest.globPatterns` updated with selective patterns; precache < 3 MB | No | Not Yet Implemented | Build-time verification: inspect dist/sw.js precache manifest. Need utility to parse manifest entries and sum sizes. |
| 2 | Route chunks (tiptap, chart, pdf, AI SDKs) excluded via `globIgnores` | No | Not Yet Implemented | Build-time verification: confirm excluded patterns are absent from precache manifest. |
| 3 | Previously visited route loads from runtime cache when offline | No | Not Yet Implemented | SW-enabled E2E (preview server, port 4173). Story defers to "follow-up story". |
| 4 | App shell precached; offline renders with navigation | No | Not Yet Implemented | SW-enabled E2E with `context.setOffline(true)`. Story defers to "follow-up story". |
| 5 | All changes applied; no regressions; build succeeds | No | Not Yet Implemented | CI gate: `npm run build` + existing test suite must pass. Not a standalone test. |

**Coverage**: 0/5 ACs fully covered | 5 not yet implemented | 0 gaps/partial

---

### Pre-Implementation Testability Assessment

#### General Testability Findings

Story E64-S09 has well-defined ACs, but several require test infrastructure that does not yet exist or is explicitly deferred:

---

#### AC 1: Selective globPatterns + Precacle < 3 MB

**Testability: HIGH** — Build-time verification

This AC is the most straightforward to test. The pattern from E61-S02 (reading `dist/sw.js` and asserting on its content) can be reused:

```typescript
// Assert precache manifest contains critical assets
const swContent = readFileSync('dist/sw.js', 'utf-8')
expect(swContent).toContain('assets/react-vendor-')
expect(swContent).toContain('assets/dexie-')
```

**Infrastructure needs:**
- A new helper in `tests/support/helpers/sw-verification.ts` to:
  - Parse `self.__WB_MANIFEST` or `precacheAndRoute` entry points from the compiled SW
  - Extract manifest URLs and compute total size
  - Assert size < 3 MB (currently ~17 MB)
- Alternatively: a script that reads `dist/sw.js`, extracts URL patterns, sums sizes from `dist/` filesystem

---

#### AC 2: globIgnores Exclusions

**Testability: HIGH** — Build-time verification

Also build-time. The excluded chunks are well-documented:

```typescript
const EXCLUDED = ['webllm', 'tiptap', 'chart-', 'pdf-', 'jspdf', 'html2canvas', 'prosemirror', 'ai-']
// Assert none of these appear in precache section of dist/sw.js
```

**Infrastructure needs:**
- Same `sw-verification.ts` helper from AC 1 can include a `verifyExcludedFromPrecache(excludedPatterns)` function
- Each excluded pattern should have a corresponding test assertion to prevent regression

---

#### AC 3: Runtime Caching of Route Chunks

**Testability: MODERATE** — Requires SW-enabled E2E (preview server)

This AC requires:
1. A production build (`npm run build`)
2. Preview server (`npx vite preview --port 4173`)
3. Playwright test running against the preview server
4. `context.setOffline(true)` after navigating to a route

**Critical infrastructure gaps:**
- **No Playwright project for preview server**: The current `playwright.config.ts` only defines a dev server webServer (port 5173). SW is disabled in dev mode (`devOptions.enabled: false`).
- **No SW registration test fixture**: The E61-S02 test skips on port 5173. A proper fixture or helper to wait for SW registration is needed.
- **Story's own Testing Notes say**: "E2E tests for offline behavior can be added in a follow-up story (requires Playwright `context.setOffline(true)`)".
  - **This is a gap**: AC 3 (and AC 4) describe offline behavior that cannot be verified without E2E tests against the production build. Deferring these tests means these ACs cannot be gated.

**Recommendation:** Add a second Playwright webServer config for the preview server (port 4173), or add a `test:e2e:preview` npm script that:
1. Runs `npm run build` first
2. Starts `vite preview --port 4173`
3. Runs Playwright with `BASE_URL=http://localhost:4173`

---

#### AC 4: Offline App Shell with Navigation

**Testability: MODERATE** — Requires SW-enabled E2E

Same infrastructure requirements as AC 3. Additionally:

- Needs to verify that the app shell (nav, header) renders but route content shows the offline fallback
- The existing `offline-awareness.spec.ts` and `offline-smoke.spec.ts` test basic offline behavior but **do not verify SW precache** — they rely on SPA client-side routing, not SW cache. These are not sufficient for this AC.

**Infrastructure needs:**
- A shared E2E test pattern: `navigateAndCacheRoute(page, '/some-route')` → go offline → verify route renders
- A `waitForServiceWorkerRegistration(page)` helper

---

#### AC 5: No Regressions (Build + Existing Features)

**Testability: HIGH** — CI gate

- `npm run build` must succeed (this will be caught by CI)
- Existing SW features (PWAUpdatePrompt, PWAInstallBanner, offline shell, image caching) should continue working
- **Implicit sub-AC**: The 5 existing runtime caching rules in `src/sw.ts` (local images, Unsplash, HuggingFace, AI API, ABS proxy) must be preserved
- The route-chunk `registerRoute` must come AFTER the existing 5 rules and BEFORE the navigation fallback (per story Implementation Notes)

**Infrastructure needs:**
- Build-time assertions for the 5 existing rules (order-sensitive). Add assertions to the SW verification helper that:
  - Count `registerRoute` calls
  - Verify order: images → Unsplash → HF → AI API → ABS → route-chunks → navigation fallback

---

### Test Infrastructure Gaps

#### Gap 1: No SW build verification helper (HIGH)

**Location:** Should be created at `tests/support/helpers/sw-verification.ts`
**Why:** Verifying precache content, size, and exclusions requires parsing the compiled service worker. Currently, the E61-S02 test reads `dist/sw.js` with raw `readFileSync` and does basic string containment checks. This approach should be extracted into a reusable helper.

**Suggested API:**
```typescript
verifyPrecacheContains(swContent: string, patterns: string[]): void
verifyPrecacheExcludes(swContent: string, patterns: string[]): void
verifyPrecacheUnderSize(swContent: string, maxBytes: number): Promise<void>
verifyRuntimeCacheRule(swContent: string, cacheName: string): void
verifyRouteOrder(swContent: string, expectedOrder: string[]): void
```

#### Gap 2: No preview server Playwright config (HIGH)

**Location:** `playwright.config.ts`
**Why:** AC 3 and AC 4 require SW registration, which only works in production mode. The current config only starts the Vite dev server.

**Suggested addition:**
```typescript
// In playwright.config.ts or a separate file
// A project that first builds and then serves via preview
{
  name: 'preview',
  use: { baseURL: 'http://localhost:4173' },
  // Override webServer to build + preview
}
```

Alternatively, document that these tests run separately:
```bash
npm run build && npx vite preview --port 4173 &
BASE_URL=http://localhost:4173 npx playwright test --grep "preview"
```

#### Gap 3: No SW registration wait utility (MEDIUM)

**Location:** `tests/support/helpers/sw-registration.ts`
**Why:** SW registration is async and takes time, especially with a production build. Tests need a reliable `waitForSWReady(page)` helper.

**Suggested API:**
```typescript
async function waitForSWRegistration(page: Page): Promise<boolean>
async function isSWActive(page: Page): Promise<boolean>
async function clearSWCache(page: Page, cacheName: string): Promise<void>
```

#### Gap 4: OfflineRouteFallback and ChunkErrorBoundary have no tests (HIGH)

**Components to be created:**
- `src/app/components/OfflineRouteFallback.tsx`
- `src/app/components/ChunkErrorBoundary.tsx`

**New unit tests needed:**
- `src/app/components/__tests__/OfflineRouteFallback.test.tsx`
  - Renders correct heading "This page isn't available offline"
  - Shows "Go Home" button
  - "Go Home" button navigates to `/`
  - Uses design tokens (`bg-card`, `text-muted-foreground`)

- `src/app/components/__tests__/ChunkErrorBoundary.test.tsx`
  - Wraps children and renders them when no error
  - Catches TypeError (chunk load error) and shows offline fallback
  - Shows generic error with retry button when online (`navigator.onLine = true`)
  - Shows OfflineRouteFallback when offline (`navigator.onLine = false`)
  - Resets error state when going back online (window event listener)

#### Gap 5: ChunkErrorBoundary needs online/offline detection verification (MEDIUM)

**Story spec:** "The error boundary should distinguish online/offline — only show the custom fallback when `!navigator.onLine`"
This requires mocking `navigator.onLine` and the `online`/`offline` window events in a unit test.

**Existing precedent:** `ErrorBoundary.test.tsx` shows how to test error boundaries in this codebase. The `ChunkErrorBoundary` test should follow the same pattern.

#### Gap 6: Order-sensitive registerRoute assertions needed (MEDIUM)

**Story spec:** "The route-chunk `registerRoute` must come AFTER the existing 5 runtime caching rules and BEFORE the navigation fallback"
This is a build-time verification: read `dist/sw.js` and check the order of `registerRoute` calls or matching URL patterns. A regex-based order check can verify:

1. Local images (`/^\/images\/.../i`)
2. Unsplash (`/^https:\/\/images\.unsplash\.com\/.../i`)
3. HuggingFace (`/^https:\/\/huggingface\.co\/.../i`)
4. AI API (`/\/api\/ai\/.*/i`)
5. ABS proxy (`/\/api\/abs\/proxy\//`)
6. Route chunks (`/^\/assets\/.*\.js$/i`) — **new**
7. Navigation fallback (NavigationRoute)

---

### E2E Test File Recommendation

Create `tests/e2e/story-e64-s09.spec.ts` with the following structure:

```typescript
// Build-time tests (run on any environment)
test.describe('E64-S09: Build Verification', () => {
  test('AC 1: Precache manifest contains critical app shell assets', () => { ... })
  test('AC 1: Total precache size is under 3 MB', () => { ... })
  test('AC 2: Route-specific chunks are excluded from precache', () => { ... })
  test('AC 2: excluded chunks not in dist/ or manifest', () => { ... })
  test('AC 5: Existing runtime cache rules preserved', () => { ... })
  test('AC 5: Route-chunk registerRoute is ordered correctly', () => { ... })
})

// SW-enabled tests (preview server only, port 4173)
test.describe('E64-S09: Runtime Caching (preview server only)', () => {
  test('AC 3: Route chunk is runtime-cached after first visit', () => { ... })
  test('AC 4: Previously cached route loads offline', () => { ... })
  test('AC 4: Unvisited route shows offline fallback offline', () => { ... })
})
```

Tests should be written alongside implementation, not deferred.

---

### Summary of Findings

#### Blockers (pre-implementation gaps)
- **(confidence: 90)** AC 3 and AC 4 describe offline behavior that requires SW-enabled E2E tests against a production build, but the story's own Testing Notes defer this to a follow-up story. These ACs cannot be gated without these tests. Consider including a preview-server test project in this story, or formally moving ACs 3 and 4 to a follow-up.

#### High Priority
- **(confidence: 95)** AC 1 (precache < 3 MB) and AC 2 (globIgnores) have no build-time verification helper. Create `tests/support/helpers/sw-verification.ts` with functions to extract and assert precache manifest content and size, reusable by this story and future SW stories.
- **(confidence: 90)** AC 5 includes preserving 5 existing runtime caching rules in order, but there is no test infrastructure to verify the order of `registerRoute` calls in the compiled SW. The route-chunk rule must come after images/Unsplash/HF/AI/ABS and before the navigation fallback.

#### Medium
- **(confidence: 85)** The `OfflineRouteFallback` and `ChunkErrorBoundary` components have no test plan. Unit tests should be created alongside the components, following the pattern in `ErrorBoundary.test.tsx`.
- **(confidence: 80)** No `waitForServiceWorkerRegistration()` utility exists. SW registration is async and required for AC 3/4 E2E tests. Pattern from E61-S02's `navigator.serviceWorker.getRegistration()` can be extracted to a helper.
- **(confidence: 80)** `playwright.config.ts` has no preview-server project. AC 3/4 E2E tests require a production build + preview server on port 4173. A second webServer config or separate test script is needed.

#### Nits
- **(confidence: 90)** The story references `pwa-*.png` and `shortcuts/*.png` in globPatterns but the current vite.config.ts PWA manifest uses specific filenames (`pwa-192x192.png`, `pwa-512x512.png`). Verify these patterns match actual build output in Task 1.
- **(confidence: 85)** The `globIgnores` list includes `**/*.woff2` but the story says "Do not precache fonts: `woff2` files are excluded via `globIgnores` and cached at runtime instead." There is no runtime caching rule for fonts in the story spec or existing sw.ts. Fonts may 404 at runtime. Recommend adding a `CacheFirst` rule for woff2 files in sw.ts.

### Edge Cases to Consider

1. **Build chunk name variance**: Vite chunk names depend on module graph and can change with dependencies. The glob patterns in the story are illustrative. Task 1 validates against actual build output, but tests should use flexible patterns (e.g., `assets/*.js` for CSS) or auto-discover chunk names from the dist directory.

2. **Route-chunk caching on `/` navigation**: The app shell is precached, but the route-chunk `registerRoute` regex `/^\/assets\/.*\.js$/i` matches ALL JS assets. Verify this does not conflict with the navigation handler or cause duplicate caching.

3. **"Go offline" after visiting `/reports` on first load**: If the route chunk is still being downloaded when the network goes offline, the `StaleWhileRevalidate` strategy could fail. Test this timing edge case.

4. **Multiple tabs**: If a user has two tabs open and one triggers the SW update while offline, the second tab's route-chunk cache access could race. Not a blocker but worth noting.

5. **Cache invalidation**: Route chunks are cached for 7 days. If a new build ships with updated chunk hashes, the old cached chunk will 404 on the new page. Verify that `StaleWhileRevalidate` fetches the new version when online.

---

ACs: 0/5 covered (pre-implementation) | Findings: 7 | Blockers: 1 | High: 2 | Medium: 3 | Nits: 1
