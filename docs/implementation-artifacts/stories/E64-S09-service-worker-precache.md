---
story_id: E64-S09
story_name: "Service Worker Precache Optimization"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
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
**Then** the route loads from the runtime cache and displays correctly

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

- [ ] Task 4: Add route-chunk runtime caching in `src/sw.ts` (AC: 2, 3)
  - [ ] 4.1 Add `registerRoute()` with `StaleWhileRevalidate` strategy for `/assets/.*\.js$/`
  - [ ] 4.2 Configure `cacheName: 'route-chunks'` with `ExpirationPlugin`: `maxEntries: 100`, `maxAgeSeconds: 7 * 24 * 60 * 60` (7 days)
  - [ ] 4.3 Place this rule **after** existing runtime caching rules (images, Unsplash, HF, AI API, ABS proxy) and **before** the navigation fallback
  - [ ] 4.4 Verify existing 5 runtime caching rules are preserved

- [ ] Task 5: Add offline fallback for unvisited routes (AC: 4)
  - [ ] 5.1 Create `src/app/components/OfflineRouteFallback.tsx` — displays "This page isn't available offline yet" with a "Go Home" button
  - [ ] 5.2 Style using design tokens: `bg-card`, `text-muted-foreground`, `text-brand` for the button
  - [ ] 5.3 Wrap lazy-loaded routes in an error boundary that catches chunk load failures (TypeError from failed dynamic import)
  - [ ] 5.4 The error boundary should distinguish online/offline — only show the custom fallback when `!navigator.onLine`
  - [ ] 5.5 Apply the boundary in `routes.tsx` or `App.tsx` around `<Suspense>` wrappers for lazy routes

- [ ] Task 6: Verify precache size and build (AC: 1, 5)
  - [ ] 6.1 Run `npm run build` and inspect `dist/sw.js` precache manifest
  - [ ] 6.2 Calculate total precache asset sizes — must be under 3 MB
  - [ ] 6.3 Verify all critical app shell assets are in precache
  - [ ] 6.4 Verify excluded chunks (tiptap, chart, pdf, AI, etc.) are NOT in precache
  - [ ] 6.5 Verify route-chunk runtime caching rule is present in compiled SW

- [ ] Task 7: Test offline behavior (AC: 2, 3, 4)
  - [ ] 7.1 `npm run preview`, open app, visit `/reports` (caches route chunk)
  - [ ] 7.2 Go offline (DevTools > Network > Offline), verify `/reports` loads from cache
  - [ ] 7.3 Go offline, navigate to unvisited route — verify custom fallback message
  - [ ] 7.4 Go online, verify route loads normally (not stuck on fallback)
  - [ ] 7.5 Run `npm run ci` — all existing tests pass, no regressions

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
  registerType: 'prompt',
  // ... manifest unchanged from E61-S01 ...
  injectManifest: {
    swSrc: 'src/sw.ts',
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
      '*.svg',                       // SVG icons
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

### Route-Chunk Runtime Caching (`src/sw.ts`)

Add after the existing 5 runtime caching rules and before the navigation fallback:

```ts
// src/sw.ts — Route chunk caching (StaleWhileRevalidate)
// Any JS chunk not in the precache manifest (route-specific chunks)
registerRoute(
  ({ url }) => /^\/assets\/.*\.js$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'route-chunks',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
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
        <WifiOff className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
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

Wrap lazy routes in `routes.tsx`:

```tsx
// Pattern: error boundary around lazy-loaded routes
import { OfflineRouteFallback } from '@/app/components/OfflineRouteFallback';

// In the route config:
{
  element: (
    <ChunkErrorBoundary fallback={<OfflineRouteFallback />}>
      <Suspense fallback={<PageLoadingSkeleton />}>
        <LazyRouteComponent />
      </Suspense>
    </ChunkErrorBoundary>
  ),
}
```

The `ChunkErrorBoundary` should:
1. Catch `TypeError` from failed `import()` (chunk load failure)
2. Check `navigator.onLine` — only show `OfflineRouteFallback` when offline
3. Show a generic error with retry button when online (network error, not missing chunk)
4. Reset error state when going back online (`window.addEventListener('online', ...)`)

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
| `src/sw.ts` | Modify | Add route-chunk `registerRoute` |
| `src/app/components/OfflineRouteFallback.tsx` | **Create** | Offline fallback UI |
| `src/app/components/ChunkErrorBoundary.tsx` | **Create** | Error boundary for chunk load failures |
| `src/app/routes.tsx` or `App.tsx` | Modify | Wrap lazy routes with error boundary |

## Testing Notes

- `npm run build` → inspect `dist/sw.js` for precache manifest size and route-chunk rule
- Manual offline testing: `npm run preview`, DevTools > Network > Offline, navigate
- E2E tests for offline behavior can be added in a follow-up story (requires Playwright `context.setOffline(true)`)
- Regression check: `npm run ci` must pass
- Existing image caching must still work — verify Unsplash images load from cache when offline

## Implementation Plan

See [plan](plans/plan-e64-s09-service-worker-precache-optimization.md) for implementation approach.
