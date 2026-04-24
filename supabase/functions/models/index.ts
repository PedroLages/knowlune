// GET /models/:provider — list available LLM models for a BYOK provider.
// Ported from server/routes/models.ts (openai, groq, openrouter).
//
// - Origin allow-list + CORS preflight
// - JWT verification via Supabase auth
// - Reads user's API key from X-API-Key header (BYOK — no entitlement/rate-limit)
// - Forwards to the upstream models endpoint and returns the raw JSON payload
//   so the SPA's modelDiscovery parser (expects `{ data: [...] }`) works unchanged
// - 5-minute client cache via Cache-Control

import { createClient } from 'npm:@supabase/supabase-js@^2'
import {
  getAllowedOrigins,
  handlePreflight,
  checkOrigin,
  corsHeaders,
} from '../_shared/origin-check.ts'

type SupportedProvider = 'openai' | 'groq' | 'openrouter'

interface UpstreamConfig {
  url: string
  headers: Record<string, string>
  timeoutMs: number
}

function buildUpstream(provider: SupportedProvider, apiKey: string): UpstreamConfig {
  switch (provider) {
    case 'openai':
      return {
        url: 'https://api.openai.com/v1/models',
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000,
      }
    case 'groq':
      return {
        url: 'https://api.groq.com/openai/v1/models',
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000,
      }
    case 'openrouter':
      return {
        url: 'https://openrouter.ai/api/v1/models',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://knowlune.app',
          'X-Title': 'Knowlune',
        },
        timeoutMs: 15_000,
      }
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

Deno.serve(async (req) => {
  const allowedOrigins = getAllowedOrigins()

  const preflight = handlePreflight(req, allowedOrigins)
  if (preflight) return preflight

  const originDenied = checkOrigin(req, allowedOrigins)
  if (originDenied) return originDenied

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, req, allowedOrigins)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    console.error('[models] Missing SUPABASE_* environment variables')
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

  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key')
  if (!apiKey) {
    return json({ error: 'X-API-Key header is required' }, 400, req, allowedOrigins)
  }

  const { pathname } = new URL(req.url)
  const segments = pathname.split('/').filter((s) => s.length > 0)
  const provider = segments[segments.length - 1] as SupportedProvider

  if (provider !== 'openai' && provider !== 'groq' && provider !== 'openrouter') {
    return json({ error: 'Unsupported provider' }, 404, req, allowedOrigins)
  }

  const upstream = buildUpstream(provider, apiKey)

  try {
    const response = await fetch(upstream.url, {
      headers: upstream.headers,
      signal: AbortSignal.timeout(upstream.timeoutMs),
    })

    if (response.status === 401 || response.status === 403) {
      return json({ error: 'Invalid API key' }, response.status, req, allowedOrigins)
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      return json(
        { error: `${provider} returned ${response.status}: ${errorText}` },
        response.status,
        req,
        allowedOrigins,
      )
    }

    const data = await response.json()
    return json(data, 200, req, allowedOrigins, {
      'Cache-Control': 'private, max-age=300',
    })
  } catch (err) {
    const name = (err as Error).name
    const message = (err as Error).message
    console.error(`[models/${provider}] Error:`, message)
    if (name === 'AbortError' || name === 'TimeoutError') {
      return json({ error: `${provider} API timed out` }, 504, req, allowedOrigins)
    }
    return json({ error: message }, 500, req, allowedOrigins)
  }
})
