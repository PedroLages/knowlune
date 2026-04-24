// Supabase Edge Function: POST /ai-stream
//
// SSE streaming AI completion endpoint. Ports the Express /api/ai/stream route
// to a Deno edge worker. Emits plain SSE events compatible with ProxyLLMClient:
//   data: {"content": "..."}\n\n
//   data: [DONE]\n\n
//
// Mirrors behavior of server/index.ts:
//   1. Origin check + CORS preflight
//   2. JWT verification via Supabase
//   3. Body validation
//   4. BYOK detection → skip entitlement, else resolve tier
//   5. Rate limit
//   6. Build provider model (Ollama BYOK guarded by isAllowedOllamaUrl)
//   7. streamText() → iterate result.textStream → SSE-encode chunks
//   8. 502 on provider failure BEFORE stream; mid-stream errors surface as SSE error events

import { streamText } from 'npm:ai@^6.0.97'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import {
  checkOrigin,
  corsHeaders,
  getAllowedOrigins,
  handlePreflight,
} from '../_shared/origin-check.ts'
import {
  getOllamaProviderModel,
  getProviderModel,
  type ProviderId,
} from '../_shared/providers.ts'
import {
  isBYOK,
  resolveEntitlement,
  type EntitlementTier,
} from '../_shared/entitlement.ts'
import {
  checkRateLimit,
  rateLimitHeaders,
  type RateLimitTier,
} from '../_shared/rate-limit.ts'

console.log('ai-stream function started')

// ─────────────────────────────────────────────────────────────────────────────
// SSRF guard for Ollama BYOK — port of server/index.ts isAllowedOllamaUrl.
// Blocks loopback + link-local (169.254/16 includes cloud metadata endpoint).
// ─────────────────────────────────────────────────────────────────────────────
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
    // eslint-disable-next-line error-handling/no-silent-catch -- URL parse failure → deny
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Body schema (mirrors Express RequestSchema, minimal runtime validation).
// ─────────────────────────────────────────────────────────────────────────────
type Message = { role: 'system' | 'user' | 'assistant'; content: string }
interface RequestBody {
  provider: ProviderId
  apiKey?: string
  ollamaServerUrl?: string
  messages: Message[]
  model?: string
  temperature?: number
  maxTokens?: number
}

const VALID_PROVIDERS: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'anthropic',
  'openai',
  'groq',
  'gemini',
  'openrouter',
  'glm',
  'ollama',
])

