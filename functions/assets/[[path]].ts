interface PagesFunctionContext {
  next: () => Promise<Response>
}

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

/**
 * Keep missing fingerprinted assets out of the SPA fallback.
 *
 * Cloudflare Pages does not support 404 rewrites in `_redirects`. Without this
 * Function, a missing chunk is rewritten to index.html and can be cached under
 * the JavaScript URL for a year. Requests served by a Pages Function also skip
 * `_headers`, so successful asset caching and nosniff are set here explicitly.
 */
export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  const response = await context.next()
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')

  const contentType = headers.get('Content-Type') ?? ''
  if (!response.ok || contentType.includes('text/html')) {
    headers.set('Content-Type', 'text/plain; charset=utf-8')
    headers.set('Cache-Control', 'no-store')
    headers.delete('Content-Length')
    return new Response('Asset not found', { status: 404, headers })
  }

  headers.set('Cache-Control', IMMUTABLE_CACHE)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
