// ai-ollama — BYOK-only proxy for user self-hosted Ollama servers.
// Consolidates Express routes /api/ai/ollama/health, /api/ai/ollama/tags,
// /api/ai/ollama/chat, /api/ai/ollama into a single Supabase Edge Function
// with path-based dispatch.
//
// - Origin allow-list + CORS preflight
// - JWT verification via Supabase auth
// - Always BYOK: rate-limited with the 'byok' tier (no entitlement check)
// - SSRF guard: blocks loopback / 0.0.0.0 / ::1 / 169.254/16, requires http(s)
// - Chat/root streams Ollama's NDJSON response through unchanged

import { createClient } from 'npm:@supabase/supabase-js@^2'
import {
  getAllowedOrigins,
  handlePreflight,
  checkOrigin,
  corsHeaders,
} from '../_shared/origin-check.ts'
import { checkRateLimit, rateLimitHeaders } from '../_shared/rate-limit.ts'

const HEALTH_TIMEOUT_MS = 5_000
const TAGS_TIMEOUT_MS = 10_000

function isAllowedOllamaUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname === '::1' ||
      hostname.startsWith('127.')
    ) {
      return false
    }
    if (hostname.startsWith('169.254.')) return false
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return true
  } catch {
    return false
  }
}

function json(
  body: unknown,
  status: number,
  req: Request,
  allowedOrigins: string[],
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(req, allowedOrigins),
      ...extraHeaders,
    },
  })
}

function classifyFetchError(err: unknown): { status: number; error: string; detail: string } {
  const e = err as Error
  const name = e?.name ?? ''
  const message = e?.message ?? String(err)
  if (name === 'AbortError' || name === 'TimeoutError') {
    return { status: 504, error: 'Ollama server timed out', detail: message }
  }
  return { status: 502, error: 'Ollama connection failed', detail: message }
}

async function handleHealth(
  req: Request,
  allowedOrigins: string[],
  rlHeaders: Record<string, string>,
  serverUrl: string,
): Promise<Response> {
  try {
    const normalizedUrl = serverUrl.replace(/\/+$/, '')
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      return json(
        { error: `Ollama returned ${response.status}: ${errorText}` },
        502,
        req,
        allowedOrigins,
        rlHeaders,
      )
    }

    // Ollama root returns plain text "Ollama is running"; optionally surface version
    // if a future release adds one to the response body.
    const body = await response.text()
    const versionMatch = body.match(/version[^\d]*([\d.]+)/i)
    return json(
      { ok: true, ...(versionMatch ? { version: versionMatch[1] } : {}) },
      200,
      req,
      allowedOrigins,
      rlHeaders,
    )
  } catch (err) {
    console.error('[ai-ollama/health] Error:', (err as Error).message)
    const { status, error, detail } = classifyFetchError(err)
    return json({ error, detail }, status, req, allowedOrigins, rlHeaders)
  }
}

async function handleTags(
  req: Request,
  allowedOrigins: string[],
  rlHeaders: Record<string, string>,
  serverUrl: string,
): Promise<Response> {
  try {
    const normalizedUrl = serverUrl.replace(/\/+$/, '')
    const response = await fetch(`${normalizedUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(TAGS_TIMEOUT_MS),
    })

    const text = await response.text()
    // Relay status and body verbatim — let the caller see Ollama's exact payload.
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      // non-JSON body — forward as-is in an error shape
      if (!response.ok) {
        return json(
          { error: `Ollama returned ${response.status}: ${text}` },
          response.status,
          req,
          allowedOrigins,
          rlHeaders,
        )
      }
    }

    return new Response(JSON.stringify(parsed), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(req, allowedOrigins),
        ...rlHeaders,
      },
    })
  } catch (err) {
    console.error('[ai-ollama/tags] Error:', (err as Error).message)
    const { status, error, detail } = classifyFetchError(err)
    return json({ error, detail }, status, req, allowedOrigins, rlHeaders)
  }
}

async function handleChat(
  req: Request,
  allowedOrigins: string[],
  rlHeaders: Record<string, string>,
  rawBody: Record<string, unknown>,
): Promise<Response> {
  const ollamaServerUrl = rawBody.ollamaServerUrl
  if (typeof ollamaServerUrl !== 'string' || !ollamaServerUrl) {
    return json(
      { error: 'ollamaServerUrl is required in request body' },
      400,
      req,
      allowedOrigins,
      rlHeaders,
    )
  }
  if (!isAllowedOllamaUrl(ollamaServerUrl)) {
    return json({ error: 'Invalid Ollama URL' }, 400, req, allowedOrigins, rlHeaders)
  }

  // Strip the server URL from the forwarded payload — everything else is Ollama-native.
  const { ollamaServerUrl: _omit, ...ollamaPayload } = rawBody
  const normalizedUrl = ollamaServerUrl.replace(/\/+$/, '')

  try {
    const upstream = await fetch(`${normalizedUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
    })

    if (!upstream.ok && !upstream.body) {
      const errorText = await upstream.text().catch(() => upstream.statusText)
      return json(
        { error: `Ollama returned ${upstream.status}: ${errorText}` },
        upstream.status,
        req,
        allowedOrigins,
        rlHeaders,
      )
    }

    // Pass body through as-is. Ollama emits newline-delimited JSON frames.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/x-ndjson',
        ...corsHeaders(req, allowedOrigins),
        ...rlHeaders,
      },
    })
  } catch (err) {
    console.error('[ai-ollama/chat] Error:', (err as Error).message)
    const { status, error, detail } = classifyFetchError(err)
    return json({ error, detail }, status, req, allowedOrigins, rlHeaders)
  }
}

