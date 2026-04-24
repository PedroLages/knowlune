// Cover proxy — server-side image proxy to bypass CORS restrictions.
//
// GET /cover-proxy?url=<encoded-image-url> → fetches the remote image and
// returns the bytes with permissive CORS headers so the browser can canvasify
// covers from providers that omit Access-Control-Allow-Origin (Google Books,
// Open Library, Apple mzstatic).
//
// Ported from server/routes/cover-proxy.ts. Layered defenses:
//   1. Origin gate (SPA-only).
//   2. https: protocol only.
//   3. Domain allowlist (exact + suffix).
//   4. SSRF guard — reject loopback, link-local, private ranges, *.supabase.*.
//   5. redirect:'error' — 3xx never followed.
//   6. Content-Type must be image/* excluding SVG.
//   7. Response capped at 5 MiB.

import {
  checkOrigin,
  corsHeaders,
  getAllowedOrigins,
  handlePreflight,
} from '../_shared/origin-check.ts'

const ALLOWED_DOMAINS = new Set<string>([
  'books.google.com',
  'covers.openlibrary.org',
  'archive.org',
])

const ALLOWED_DOMAIN_SUFFIXES = ['.mzstatic.com', '.archive.org']

const ALLOWED_CONTENT_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000

function jsonError(
  req: Request,
  allowedOrigins: string[],
  status: number,
  error: string
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(req, allowedOrigins),
    },
  })
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()

  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]'
  ) {
    return true
  }

  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.in')) {
    return true
  }

  // IPv4 literal checks.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 127) return true // loopback
    if (a === 10) return true // private
    if (a === 169 && b === 254) return true // link-local / metadata
    if (a === 192 && b === 168) return true // private
    if (a === 172 && b >= 16 && b <= 31) return true // private
    if (a === 0) return true
  }

  return false
}

function validateUrl(urlString: string): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    return { ok: false, error: 'Invalid URL format' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only https: URLs are allowed' }
  }

  const hostname = parsed.hostname.toLowerCase()

  if (isBlockedHost(hostname)) {
    return { ok: false, error: 'URL not allowed' }
  }

  const inAllowlist =
    ALLOWED_DOMAINS.has(hostname) ||
    ALLOWED_DOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix))

  if (!inAllowlist) {
    return { ok: false, error: 'Domain not in allowlist' }
  }

  return { ok: true, url: parsed }
}

function isAllowedContentType(contentType: string): boolean {
  const baseType = contentType.split(';')[0].trim().toLowerCase()
  return ALLOWED_CONTENT_TYPES.has(baseType)
}

async function readCapped(body: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > limit) {
        try {
          await reader.cancel()
        } catch {
          // ignore
        }
        return null
      }
      chunks.push(value)
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

Deno.serve(async (req: Request) => {
  const allowedOrigins = getAllowedOrigins()

  const preflight = handlePreflight(req, allowedOrigins)
  if (preflight) return preflight

  const originDenied = checkOrigin(req, allowedOrigins)
  if (originDenied) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(req, allowedOrigins),
      },
    })
  }

  if (req.method !== 'GET') {
    return jsonError(req, allowedOrigins, 405, 'Method not allowed')
  }

  const url = new URL(req.url)
  const rawUrl = url.searchParams.get('url')
  if (!rawUrl) {
    return jsonError(req, allowedOrigins, 400, 'url query parameter is required')
  }

  const validation = validateUrl(rawUrl)
  if (!validation.ok) {
    return jsonError(req, allowedOrigins, 400, validation.error)
  }

  let upstream: Response
  try {
    let currentUrl = validation.url.toString()
    let hopCount = 0
    const MAX_REDIRECTS = 3
    while (true) {
      upstream = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (upstream.status < 300 || upstream.status >= 400) break
      const location = upstream.headers.get('location')
      if (!location) break
      if (++hopCount > MAX_REDIRECTS) {
        return jsonError(req, allowedOrigins, 502, 'Too many redirects')
      }
      const nextUrl = new URL(location, currentUrl).toString()
      const nextValidation = validateUrl(nextUrl)
      if (!nextValidation.ok) {
        return jsonError(req, allowedOrigins, 502, `Redirect target blocked: ${nextValidation.error}`)
      }
      currentUrl = nextValidation.url.toString()
    }
  } catch (err) {
    const e = err as Error
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      return jsonError(req, allowedOrigins, 502, 'Upstream image server timed out')
    }
    console.error('[cover-proxy] fetch failed:', e.message)
    return jsonError(req, allowedOrigins, 502, 'Failed to fetch cover image')
  }

  if (!upstream.ok) {
    return jsonError(req, allowedOrigins, 502, `Upstream returned ${upstream.status}`)
  }

  const contentType = upstream.headers.get('content-type') ?? ''
  if (!isAllowedContentType(contentType)) {
    const base = contentType.split(';')[0].trim() || 'unknown'
    return jsonError(
      req,
      allowedOrigins,
      502,
      `Upstream returned disallowed content type: ${base}`
    )
  }

  if (!upstream.body) {
    return jsonError(req, allowedOrigins, 502, 'Upstream returned empty body')
  }

  const bytes = await readCapped(upstream.body, MAX_BYTES)
  if (!bytes) {
    return jsonError(req, allowedOrigins, 502, 'Upstream image exceeded size limit')
  }

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Length': String(bytes.byteLength),
    'Cache-Control': 'public, max-age=86400, immutable',
    ...corsHeaders(req, allowedOrigins),
  }

  return new Response(new Blob([bytes.buffer as ArrayBuffer]), { status: 200, headers })
})
