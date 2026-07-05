---
story_id: E64-S09
story_name: "Service Worker Precache Optimization"
status: ready-for-dev
started:
completed:
reviewed: in-progress
review_started: 2026-07-05
review_gates_passed: []
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - bundle-analysis
  - code-review
  - code-review-testing
  - security-review
  - glm-code-review
burn_in_validated: false
---

# Story 64.9: Service Worker Precache Optimization

> **Updated 2026-07-05**: Updated to target `injectManifest` strategy (from E61-S01) instead of `workbox` config block. The core optimization goal is unchanged — reduce precache from ~17 MB to <3 MB. Only the configuration location and approach have changed: `globPatterns`/`globIgnores` live in `injectManifest` config, and route-chunk runtime caching is added to `src/sw.ts` via `registerRoute()`.

**Depends on**: E61-S01 (injectManifest migration must be in place). Can run in parallel with E61-S02 — they touch different sections of `src/sw.ts`.

## Story

As a Knowlune user on a slow or metered connection,
I want the service worker to only predownload essential files,
so that my initial app install is fast and doesn't consume excessive bandwidth.

## Acceptance Criteria

### Precache Size Reduction

**Given** the `injectManifest` configuration in `vite.config.ts` is updated with selective `globPatterns`
**When** a production build generates the service worker
**Then** the precache manifest contains only critical app shell assets (index.html, entry JS, React vendor, router, Radix UI, Dexie, CSS, SVG icons, PNG favicons)
**And** the total precache size is under 3 MB (down from ~17 MB with `'**/*.{js,css,html,svg,png,webp,woff2}'`)

### Route Chunk Runtime Caching

**Given** route-specific chunks (tiptap, chart, pdf, AI SDKs, etc.) are excluded from precache via `globIgnores`
**When** the user navigates to a route for the first time (e.g., `/reports`)
**Then** the route chunk is downloaded via network and cached via `StaleWhileRevalidate` runtime strategy with `cacheName: 'route-chunks'`

**Given** the user has visited `/reports` previously (route chunk is runtime-cached)
**When** the user goes offline and navigates to `/reports`
**Then** the route chunk loads from the runtime cache and the page structure renders (navigation, layout, headings), even if data-dependent sections show empty/loading states. Data persistence is handled by IndexedDB and is out of scope for this story.

### Offline Fallback

**Given** the app shell is precached
**When** the user opens Knowlune offline (never having visited specific routes)
**Then** the app shell renders with navigation
**And** routes that haven't been visited show a meaningful offline message ("This page isn't available offline yet") instead of a blank page

### Existing Features Preserved

**Given** all changes are applied
**When** `npm run build` succeeds and the app is loaded
**Then** existing PWA features continue to work: SW update prompt (`PWAUpdatePrompt`), install banner (`PWAInstallBanner`), offline app shell, runtime-cached images

## Tasks / Subtasks

- [ ] Task 1: Validate current build chunk names (prerequisite)
  - [ ] 1.1 Run `npm run build` and inspect `dist/assets/` for actual chunk file names
  - [ ] 1.2 Identify which chunks are: entry JS, React vendor, React Router, Radix UI, Dexie, style-utils, CSS
  - [ ] 1.3 Identify large optional chunks: tiptap, prosemirror, chart, pdf/jspdf, html2canvas, AI SDKs, webllm
  - [ ] 1.4 Update `globPatterns` and `globIgnores` patterns to match actual Vite output naming

- [ ] Task 2: Update `globPatterns` in `injectManifest` config (AC: 1)
  - [ ] 2.1 In `vite.config.ts`, replace the catch-all `globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}']` with critical-only patterns
  - [ ] 2.2 Critical patterns: `index.html`, entry JS chunk, React vendor chunk, React Router chunk, Radix UI chunks, Dexie chunk, CSS files, SVG icons, PNG favicons
  - [ ] 2.3 Do NOT include: fonts (large, runtime-cache instead), route chunks, optional library chunks

