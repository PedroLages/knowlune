---
title: "Service Worker + Cloudflare Pages MIME type crash on dynamic imports after deployment"
date: 2026-07-11
category: runtime-errors
module: pwa_deployment
problem_type: runtime_error
component: development_workflow
severity: critical
symptoms:
  - "All pages show 'Something went wrong in this section' after deployment"
  - "Browser console: Failed to fetch dynamically imported module for every lazy-loaded route chunk"
  - "MIME type mismatch — server returns text/html for JavaScript module requests instead of application/javascript"
  - "Service worker activates with stale precache manifest, referencing non-existent chunk filenames from the previous build"
  - "Error surface is global — affects every page that uses lazy-loaded routes, not a single route"
root_cause: config_error
resolution_type: code_fix
tags:
  - pwa
  - service-worker
  - cloudflare-pages
  - stale-chunk
  - workbox
  - vite
  - cache-control
  - deployment
related_components:
  - tooling
---

# Service Worker + Cloudflare Pages MIME Type Crash on Dynamic Imports

## Problem

After deployments to Cloudflare Pages, all pages broke with "Something went wrong in this section." The app fully failed to load lazy routes because JavaScript chunks were served as `text/html` — three interacting config errors made every deployment a production outage.

## Symptoms

- Full app crash after deployment — all routes show the error boundary
- Browser console: `Failed to fetch dynamically imported module: https://knowlune.pedrolages.net/assets/Courses-BxZv4g5Z.js`
- Followed by: `Expected a JavaScript module but the server responded with a MIME type of "text/html"`
- Inconsistent across users depending on service worker activation timing and which Cloudflare edge node they hit

## What Didn't Work

- **Using `_redirects` with `404` status codes** — Cloudflare Pages silently ignores 404 as an invalid redirect status. Only `200`, `301`, `302`, `303`, `307`, `308` are valid. Rules like `/assets/*.js /404.html 404` were silently dropped, and requests fell through to the SPA catch-all `/* /index.html 200`.
- **`registerType: 'autoUpdate'` + `skipWaiting` + `clients.claim()`** — this combination allowed a new service worker to take control of tabs that were running old application bundles. Those tabs' dynamic imports referenced chunk filenames the new precache manifest no longer contained.
- **`Cache-Control: no-cache` only on `/index.html`** — SPA fallback routes (`/courses`, `/settings`, etc.) inherited the `/*` catch-all headers which had no cache control, allowing browsers to cache stale HTML indefinitely.

## Solution

