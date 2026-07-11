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
  const assetResponse = await env.ASSETS.fetch(request.url)

  if (assetResponse.status === 404 || assetResponse.status === 500) {
    // Asset genuinely does not exist — return a proper 404.
    // text/plain ensures the browser won't try to parse this as JS/CSS
    // and won't trigger MIME type errors.
    return new Response('404 Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  // Asset exists — return it directly. The immutable cache headers from
  // public/_headers are applied automatically by Cloudflare Pages for
  // existing static files.
  return assetResponse
}