- [ ] Task 3: Update `globIgnores` in `injectManifest` config (AC: 2)
  - [ ] 3.1 Add explicit ignores for all large optional chunks identified in Task 1
  - [ ] 3.2 Minimum ignores: `mockServiceWorker.js`, `webllm*.js`, `ai-*.js`, `tiptap*.js`, `prosemirror*.js`, `chart-*.js`, `pdf-*.js`, `jspdf*.js`, `html2canvas*.js`, `seedCourses*.js`
  - [ ] 3.3 Preserve existing ignores if any

- [ ] Task 4: Add runtime caching rules in `src/sw.ts` (AC: 2, 3)
  - [ ] 4.0 Add font runtime caching rule **before** the route-chunks rule: `CacheFirst` strategy matching `/\/assets\/.+\.woff2$/i`, `cacheName: 'fonts'`, with `CacheableResponsePlugin({ statuses: [0, 200] })` (matching the pattern used by all other runtime caching rules in `sw.ts`), `ExpirationPlugin` with `maxEntries: 50`, `maxAgeSeconds: 30 * 24 * 60 * 60` (30 days). The `CacheableResponsePlugin` is essential — without it, transient CDN failures fill the `ExpirationPlugin`'s `maxEntries` slots with failed entries, evicting successfully cached fonts and causing FOUT when offline. This prevents a regression — woff2 is excluded from precache via `globIgnores` and would otherwise hit `setDefaultHandler(new NetworkOnly())`, causing fonts to fail offline.
  - [ ] 4.1 Add `registerRoute()` with `StaleWhileRevalidate` strategy for `/assets/.*\.js$/`
  - [ ] 4.2 Configure `cacheName: 'route-chunks'` with `CacheableResponsePlugin` (statuses: [0, 200]) and `ExpirationPlugin`: `maxEntries: 100`, `maxAgeSeconds: 24 * 60 * 60` (1 day — Vite content-hashed URLs make longer TTLs unnecessary after a new deployment)
  - [ ] 4.3 Place both rules **after** existing runtime caching rules (images, Unsplash, HF, AI API, ABS proxy) and **before** the navigation fallback
  - [ ] 4.4 Verify existing 5 runtime caching rules are preserved

- [ ] Task 5: Add offline fallback for unvisited routes (AC: 4)
  - [ ] 5.1 Create `src/app/components/OfflineRouteFallback.tsx` — displays "This page isn't available offline yet" with a "Go Home" button
  - [ ] 5.2 Style using design tokens: `bg-card`, `text-muted-foreground`, `text-brand` for the button
  - [ ] 5.3 Wrap lazy-loaded routes in an error boundary that catches chunk load failures (TypeError from failed dynamic import)
  - [ ] 5.4 The error boundary should distinguish chunk load failures from other runtime errors by checking `error.message` for chunk-load-specific patterns (`"dynamically imported module"`, `"Loading chunk"`, `"Importing a module script failed"`, `"Failed to fetch dynamically imported module"`). Implement as a class component with `componentDidCatch` storing the error in state, and `render()` branching on `this.state.hasError`:
    - **Chunk load failure + offline** (`!navigator.onLine`): render `<OfflineRouteFallback />`. No `reportError()` needed — offline is expected.
    - **Chunk load failure + online**: call `reportError(error, { context: 'ChunkErrorBoundary' })` (import from `@/lib/errorTracking`) and render a generic error with retry button. This ensures CDN outages and corrupted deployment assets are monitored.
    - **Non-chunk error**: re-throw via `throw this.state.error` in `render()` — NOT in `componentDidCatch`. Throwing in the `render()` method after the error type check propagates the error to the parent `RouteErrorBoundary`, which handles `reportError()` and the correct fallback UI. Throwing in `componentDidCatch` does NOT propagate to parent boundaries and would silently swallow the error.
  - [ ] 5.5 Modify the `SuspensePage` helper in `src/app/routes.tsx` (line ~200) to wrap children in `ChunkErrorBoundary` between `RouteErrorBoundary` and `Suspense`. Import using relative paths matching the existing convention (`'./components/ChunkErrorBoundary'` and `'./components/OfflineRouteFallback'`, same as the existing `'./components/RouteErrorBoundary'` import). This covers all ~40+ lazy routes with a single change:

    ```tsx
    function SuspensePage({ children }: { children: React.ReactNode }) {
      return (
        <RouteErrorBoundary>
          <ChunkErrorBoundary fallback={<OfflineRouteFallback />}>
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </ChunkErrorBoundary>
        </RouteErrorBoundary>
      )
    }
    ```

    This ensures `ChunkErrorBoundary` catches dynamic `import()` failures (TypeError) before `RouteErrorBoundary`, while still allowing `RouteErrorBoundary` to catch render errors and report them via `reportError()`.