Eight changes across 11 files (PR [#637](https://github.com/PedroLages/knowlune/pull/637)). The key changes:

### 1. Cloudflare Pages Function for Asset 404s

Created `functions/assets/[[path]].ts`. Cloudflare Pages Functions intercept requests before the SPA fallback. Using `env.ASSETS.fetch()` to check whether the asset genuinely exists in the deployment manifest — if not, return a proper 404 with `text/plain`, never the SPA `index.html`:

```typescript
const ASSET_EXTENSIONS = /\.(js|css|woff2?|wasm|worker\.js)$/i

function isAssetRequest(pathname: string): boolean {
  return ASSET_EXTENSIONS.test(pathname)
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  if (!isAssetRequest(url.pathname)) return context.next()

  const assetResponse = await context.env.ASSETS.fetch(context.request.url)
  if (assetResponse.status === 404 || assetResponse.status === 500) {
    return new Response('404 Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  return assetResponse
}
```

### 2. Service Worker Lifecycle — Prompt Mode, No `clients.claim()`

**`vite.config.ts`** — changed from auto-activation to user-prompted:

```typescript
// Before (broken)
registerType: 'autoUpdate',

// After (fixed)
registerType: 'prompt',
```

**`src/sw.ts`** — removed `clients.claim()` from the activate event. The new SW no longer takes control of tabs that are running an old application bundle. Added diagnostics:

```typescript
// Before (broken)
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

// After (fixed)
// We intentionally omit clients.claim() — it would make the new SW
// take control of tabs running an OLD bundle with stale chunk references.
self.addEventListener('install', () => {
  console.log(`[SW] Install — build ${BUILD_VERSION}`)
})
self.addEventListener('activate', event => {
  console.log(`[SW] Activate — build ${BUILD_VERSION}`)
  // Workbox auto-cleans outdated precache entries during activate.
})
```

### 3. Runtime Caching for Route Chunks

Added a `CacheFirst` strategy for hashed JS/CSS/WOFF2 assets in a dedicated `knowlune-route-chunks` cache. Acts as transitional protection — tabs running an older build can still fetch their chunks from this cache even if those chunks are no longer in the precache manifest:

```typescript
// src/sw.ts — after the ABS proxy rule, before the navigation fallback
registerRoute(
  /^\/assets\/.+\.(?:js|css|woff2?)$/i,
  new CacheFirst({
    cacheName: 'knowlune-route-chunks',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  })
)

// Workers (also content-hashed)
registerRoute(
  /\.worker\.js$/i,
  new CacheFirst({
    cacheName: 'knowlune-route-chunks',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  })
)
```

### 4. Vite Preload Error Recovery

Added a `vite:preloadError` listener in `src/main.tsx` **before React renders**. When Vite detects a failed dynamic `import()`, it dispatches this event. The listener reloads the page exactly once (guarded by `sessionStorage`), fetching fresh HTML with current chunk references:

```typescript
const CHUNK_RECOVERY_KEY = 'knowlune-chunk-recovery'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  if (sessionStorage.getItem(CHUNK_RECOVERY_KEY)) {
    console.error('[ChunkRecovery] Reload already attempted — chunk still missing:', event)
    return
  }

  sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
  console.warn('[ChunkRecovery] Stale chunk detected, reloading to fetch fresh assets...')

  const url = new URL(window.location.href)
  url.searchParams.set('__reload', Date.now().toString())
  window.location.replace(url.toString())
})

// Clear the marker after successful load
window.addEventListener('load', () => {
  sessionStorage.removeItem(CHUNK_RECOVERY_KEY)
})
```

### 5. HTML Caching Headers

**`public/_headers`** — moved `Cache-Control` from `/index.html` only to the `/*` catch-all, so ALL SPA fallback routes inherit `no-cache, no-store, must-revalidate`. Hashed assets override with immutable via more-specific rules:

```
/*
  Cache-Control: no-cache, no-store, must-revalidate
  X-Content-Type-Options: nosniff
  ...

/assets/*.js
  Cache-Control: public, max-age=31536000, immutable

/assets/*.css
  Cache-Control: public, max-age=31536000, immutable
```

### 6. Post-Build Asset Integrity Verification

Created `scripts/verify-dist.cjs` — parses `dist/index.html` and entry JS chunks, confirms every referenced asset exists in the build output. Integrated into CI via `npm run verify:dist`. Catches missing chunk references before deployment.

## Why This Works

Three interacting root causes were each addressed:

1. **Cloudflare Pages `_redirects` 404 status trap** — `_redirects` only supports redirect status codes (200/301/302/303/307/308). Any other status is silently ignored and the rule is skipped. The Pages Function intercepts asset requests BEFORE the `_redirects` rules are evaluated, using `env.ASSETS.fetch()` (which doesn't apply SPA fallback) to distinguish existing from missing assets.

2. **Service worker lifecycle race** — `registerType: 'autoUpdate'` combined with `skipWaiting` + `clients.claim()` let a new SW take control mid-session. The old page referenced chunk filenames from the old build; the new SW's precache manifest (built with the new build) didn't contain them. Switching to `registerType: 'prompt'` and removing `clients.claim()` prevents premature activation. The runtime `CacheFirst` cache provides a fallback for any chunks not in the current precache.

3. **Missing cache headers on SPA fallback routes** — `Cache-Control` on `/index.html` only applies when the request path IS `/index.html`. When Cloudflare Pages serves `index.html` for `/courses` via the SPA fallback, the path is `/courses`, so the `/*` catch-all headers apply. Adding `no-cache, no-store, must-revalidate` to `/*` ensures every SPA route revalidates HTML on every navigation.

## Prevention

- **Add `verify:dist` to CI** — runs after build, catches missing chunk references before deployment (`npm run ci` includes this)
- **Always verify Cloudflare Pages `_redirects` status codes** are in the supported set (`200`, `301`, `302`, `303`, `307`, `308`). Any other status (including `404`) is silently ignored
- **Use `registerType: 'prompt'` for PWAs** unless you have a specific reason for auto-update AND you've tested the mid-session takeover scenario
- **Never call `clients.claim()` in a PWA with content-hashed assets** — the old page will always have stale chunk references
- **Add `Cache-Control` to catch-all headers, not just the document URL** — the SPA fallback serves `index.html` under different request paths
- **Add a `vite:preloadError` listener** early in the entry point — it's the last line of defense for stale chunks
- **Add `CacheFirst` runtime caching for hashed assets** — provides transitional coverage when precache manifests differ between SW versions

## Related

- PR [#637](https://github.com/PedroLages/knowlune/pull/637) — all fixes
- [Cloudflare Pages redirects docs](https://developers.cloudflare.com/pages/configuration/redirects/) — supported status codes
- [Workbox precaching](https://developer.chrome.com/docs/workbox/precaching-with-workbox) — precache lifecycle
- [Vite PWA plugin](https://vite-pwa-org.netlify.app/) — `registerType` options
