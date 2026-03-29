# Story 64.9: Service Worker precache optimization

Status: ready-for-dev

## Story

As a Knowlune user on a slow or metered connection,
I want the service worker to only predownload essential files,
so that my initial app install is fast and doesn't consume excessive bandwidth.

## Acceptance Criteria

1. **Given** the Workbox configuration in `vite.config.ts` is updated
   **When** a production build generates the service worker
   **Then** the precache manifest contains only critical app shell assets (index.html, entry JS, React vendor, router, Radix UI, Dexie, CSS, icons)
   **And** the total precache size is under 3 MB (down from 17 MB)

2. **Given** route-specific chunks (tiptap, chart, pdf, AI SDKs, etc.) are excluded from precache
   **When** the user navigates to a route for the first time (e.g., `/reports`)
   **Then** the route chunk is downloaded via network and cached via `StaleWhileRevalidate` runtime strategy

3. **Given** the user has visited `/reports` previously (route chunk is runtime-cached)
   **When** the user goes offline and navigates to `/reports`
   **Then** the route loads from the runtime cache and displays correctly

4. **Given** the app shell is precached
   **When** the user opens Knowlune offline (never having visited specific routes)
   **Then** the app shell renders with navigation
   **And** routes that haven't been visited show a meaningful offline message (not a blank page)

## Tasks / Subtasks

- [ ] Task 1: Update Workbox `globPatterns` to precache only app shell (AC: 1)
  - [ ] 1.1 Locate VitePWA config in `vite.config.ts`
  - [ ] 1.2 Replace current `globPatterns` with critical-only patterns: `index.html`, entry JS, React vendor, router, Radix UI, Dexie, style-utils, CSS, SVG icons, PNG favicons
  - [ ] 1.3 Add `globIgnores` for large optional chunks: `mockServiceWorker.js`, `webllm*.js`, `ai-*.js`, `tiptap*.js`, `prosemirror*.js`, `chart-*.js`, `pdf-*.js`, `jspdf*.js`, `html2canvas*.js`, `seedCourses*.js`
- [ ] Task 2: Add runtime caching for route chunks (AC: 2, 3)
  - [ ] 2.1 Add `StaleWhileRevalidate` runtime caching rule for JS assets (`/assets/.*\.js$`)
  - [ ] 2.2 Configure `cacheName: 'route-chunks'` with `maxEntries: 100` and `maxAgeSeconds: 7 days`
  - [ ] 2.3 Preserve existing image runtime caching rules
- [ ] Task 3: Add offline fallback for unvisited routes (AC: 4)
  - [ ] 3.1 Ensure the SPA navigation fallback (`navigateFallback: '/index.html'`) is configured
  - [ ] 3.2 Add graceful UI handling: when a route chunk fails to load offline, show "This page isn't available offline yet" message instead of blank page
  - [ ] 3.3 Use React error boundary around lazy-loaded routes to catch chunk load failures
- [ ] Task 4: Verify precache size and build (AC: 1)
  - [ ] 4.1 Run `npm run build` and inspect SW precache manifest
  - [ ] 4.2 Calculate total precache size — must be under 3 MB
  - [ ] 4.3 Verify all critical app shell assets are in precache
  - [ ] 4.4 Verify excluded chunks are NOT in precache
- [ ] Task 5: Test offline behavior (AC: 2, 3, 4)
  - [ ] 5.1 Install PWA, visit `/reports` to cache route chunk
  - [ ] 5.2 Go offline, verify `/reports` loads from cache
  - [ ] 5.3 Go offline, navigate to unvisited route, verify meaningful offline message
  - [ ] 5.4 Run existing E2E tests to confirm no regressions

## Dev Notes

### Architecture Decision: AD-8

Split precache into critical app shell (precached on install) and route chunks (runtime-cached on first visit). [Source: architecture-performance-optimization.md#AD-8]

### Workbox Configuration Pattern

```typescript
// vite.config.ts — VitePWA config
VitePWA({
  workbox: {
    globPatterns: ['index.html', 'assets/index-*.js', 'assets/react-vendor-*.js',
                   'assets/react-router-*.js', 'assets/radix-ui-*.js',
                   'assets/style-utils-*.js', 'assets/dexie-*.js',
                   'assets/index-*.css', '*.svg', '*.png'],
    globIgnores: ['**/mockServiceWorker.js', '**/webllm*.js',
                  '**/ai-*.js', '**/tiptap*.js', '**/prosemirror*.js',
                  '**/chart-*.js', '**/pdf-*.js', '**/jspdf*.js',
                  '**/html2canvas*.js', '**/seedCourses*.js'],
    runtimeCaching: [
      {
        urlPattern: /^\/assets\/.*\.js$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'route-chunks',
          expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      // ... preserve existing runtime caching rules (images, etc.)
    ],
  },
})
```

### Key Constraints

- **This story should be done LAST** — all other stories may change chunk names/sizes, so SW config should reflect final state
- **Preserve existing PWA functionality**: service worker update prompt flow, existing image caching, navigation fallback
- Current VitePWA config in `vite.config.ts` likely has `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` — this is what causes the 17 MB precache
- The `runtimeCaching` `urlPattern` must match Vite's chunk output path format
- **Offline fallback**: The SPA already uses `navigateFallback` but needs error boundaries for lazy-loaded route chunks that fail to download
- Do not precache fonts if they are large — let them runtime-cache instead

### Project Structure Notes

- **Modified file**: `vite.config.ts` (VitePWA config section)
- **Possibly modified**: Route-level error boundary component for offline chunk failures
- PWA config is within the `plugins` array in vite.config.ts, in the `VitePWA({...})` call

### Expected Impact

- Precache: 17 MB down to ~2-3 MB (only critical app shell)
- First install: much faster SW activation
- Previously visited routes still work offline via runtime cache
- Unvisited routes show helpful message instead of blank page

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-8]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-10]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.9]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