- [ ] Task 6: Verify precache size and build (AC: 1, 5)
  - [ ] 6.1 Run `npm run build` and inspect `dist/sw.js` precache manifest
  - [ ] 6.2 Calculate total precache asset sizes — must be under 3 MB
  - [ ] 6.3 Verify all critical app shell assets are in precache
  - [ ] 6.4 Verify excluded chunks (tiptap, chart, pdf, AI, etc.) are NOT in precache
  - [ ] 6.5 Verify route-chunk AND font runtime caching rules are present in compiled SW, and all 7 `registerRoute` calls appear in the correct order (images → Unsplash → HF → AI API → ABS proxy → fonts → route-chunks → navigation fallback)
  - [ ] 6.6 Create `tests/support/helpers/sw-verification.ts` with reusable functions (`verifyPrecacheContains`, `verifyPrecacheExcludes`, `verifyPrecacheUnderSize`, `verifyRuntimeCacheRule`, `verifyRouteOrder`) and create `tests/e2e/story-e64-s09.spec.ts` with build-time verification tests:
    - precache manifest: `verifyPrecacheContains` for critical assets (index.html, react-vendor, dexie, etc.)
    - precache exclusions: `verifyPrecacheExcludes` for excluded chunks (tiptap, chart, pdf, AI, webllm)
    - route order: `verifyRouteOrder` asserts 8 registerRoute calls in correct order
    - precache boundary: `verifyPrecacheUnderSize` passes with 3MB limit; fails on degenerate configs that exceed it (verifying the check works, not vacuously passing on an empty manifest)
    - `globPatterns` includes `assets/*.svg` for imported SVG coverage
  - [ ] 6.7 Verify `globPatterns` includes `assets/*.svg` for Vite-imported SVGs (e.g., `import logoUrl from './logo.svg'` emits to `dist/assets/logo-[hash].svg`). Without this, lazy-loaded component SVGs render as broken images offline.

- [ ] Task 7: Test offline behavior and write E2E tests (AC: 2, 3, 4)
  - [ ] 7.1 `npm run preview`, open app, visit `/reports` (caches route chunk)
  - [ ] 7.2 Go offline (DevTools > Network > Offline), verify `/reports` loads from cache with page structure rendering
  - [ ] 7.3 Go offline, navigate to unvisited route — verify custom `OfflineRouteFallback` message
  - [ ] 7.4 Go online, verify route loads normally (not stuck on fallback)
  - [ ] 7.5 Verify fonts load offline (no FOUT on any page) — confirm the `fonts` runtime cache works
  - [ ] 7.6 Run `npm run ci` — all existing tests pass, no regressions
  - [ ] 7.7 Write E2E SW-enabled tests in `tests/e2e/story-e64-s09.spec.ts` for AC 3 (route chunk loads offline) and AC 4 (app shell + offline fallback), using `context.setOffline(true)` against `vite preview` on port 4173
  - [ ] 7.8 Write unit tests for `OfflineRouteFallback.test.tsx` and `ChunkErrorBoundary.test.tsx` following the pattern in `src/app/components/__tests__/ErrorBoundary.test.tsx`. Required test cases:
    - **OfflineRouteFallback**: renders heading text, "Go Home" button uses `variant="brand"`, component uses design tokens (`bg-card`, `text-muted-foreground`, `rounded-2xl`)
    - **ChunkErrorBoundary — chunk failure + offline**: renders `OfflineRouteFallback` when `navigator.onLine` is false and error is a chunk load failure
    - **ChunkErrorBoundary — chunk failure + online**: calls `reportError()` and renders generic error with retry button when `navigator.onLine` is true and error is a chunk load failure. Verify `reportError` is called with `{ context: 'ChunkErrorBoundary' }`.
    - **ChunkErrorBoundary — non-chunk error re-throw**: non-chunk `TypeError` propagates to parent `RouteErrorBoundary` (verify `RouteErrorFallback` renders, not `OfflineRouteFallback`). Test that the re-throw happens in `render()`, not `componentDidCatch`.
    - **ChunkErrorBoundary — reset on online event**: dispatching `window.dispatchEvent(new Event('online'))` resets error state and re-renders children
    - **ChunkErrorBoundary — oscillation guard**: after 3+ consecutive failures within 30s, enters persistent error state requiring manual "Retry" click (debounces `online` event auto-retry)
  - [ ] 7.9 Write SW-enabled E2E test for font offline loading: open a page online (caches woff2 via `CacheFirst`), go offline (`context.setOffline(true)`), verify `document.fonts.ready` resolves and no FOUT via visual regression or Cache API match for `cacheName: 'fonts'`
  - [ ] 7.10 Write SW-enabled E2E test for SW registration: wait for `navigator.serviceWorker.ready`, assert `active.scriptURL` includes `sw.js`
  - [ ] 7.11 AC 5 verification — regression tests for existing features:
    - PWAUpdatePrompt: verify the update prompt component still renders when `workbox-window` detects a waiting SW
    - PWAInstallBanner: verify `beforeinstallprompt` event handling and install button visibility
    - Image caching: verify existing `registerRoute` rules for local-images, unsplash-images, hf-models are preserved in compiled `sw.js`
    - Run `npm run ci` — all existing tests pass, no regressions