Deno.serve(async (req) => {
  const allowedOrigins = getAllowedOrigins()

  const preflight = handlePreflight(req, allowedOrigins)
  if (preflight) return preflight

  const originDenied = checkOrigin(req, allowedOrigins)
  if (originDenied) return originDenied

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[ai-ollama] Missing SUPABASE_* environment variables')
    return json({ error: 'Server misconfigured' }, 500, req, allowedOrigins)
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Missing authorization' }, 401, req, allowedOrigins)
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    return json({ error: 'Invalid or expired token' }, 401, req, allowedOrigins)
  }
  const userId = userData.user.id

  // Always BYOK — user supplies their own Ollama server.
  const rlResult = await checkRateLimit({
    userId,
    tier: 'byok',
    supabaseUrl,
    serviceRoleKey,
  })
  const rlHeaders = rateLimitHeaders(rlResult)
  if (!rlResult.allowed) {
    return json(
      { error: 'Too many requests', retryAfter: rlResult.retryAfter },
      429,
      req,
      allowedOrigins,
      rlHeaders,
    )
  }

  // Route dispatch. Supabase Functions include the function name in the path,
  // so strip the `/ai-ollama` prefix before matching sub-routes.
  const url = new URL(req.url)
  let subPath = url.pathname
  const prefixIdx = subPath.indexOf('/ai-ollama')
  if (prefixIdx >= 0) subPath = subPath.slice(prefixIdx + '/ai-ollama'.length)
  if (subPath === '' || subPath === '/') subPath = '/'

  // GET /health
  if (req.method === 'GET' && subPath === '/health') {
    const serverUrl = url.searchParams.get('serverUrl')
    if (!serverUrl) {
      return json(
        { error: 'serverUrl query parameter is required' },
        400,
        req,
        allowedOrigins,
        rlHeaders,
      )
    }
    if (!isAllowedOllamaUrl(serverUrl)) {
      return json({ error: 'Invalid Ollama URL' }, 400, req, allowedOrigins, rlHeaders)
    }
    return handleHealth(req, allowedOrigins, rlHeaders, serverUrl)
  }

  // GET /tags
  if (req.method === 'GET' && subPath === '/tags') {
    const serverUrl = url.searchParams.get('serverUrl')
    if (!serverUrl) {
      return json(
        { error: 'serverUrl query parameter is required' },
        400,
        req,
        allowedOrigins,
        rlHeaders,
      )
    }
    if (!isAllowedOllamaUrl(serverUrl)) {
      return json({ error: 'Invalid Ollama URL' }, 400, req, allowedOrigins, rlHeaders)
    }
    return handleTags(req, allowedOrigins, rlHeaders, serverUrl)
  }

  // POST /chat and POST / (legacy) — both stream Ollama's /api/chat NDJSON.
  if (req.method === 'POST' && (subPath === '/chat' || subPath === '/')) {
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, req, allowedOrigins, rlHeaders)
    }
    if (!rawBody || typeof rawBody !== 'object') {
      return json({ error: 'Malformed request body' }, 400, req, allowedOrigins, rlHeaders)
    }
    return handleChat(req, allowedOrigins, rlHeaders, rawBody as Record<string, unknown>)
  }

  return json({ error: 'Not found' }, 404, req, allowedOrigins, rlHeaders)
})
