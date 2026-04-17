/**
 * Cover Proxy Route — server-side image proxy to bypass CORS restrictions.
 *
 * GET /api/cover-proxy?url=<encoded-image-url>
 *
 * Fetches images server-to-server (no CORS constraint) and streams them back
 * to the browser as same-origin responses. Required for Google Books covers
 * which intentionally omit Access-Control-Allow-Origin headers.
 *
 * Security controls (layered SSRF protection):
 *   1. Protocol check: only https: URLs accepted
 *   2. Domain allowlist: only known image CDN domains forwarded
 *   3. Redirect policy: redirect:'error' — upstream 3xx returns 502, never followed
 *   4. Content-Type validation: only image/* (excluding SVG) forwarded
 *   5. Per-IP rate limiting: 60 req/min (applied in server/index.ts)
 */

import { Router } from 'express'

const router = Router()

/** Approved image CDN domains. Update if new providers are added. */
const ALLOWED_DOMAINS = new Set([
  'books.google.com',
  'covers.openlibrary.org',
])

/** Wildcard suffix domains (e.g. *.mzstatic.com) */
const ALLOWED_DOMAIN_SUFFIXES = ['.mzstatic.com']

/** Image content types that are safe to forward. SVG excluded (allows inline script). */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

/**
 * Validates that a URL is safe to proxy:
 * - Must use https: protocol
 * - Hostname must be in the approved CDN allowlist
 *
 * Returns an error string if invalid, or null if valid.
 */
export function validateCoverProxyUrl(urlString: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    return 'Invalid URL format'
  }

  if (parsed.protocol !== 'https:') {
    return 'Only https: URLs are allowed'
  }

  const hostname = parsed.hostname.toLowerCase()
  const isAllowed =
    ALLOWED_DOMAINS.has(hostname) ||
    ALLOWED_DOMAIN_SUFFIXES.some(suffix => hostname.endsWith(suffix))

  if (!isAllowed) {
    return 'Domain not in allowlist'
  }

  return null
}

/**
 * Returns true if the given Content-Type is safe to forward.
 * SVG is rejected because it can contain inline <script> elements.
 */
export function isAllowedImageContentType(contentType: string): boolean {
  const baseType = contentType.split(';')[0].trim().toLowerCase()
  return ALLOWED_CONTENT_TYPES.has(baseType)
}

router.get('/', async (req, res) => {
  const rawUrl = req.query.url

  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400).json({ error: 'url query parameter is required' })
    return
  }

  const validationError = validateCoverProxyUrl(rawUrl)
  if (validationError) {
    res.status(400).json({ error: validationError })
    return
  }

  try {
    const upstream = await fetch(rawUrl, {
      redirect: 'error', // Never follow redirects — upstream 3xx returns 502
      signal: AbortSignal.timeout(10_000),
    })

    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream returned ${upstream.status}` })
      return
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!isAllowedImageContentType(contentType)) {
      res.status(502).json({ error: `Upstream returned disallowed content type: ${contentType.split(';')[0].trim()}` })
      return
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    const buffer = await upstream.arrayBuffer()
    res.status(200).send(Buffer.from(buffer))
  } catch (error) {
    // silent-catch-ok — returns structured error to client
    const err = error as Error
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      res.status(502).json({ error: 'Upstream image server timed out' })
      return
    }
    // TypeError thrown by redirect:'error' when upstream sends a redirect
    if (err.name === 'TypeError' && err.message.includes('redirect')) {
      res.status(502).json({ error: 'Upstream redirected — not allowed' })
      return
    }
    console.error('[/api/cover-proxy]', err.message)
    res.status(502).json({ error: 'Failed to fetch cover image' })
  }
})

export default router