## Design Guidance

The `OfflineRouteFallback` component should be minimal and on-brand:
- Centered card with the Knowlune icon or a Wi-Fi-off icon
- "This page isn't available offline" heading
- "Visit it while connected to access it later" body text
- "Go Home" link/button using `variant="brand"`
- Use design tokens: `bg-card`, `text-muted-foreground`, rounded-2xl card

## Implementation Notes

### injectManifest Config Changes (`vite.config.ts`)

```ts
// vite.config.ts — Updated injectManifest config
VitePWA({
  // NOTE: Keep registerType: 'autoUpdate' and swSrc: 'sw.ts' from current config.
  // These values are set earlier in the file; only injectManifest.globPatterns
  // and injectManifest.globIgnores are changed by this story.
  registerType: 'autoUpdate',
  // ... manifest unchanged from E61-S01 ...
  injectManifest: {
    swSrc: 'sw.ts',
    // ✅ Updated: only critical app shell
    globPatterns: [
      'index.html',
      'assets/index-*.js',           // entry point
      'assets/react-vendor-*.js',    // React + ReactDOM
      'assets/react-router-*.js',    // React Router
      'assets/radix-ui-*.js',        // Radix UI primitives (may be multiple chunks)
      'assets/dexie-*.js',           // Dexie/IndexedDB
      'assets/style-utils-*.js',     // clsx + tailwind-merge
      'assets/*.css',                // All CSS (tailwind output)
      'assets/*.svg',                // Imported SVGs (Vite emits to dist/assets/)
      '*.svg',                       // Root SVG icons (favicon, etc.)
      'pwa-*.png',                   // PWA icons
      'apple-touch-icon-*.png',      // Apple touch icon
      'shortcuts/*.png',             // Shortcut icons
    ],
    // ✅ Updated: exclude large optional chunks
    globIgnores: [
      '**/mockServiceWorker.js',
      '**/webllm*.js',               // ~8 MB WebLLM models
      '**/ai-*.js',                  // AI SDK chunks
      '**/tiptap*.js',               // Tiptap editor
      '**/prosemirror*.js',          // ProseMirror (tiptap deps)
      '**/chart-*.js',               // Chart libraries
      '**/pdf-*.js',                 // PDF generation
      '**/jspdf*.js',                // jsPDF
      '**/html2canvas*.js',          // html2canvas
      '**/seedCourses*.js',          // Seed data
      '**/*.woff2',                  // Fonts — runtime-cache instead
    ],
  },
})
```

**Note**: The exact chunk name patterns (e.g., `react-vendor-*.js`) must be validated against the current build output in Task 1. Vite's chunk naming may differ from these patterns. Adjust patterns based on what `npm run build` produces.

