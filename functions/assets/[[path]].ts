/**
 * Cloudflare Pages Function — Asset 404 Guard
 *
 * Intercepts all /assets/* requests and uses env.ASSETS.fetch() to determine
 * whether the file genuinely exists in the deployment. Existing assets are
 * returned as-is (with the immutable cache headers from _headers). Missing
 * assets receive a proper 404 with text/plain content type — never the SPA
 * index.html fallback.
 *
 * Without this function, missing hashed chunks return index.html (text/html),
 * which triggers the browser's strict MIME type check: "Expected a JavaScript
 * module but the server responded with a MIME type of text/html."
 *
 * The function also covers root-level asset patterns (*.js, *.css, *.woff2)
 * that are not under /assets/ — e.g. /sw.js, /workbox-*.js, /reduce-motion-init.js.
 *
 * @see public/_redirects — SPA fallback
 * @see public/_headers — caching rules
 */

interface PagesFunctionContext {
  request: Request
  env: {
    ASSETS: {
      fetch: (url: string | Request) => Promise<Response>
    }
  }
  next: () => Promise<Response>
}

// Asset file extensions that must never resolve to the SPA fallback
const ASSET_EXTENSIONS = /\.(js|css|woff2?|wasm|worker\.js)$/i

// Root-level asset paths that must never resolve to the SPA fallback
const ROOT_ASSET_PATTERNS = /^\/(sw\.js|workbox-.*\.js|reduce-motion-init\.js|404\.html|offline\.html)$/i

function isAssetRequest(pathname: string): boolean {
  return ASSET_EXTENSIONS.test(pathname) || ROOT_ASSET_PATTERNS.test(pathname)
}

export const onRequest: PagesFunction = async (context: PagesFunctionContext) => {
  const { request, env } = context
  const url = new URL(request.url)

  // Only handle asset-like requests — let navigation requests pass through
  // to the normal static file serving and SPA fallback
  if (!isAssetRequest(url.pathname)) {
    return context.next()
  }

  // Check if the asset exists in the deployment manifest.
  // env.ASSETS.fetch() returns the file from Cloudflare's asset manifest
  // without applying _redirects SPA fallback rules.
  let assetResponse: Response
  try {
    assetResponse = await env.ASSETS.fetch(request.url)
  } catch {
    // If env.ASSETS.fetch() itself throws (e.g., malformed request),
    // return a safe 404 instead of falling through to the SPA fallback
    return new Response('404 Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  // Guard 1: Asset genuinely does not exist (404 or server error)
  if (assetResponse.status === 404 || assetResponse.status >= 500) {
    return new Response('404 Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  // Guard 2: Defense-in-depth — even if env.ASSETS.fetch() returned 200,
  // verify the Content-Type matches the file extension. Some Cloudflare
  // Pages configurations may return the SPA fallback HTML for missing
  // assets despite using env.ASSETS.fetch().
  const contentType = assetResponse.headers.get('Content-Type') || ''
  const pathname = url.pathname.toLowerCase()

  // If the response is HTML but the URL is for a JS/CSS/asset file,
  // the SPA fallback was incorrectly applied — return 404 instead.
  if (/^text\/html/i.test(contentType)) {
    console.warn(
      `[asset-guard] SPA fallback detected for asset: ${pathname} (Content-Type: ${contentType})`
    )
    return new Response('404 Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  // Guard 3: Validate MIME type matches extension
  // .js / .mjs → javascript | ecmascript | wasm
  // .css → text/css
  // .woff2 → font-woff2 | octet-stream
  // .wasm → wasm
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs') || pathname.endsWith('.worker.js')) {
    if (!/javascript|ecmascript|wasm/i.test(contentType)) {
      console.warn(
        `[asset-guard] MIME mismatch for JS asset: ${pathname} (Content-Type: ${contentType})`
      )
      return new Response('404 Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
  }

  if (pathname.endsWith('.css')) {
    if (!/^text\/css/i.test(contentType)) {
      console.warn(
        `[asset-guard] MIME mismatch for CSS asset: ${pathname} (Content-Type: ${contentType})`
      )
      return new Response('404 Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
  }

  // Asset exists with correct MIME type — return it directly.
  // The immutable cache headers from public/_headers are applied
  // automatically by Cloudflare Pages for existing static files.
  return assetResponse
}