function validateBody(raw: unknown): { ok: true; value: RequestBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be an object' }
  const b = raw as Record<string, unknown>

  if (typeof b.provider !== 'string' || !VALID_PROVIDERS.has(b.provider as ProviderId)) {
    return { ok: false, error: 'Invalid or missing provider' }
  }
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array' }
  }
  for (const m of b.messages) {
    if (
      !m ||
      typeof m !== 'object' ||
      typeof (m as Message).role !== 'string' ||
      typeof (m as Message).content !== 'string'
    ) {
      return { ok: false, error: 'Each message must have role and content strings' }
    }
  }
  if (b.apiKey !== undefined && typeof b.apiKey !== 'string') {
    return { ok: false, error: 'apiKey must be a string' }
  }
  if (b.ollamaServerUrl !== undefined && typeof b.ollamaServerUrl !== 'string') {
    return { ok: false, error: 'ollamaServerUrl must be a string' }
  }
  if (b.model !== undefined && typeof b.model !== 'string') {
    return { ok: false, error: 'model must be a string' }
  }
  if (b.temperature !== undefined && typeof b.temperature !== 'number') {
    return { ok: false, error: 'temperature must be a number' }
  }
  if (b.maxTokens !== undefined && typeof b.maxTokens !== 'number') {
    return { ok: false, error: 'maxTokens must be a number' }
  }

  return { ok: true, value: b as unknown as RequestBody }
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform-key lookup for non-BYOK requests.
// ─────────────────────────────────────────────────────────────────────────────
function getPlatformApiKey(provider: ProviderId): string | undefined {
  switch (provider) {
    case 'anthropic':
      return Deno.env.get('ANTHROPIC_API_KEY')
    case 'openai':
      return Deno.env.get('OPENAI_API_KEY')
    case 'groq':
      return Deno.env.get('GROQ_API_KEY')
    case 'gemini':
      return Deno.env.get('GOOGLE_API_KEY')
    case 'openrouter':
      return Deno.env.get('OPENROUTER_API_KEY')
    case 'glm':
      return Deno.env.get('ZHIPU_API_KEY')
    case 'ollama':
      return undefined
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE helpers — emit plain "data: <json>\n\n" frames matching the Express
// route, which ProxyLLMClient.parseSSEStream + JSON.parse consumes directly.
// ─────────────────────────────────────────────────────────────────────────────
function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function jsonResponse(
  body: unknown,
  status: number,
  req: Request,
  allowedOrigins: string[],
  extraHeaders: Record<string, string> = {}
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

Deno.serve(async (req: Request) => {
  const allowedOrigins = getAllowedOrigins()

  // 1. Preflight
  const preflight = handlePreflight(req, allowedOrigins)
  if (preflight) return preflight

  // 2. Origin check
  const originDenied = checkOrigin(req, allowedOrigins)
  if (originDenied) return originDenied

  // 3. Method gate
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req, allowedOrigins, {
      Allow: 'POST, OPTIONS',
    })
  }

  // 4. JWT verification via Supabase
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization header' }, 401, req, allowedOrigins)
  }
  const token = authHeader.slice(7)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[ai-stream] Missing Supabase env configuration')
    return jsonResponse({ error: 'Server misconfigured' }, 500, req, allowedOrigins)
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401, req, allowedOrigins)
  }
  const userId = userData.user.id

  // 5. Parse + validate body
  let rawBody: unknown
  try {
    rawBody = await req.json()
    // eslint-disable-next-line error-handling/no-silent-catch -- malformed JSON → 400
  } catch {
    return jsonResponse({ error: 'Malformed JSON body' }, 400, req, allowedOrigins)
  }
  const validated = validateBody(rawBody)
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400, req, allowedOrigins)
  }
  const body = validated.value

  // 6. Entitlement → tier
  const byok = isBYOK(body)
  let tier: RateLimitTier
  if (byok) {
    tier = 'byok'
  } else {
    const entitlement: EntitlementTier = await resolveEntitlement({
      userId,
      supabaseUrl,
      serviceRoleKey,
    })
    tier = entitlement
  }

  // 7. Rate limit
  const rl = await checkRateLimit({ userId, tier, supabaseUrl, serviceRoleKey })
  if (!rl.allowed) {
    return jsonResponse(
      { error: 'Rate limit exceeded' },
      429,
      req,
      allowedOrigins,
      rateLimitHeaders(rl)
    )
  }

  // 8. Build provider model
  let model
  try {
    if (body.provider === 'ollama') {
      const serverUrl = body.ollamaServerUrl
      if (!serverUrl) {
        return jsonResponse(
          { error: 'ollamaServerUrl is required for ollama provider' },
          400,
          req,
          allowedOrigins,
          rateLimitHeaders(rl)
        )
      }
      if (!isAllowedOllamaUrl(serverUrl)) {
        return jsonResponse(
          { error: 'Ollama server URL targets a disallowed address' },
          403,
          req,
          allowedOrigins,
          rateLimitHeaders(rl)
        )
      }
      model = getOllamaProviderModel(serverUrl, body.model)
    } else {
      const apiKey = byok && body.apiKey ? body.apiKey : getPlatformApiKey(body.provider)
      if (!apiKey) {
        return jsonResponse(
          { error: `No API key available for provider: ${body.provider}` },
          500,
          req,
          allowedOrigins,
          rateLimitHeaders(rl)
        )
      }
      model = getProviderModel(body.provider, apiKey, body.model)
    }
  } catch (err) {
    console.error('[ai-stream] Provider init failed:', (err as Error).message)
    return jsonResponse(
      { error: (err as Error).message },
      502,
      req,
      allowedOrigins,
      rateLimitHeaders(rl)
    )
  }

  // 9. Kick off streamText. Failures that throw BEFORE iteration start surface
  //    as 502; errors during iteration become in-band SSE error frames since
  //    HTTP status has already been committed.
  let result
  try {
    result = streamText({
      model,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      maxOutputTokens: body.maxTokens ?? 4096,
    })
  } catch (err) {
    console.error('[ai-stream] streamText init failed:', (err as Error).message)
    return jsonResponse(
      { error: (err as Error).message },
      502,
      req,
      allowedOrigins,
      rateLimitHeaders(rl)
    )
  }

  // 10. Build SSE ReadableStream matching the Express route's wire format.
  //     Client (ProxyLLMClient) reads plain SSE and JSON.parse's each data
  //     frame, looking for `content` or `error`.
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(sseData({ content: chunk })))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        // Mid-stream error — HTTP status already 200, emit SSE error frame.
        console.error('[ai-stream] Stream error:', (err as Error).message)
        try {
          controller.enqueue(encoder.encode(sseData({ error: (err as Error).message })))
          controller.close()
          // eslint-disable-next-line error-handling/no-silent-catch -- controller may already be closed
        } catch {
          // no-op: stream already torn down
        }
      }
    },
    cancel() {
      // Client disconnected — nothing to clean up explicitly; GC will release
      // the async iterator. Log for visibility.
      console.log('[ai-stream] Client cancelled stream')
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders(req, allowedOrigins),
      ...rateLimitHeaders(rl),
    },
  })
})
