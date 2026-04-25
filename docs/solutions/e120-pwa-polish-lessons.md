---
module: pwa
tags: [pwa, mediasession, service-worker, ios, offline, manifest]
problem_type: implementation-lessons
---

# E120 PWA Polish — Implementation Lessons

## MediaSession per-action try/catch pattern

`setActionHandler` throws `NotSupportedError` for actions the browser doesn't support (e.g., `seekto` on older Chrome). Wrapping the whole block in a single try/catch causes all subsequent actions to be skipped if one fails. Always use a per-action helper:

```typescript
const trySet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
  try { navigator.mediaSession!.setActionHandler(action, handler) } catch { /* not supported — ok */ }
}
```

The comment `/* not supported — ok */` suppresses the `error-handling/no-silent-catch` ESLint rule.

## pdfjs-dist / react-pdf type mismatch

`react-pdf` bundles its own `pdfjs-dist` which adds extra properties (`pagesMapper`, `extractPages`, `getRawData`) missing from the top-level package. Importing `PDFDocumentProxy` from either package causes a type incompatibility. Solution: extract the type from react-pdf's own API surface:

```typescript
import type { DocumentProps } from 'react-pdf'
type PDFDocumentProxy = Parameters<NonNullable<DocumentProps['onLoadSuccess']>>[0]
```

## NetworkOnly + cacheName is a no-op

`NetworkOnly` never writes to cache, so providing `options: { cacheName: 'foo' }` is misleading dead code. Remove it. Only `CacheFirst`, `StaleWhileRevalidate`, and `NetworkFirst` strategies write to cache.

## iPadOS 13+ reports as Macintosh UA

iPadOS 13+ spoofs a desktop Safari UA (`Macintosh`). To detect iOS devices reliably:

```typescript
const isIosDevice =
  /iPhone|iPad|iPod/.test(ua) ||
  (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
```

## setInterval stacking on SW re-registration

`onRegisteredSW` can fire more than once (e.g., update check triggers re-registration). Guard the interval:

```typescript
if (intervalRef.current !== null) clearInterval(intervalRef.current)
intervalRef.current = setInterval(() => registration.update(), 60 * 60 * 1000)
```

## MediaMetadata artwork CSP bypass

`MediaMetadata.artwork` triggers an OS-level fetch that bypasses the browser's CSP `img-src` policy. Validate the URL before setting it:

```typescript
artwork: /^https?:\/\//i.test(track.coverUrl)
  ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/png' }]
  : [],
```

## Safe DOM construction in inline scripts (offline.html)

`innerHTML` is unsafe in Service Worker / Cache Storage readers because cache keys could theoretically contain XSS payloads. Always use `createElement` + `textContent` + `.href`:

```javascript
const a = document.createElement('a')
a.href = path        // browser normalizes, won't execute
a.textContent = label
```