### Route Runtime Caching (`src/sw.ts`)

Add after the existing 5 runtime caching rules and before the navigation fallback:

```ts
// f. Font files: CacheFirst, 50 entries, 30 days
// woff2 fonts are excluded from precache via globIgnores — they must be
// runtime-cached to load offline. Without this rule, fonts hit the
// setDefaultHandler(new NetworkOnly()) at the bottom of sw.ts and fail offline.
registerRoute(
  /\/assets\/.+\.woff2$/i,
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// g. Route chunks: StaleWhileRevalidate, 100 entries, 1 day
// Intentionally broad pattern — catches any JS chunk not in the precache
// manifest. Workbox serves precached assets first, so this is a safe fallback
// for dynamically-loaded route chunks. CacheableResponsePlugin prevents error
// responses (4xx/5xx) from being cached as valid JS content.
registerRoute(
  ({ url }) => /^\/assets\/.*\.js$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'route-chunks',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 1 day (content-hashed URLs make longer TTLs unnecessary)
      }),
    ],
  })
);
```

### Offline Route Fallback Component

```tsx
// src/app/components/OfflineRouteFallback.tsx
import { useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export function OfflineRouteFallback() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 rounded-2xl bg-card max-w-md">
        <WifiOff className="mx-auto size-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">
          This page isn't available offline
        </h2>
        <p className="text-muted-foreground mb-6">
          Visit it while connected to access it later.
        </p>
        <Button variant="brand" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    </div>
  );
}
```

### Error Boundary Integration

Modify the `SuspensePage` helper in `src/app/routes.tsx` (line ~200) to include `ChunkErrorBoundary` between `RouteErrorBoundary` and `Suspense`. This is the single wrapper used by all ~40+ lazy routes — one change covers every route:

```tsx
// src/app/routes.tsx — Updated SuspensePage helper
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';
import { OfflineRouteFallback } from './components/OfflineRouteFallback';

function SuspensePage({ children }: { children: React.ReactNode }) {
  return (
    <RouteErrorBoundary>
      <ChunkErrorBoundary fallback={<OfflineRouteFallback />}>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </ChunkErrorBoundary>
    </RouteErrorBoundary>
  )
}
```

**Why this order matters:** `ChunkErrorBoundary` must sit BETWEEN `RouteErrorBoundary` and `Suspense`:

- If it were OUTSIDE `RouteErrorBoundary`, chunk load errors would be caught but render errors from `RouteErrorFallback` would be lost
- If it were INSIDE `Suspense`, React throws dynamic import errors at the nearest error boundary ABOVE `Suspense`, so `ChunkErrorBoundary` would never fire

The `ChunkErrorBoundary` should:
1. Catch `TypeError` from failed `import()` (chunk load failure)
2. **Discriminate chunk errors from other runtime errors** by checking `error.message` for chunk-load-specific patterns: `"dynamically imported module"`, `"Loading chunk"`, `"Importing a module script failed"`, `"Failed to fetch dynamically imported module"`. Non-chunk errors must be re-thrown to the parent `RouteErrorBoundary` so they are reported via `reportError()` and surface the correct fallback UI (generic error with retry, not "not available offline"). See `RouteErrorBoundary.tsx` line 107 for the existing `reportError` pattern.
3. Check `navigator.onLine` — only show `OfflineRouteFallback` when offline AND the error is a chunk load failure
4. Show a generic error with retry button when online (network error, not missing chunk)
5. Reset error state when going back online (`window.addEventListener('online', ...)`)
6. **Never silently suppress errors** — if unsure whether an error is a chunk load failure, delegate to `RouteErrorBoundary`

### Key Constraints

- **Order matters**: The route-chunk `registerRoute` must come AFTER the specific runtime caching rules (images, Unsplash, HF, AI API, ABS proxy) and BEFORE the navigation fallback. More specific routes must be registered first.
- **Preserve all existing functionality**: PWAUpdatePrompt, PWAInstallBanner, offline app shell, image caching — no regressions.
- **Chunk name patterns are build-dependent**: The patterns in this spec are illustrative. Task 1 validates against actual build output and updates them.
- **Do not precache fonts**: `woff2` files are excluded via `globIgnores` and cached at runtime instead.

### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Precache size | ~17 MB (all assets) | <3 MB (app shell only) |
| SW install time | Slow (large download) | Fast (smaller download) |
| Route first visit | Network (not cached) | Network → runtime-cached |
| Route revisit offline | ❌ No (never cached) | ✅ Works (runtime cache) |
| Unvisited route offline | Blank page | "Not available offline" message |

### Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `vite.config.ts` | Modify | Update `injectManifest.globPatterns` and `globIgnores` |
| `src/sw.ts` | Modify | Add font runtime cache + route-chunk runtime cache `registerRoute` rules |
| `src/app/components/OfflineRouteFallback.tsx` | **Create** | Offline fallback UI |
| `src/app/components/ChunkErrorBoundary.tsx` | **Create** | Error boundary for chunk load failures |
| `src/app/routes.tsx` | Modify | Update `SuspensePage` to include `ChunkErrorBoundary` |
| `tests/support/helpers/sw-verification.ts` | **Create** | Build-time SW verification helper (precache size, exclusions, route order) |
| `tests/e2e/story-e64-s09.spec.ts` | **Create** | E2E tests for precache verification + offline behavior |
| `src/app/components/__tests__/OfflineRouteFallback.test.tsx` | **Create** | Unit tests for offline fallback component |
| `src/app/components/__tests__/ChunkErrorBoundary.test.tsx` | **Create** | Unit tests for chunk error boundary |

## Testing Notes

### Test Infrastructure

#### `tests/support/helpers/sw-verification.ts` (New)

Create a reusable build-time helper for SW verification. Functions:

- `verifyPrecacheContains(swContent: string, patterns: string[])` — assert precache manifest includes patterns
- `verifyPrecacheExcludes(swContent: string, patterns: string[])` — assert patterns are NOT in precache
- `verifyPrecacheUnderSize(swContent: string, maxBytes: number)` — parse manifest entries, sum file sizes from `dist/`, assert total < maxBytes
- `verifyRuntimeCacheRule(swContent: string, cacheName: string)` — assert `registerRoute` exists for `cacheName`
- `verifyRouteOrder(swContent: string, expectedOrder: string[])` — assert `registerRoute` calls appear in order: `local-images`, `unsplash-images`, `hf-models`, `ai-api`, `abs-proxy`, `fonts`, `route-chunks`, `navigation-fallback`

#### E2E Tests: `tests/e2e/story-e64-s09.spec.ts` (New)

Two test groups:

1. **Build-time tests** (any environment — reads `dist/sw.js`):
   - AC 1: Precache manifest contains critical app shell assets
   - AC 1: Total precache size under 3 MB
   - AC 2: Route-specific chunks excluded from precache
   - AC 5: All 7 runtime cache rules present in correct order

2. **SW-enabled tests** (preview server only, port 4173):
   - AC 3: Route chunk runtime-cached after first visit, loads offline
   - AC 4: App shell renders offline with navigation, unvisited routes show fallback
   - AC 4: OfflineRouteFallback renders when navigating offline to unvisited route

Run SW-enabled tests via:

```bash
npm run build && npx vite preview --port 4173 &
BASE_URL=http://localhost:4173 npx playwright test --grep "E64-S09.*preview"
```

#### Unit Tests: New Components

- `src/app/components/__tests__/OfflineRouteFallback.test.tsx` — renders heading, "Go Home" button, navigates to `/`, uses design tokens
- `src/app/components/__tests__/ChunkErrorBoundary.test.tsx` — catches chunk load TypeError, shows online generic error, shows offline fallback, re-throws non-chunk errors, resets on `online` event. Follow pattern in `src/app/components/__tests__/ErrorBoundary.test.tsx`.

### Manual Verification

- `npm run build` → inspect `dist/sw.js` for precache manifest size and all runtime rules
- Manual offline testing: `npm run preview`, DevTools > Network > Offline, navigate
- Regression check: `npm run ci` must pass
- Existing image caching must still work — verify Unsplash images load from cache when offline
- Fonts must load offline — verify no FOUT when going offline on any page
