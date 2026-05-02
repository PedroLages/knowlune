// POST /ai-generate — non-streaming AI text generation.
// Ported from server/index.ts `POST /api/ai/generate`.
//
// - Origin allow-list + CORS preflight
// - JWT verification via Supabase auth
// - BYOK detection (apiKey or ollamaServerUrl) bypasses entitlement and uses the 'byok' rate-limit tier
// - Non-BYOK resolves entitlement tier and applies tier-scoped rate limits
// - Ollama BYOK routes through the dedicated provider helper with SSRF guard

import { createClient } from 'npm:@supabase/supabase-js@^2'
import { generateText } from 'npm:ai@^6.0.97'
import {
  getAllowedOrigins,
  handlePreflight,
  checkOrigin,
  corsHeaders,
} from '../_shared/origin-check.ts'
import { isBYOK, resolveEntitlement } from '../_shared/entitlement.ts'
import {
  checkRateLimit,
  rateLimitHeaders,
  type RateLimitTier,
} from '../_shared/rate-limit.ts'
import {
  getProviderModel,
  getOllamaProviderModel,
  type ProviderId,
} from '../_shared/providers.ts'

type ChatRole = 'system' | 'user' | 'assistant'
interface ChatMessage {
  role: ChatRole
  content: string
}

interface GenerateBody {
  provider: ProviderId
  apiKey?: string
  ollamaServerUrl?: string
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

const VALID_PROVIDERS: ReadonlySet<ProviderId> = new Set([
  'anthropic',
  'openai',
  'groq',
  'gemini',
  'openrouter',
  'glm',
  'ollama',
])

const PLATFORM_KEY_ENV: Record<Exclude<ProviderId, 'ollama'>, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  glm: 'ZHIPU_API_KEY',
}

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

function validateBody(raw: unknown): GenerateBody | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  if (typeof b.provider !== 'string' || !VALID_PROVIDERS.has(b.provider as ProviderId)) return null
  if (!Array.isArray(b.messages) || b.messages.length === 0) return null
  for (const m of b.messages) {
    if (!m || typeof m !== 'object') return null
    const mm = m as Record<string, unknown>
    if (mm.role !== 'system' && mm.role !== 'user' && mm.role !== 'assistant') return null
    if (typeof mm.content !== 'string') return null
  }
  if (b.apiKey !== undefined && typeof b.apiKey !== 'string') return null
  if (b.ollamaServerUrl !== undefined && typeof b.ollamaServerUrl !== 'string') return null
  if (b.model !== undefined && typeof b.model !== 'string') return null
  if (b.temperature !== undefined && typeof b.temperature !== 'number') return null
  if (b.maxTokens !== undefined && typeof b.maxTokens !== 'number') return null
  if (typeof b.ollamaServerUrl === 'string' && b.ollamaServerUrl.length > 0 && b.provider !== 'ollama') {
    return null
  }
  return b as unknown as GenerateBody
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

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req, allowedOrigins)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[ai-generate] Missing SUPABASE_* environment variables')
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

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req, allowedOrigins)
  }

  const body = validateBody(rawBody)
  if (!body) {
    return json({ error: 'Malformed request body' }, 400, req, allowedOrigins)
  }

  const byok = isBYOK(body)

  let tier: RateLimitTier
  if (byok) {
    tier = 'byok'
  } else {
    tier = await resolveEntitlement({ userId, supabaseUrl, serviceRoleKey })
  }

  const rlResult = await checkRateLimit({ userId, tier, supabaseUrl, serviceRoleKey })
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

  let providerModel
  try {
    if (body.provider === 'ollama') {
      const url = body.ollamaServerUrl
      if (!url || !isAllowedOllamaUrl(url)) {
        return json(
          { error: 'Invalid or disallowed ollamaServerUrl' },
          400,
          req,
          allowedOrigins,
          rlHeaders,
        )
      }
      providerModel = getOllamaProviderModel(url, body.model)
    } else {
      let apiKey = byok ? body.apiKey : undefined
      if (!apiKey) {
        const envName = PLATFORM_KEY_ENV[body.provider]
        apiKey = Deno.env.get(envName) || undefined
      }
      if (!apiKey) {
        console.error(`[ai-generate] No API key available for provider ${body.provider}`)
        return json(
          { error: 'Provider not configured' },
          500,
          req,
          allowedOrigins,
          rlHeaders,
        )
      }
      providerModel = getProviderModel(body.provider, apiKey, body.model)
    }
  } catch (err) {
    console.error('[ai-generate] Failed to build provider model:', (err as Error).message)
    return json(
      { error: (err as Error).message },
      400,
      req,
      allowedOrigins,
      rlHeaders,
    )
  }

  try {
    const result = await generateText({
      model: providerModel,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      maxOutputTokens: body.maxTokens ?? 4096,
    })

    const usage = result.usage ?? {}
    const promptTokens =
      (usage as { promptTokens?: number; inputTokens?: number }).promptTokens ??
      (usage as { inputTokens?: number }).inputTokens ??
      0
    const completionTokens =
      (usage as { completionTokens?: number; outputTokens?: number }).completionTokens ??
      (usage as { outputTokens?: number }).outputTokens ??
      0
    const totalTokens =
      (usage as { totalTokens?: number }).totalTokens ??
      promptTokens + completionTokens

    return json(
      {
        text: result.text,
        usage: { promptTokens, completionTokens, totalTokens },
        finishReason: result.finishReason,
      },
      200,
      req,
      allowedOrigins,
      rlHeaders,
    )
  } catch (err) {
    console.error('[ai-generate] Provider error:', (err as Error).message)
    return json(
      { error: (err as Error).message },
      502,
      req,
      allowedOrigins,
      rlHeaders,
    )
  }
})
