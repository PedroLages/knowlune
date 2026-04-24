// Origin check and CORS helpers for Supabase Edge Functions (Deno).
//
// Ported from server/middleware/origin-check.ts. Validates incoming request
// Origin headers against an allow-list. Requests without an Origin header
// (server-to-server, curl, cron) are permitted.

const ALLOWED_METHODS = 'GET, POST, OPTIONS'
const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'
const MAX_AGE = '86400'

function normalize(origin: string): string {
  return origin.toLowerCase().replace(/\/+$/, '')
}

function normalizeList(origins: string[]): Set<string> {
  return new Set(origins.map(normalize))
}

export function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function checkOrigin(req: Request, allowedOrigins: string[]): Response | null {
  const origin = req.headers.get('origin')
  if (!origin) return null

  const allowed = normalizeList(allowedOrigins)
  if (allowed.has(normalize(origin))) return null

  return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function corsHeaders(
  req: Request,
  allowedOrigins?: string[]
): Record<string, string> {
  const origin = req.headers.get('origin')
  const list = allowedOrigins ?? getAllowedOrigins()
  const allowed = normalizeList(list)

  let allowOrigin = '*'
  if (origin) {
    allowOrigin = allowed.has(normalize(origin)) ? origin : ''
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': MAX_AGE,
  }
  if (origin) headers['Vary'] = 'Origin'
  return headers
}

export function handlePreflight(
  req: Request,
  allowedOrigins: string[]
): Response | null {
  if (req.method !== 'OPTIONS') return null

  const denied = checkOrigin(req, allowedOrigins)
  if (denied) return denied

  return new Response(null, { status: 204, headers: corsHeaders(req, allowedOrigins) })
}
