/**
 * AI Proxy Server
 *
 * Lightweight Express server that proxies LLM requests through the Vercel AI SDK.
 * Solves CORS restrictions (Anthropic, Groq, Gemini block browser-direct calls)
 * and keeps API keys out of browser network traffic.
 *
 * Endpoints:
 *   POST /api/ai/generate  — Non-streaming text generation
 *   POST /api/ai/stream    — SSE streaming text generation
 *
 * The browser sends { provider, apiKey, messages, model?, temperature?, maxTokens? }
 * and receives a unified response regardless of which provider is used.
 */

import express from 'express'
import { generateText, streamText } from 'ai'
import { z } from 'zod'
import { getProviderModel, getOllamaProviderModel } from './providers.js'
import modelsRouter from './routes/models.js'
import { createOriginCheck } from './middleware/origin-check.js'
import { createAuthMiddleware } from './middleware/authenticate.js'
import { createDetectBYOKMiddleware, createEntitlementMiddleware } from './middleware/entitlement.js'
import { createRateLimiter } from './middleware/rate-limiter.js'
import calendarRouter from './routes/calendar.js'
import rateLimit from 'express-rate-limit'

const app = express()
const PORT = 3001

app.use(express.json({ limit: '1mb' }))

// ──────────────────────────────────────────────────────────────────────────────
// Middleware Chain Setup
//
// Order: 1. Origin check → 2. JWT auth → 3. BYOK detection → 4. Entitlement check (skipped for BYOK) → 5. Rate limiter
// Applied to all /api/ai/* routes EXCEPT /api/ai/ollama/health (registered before chain).
//
// BYOK (Bring Your Own Key) requests provide their own API key or Ollama server URL.
// These skip the entitlement check but still require valid JWT auth (no open relay).
// BYOK uses a separate rate limit tier (30 burst, 15/min refill).
//
// Environment variables required:
//   SUPABASE_JWT_SECRET     — JWT verification (from Supabase dashboard)
//   SUPABASE_SERVICE_ROLE_KEY — Server-side Supabase queries
//   ALLOWED_ORIGINS         — Comma-separated allowed origins
//   VITE_SUPABASE_URL       — Supabase project URL (for entitlement lookups)
// ──────────────────────────────────────────────────────────────────────────────

// Build middleware instances (only if env vars are configured — allows dev without auth)
const isMiddlewareConfigured =
  process.env.SUPABASE_JWT_SECRET &&
  process.env.ALLOWED_ORIGINS &&
  process.env.VITE_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Validates that a URL targets a non-loopback, plausible Ollama server.
 * Blocks localhost / 127.x / [::1] to prevent SSRF against the proxy host itself.
 * Private-network ranges (192.168.x, 10.x, 172.16-31.x) are intentionally allowed
 * because Ollama servers are typically on the user's LAN.
 */
export function isAllowedOllamaUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname.toLowerCase()

    // Block loopback addresses — proxy should not call itself
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

    // Block link-local range 169.254.0.0/16 — includes cloud metadata endpoint
    // (169.254.169.254) used by AWS/GCP/Azure. Defense-in-depth against SSRF.
    if (hostname.startsWith('169.254.')) {
      return false
    }

    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    return true
  // eslint-disable-next-line error-handling/no-silent-catch -- server-side error handling
  } catch {
    return false
  }
}

/**
 * GET /api/ai/ollama/health
 *
 * Proxy endpoint for Ollama health check. Pings the Ollama server root endpoint
 * which returns "Ollama is running" when the server is healthy.
 * Used by E22-S03 connection testing and startup health check.
 *
 * Query params:
 *   serverUrl - The Ollama server URL (e.g., http://192.168.2.200:11434)
 */
app.get('/api/ai/ollama/health', async (req, res) => {
  try {
    const serverUrl = req.query.serverUrl as string
    if (!serverUrl) {
      res.status(400).json({ error: 'serverUrl query parameter is required' })
      return
    }

    if (!isAllowedOllamaUrl(serverUrl)) {
      res.status(403).json({ error: 'Ollama server URL targets a disallowed address' })
      return
    }

    const normalizedUrl = serverUrl.replace(/\/+$/, '')
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      // eslint-disable-next-line error-handling/no-silent-catch -- server-side error handling
      const errorText = await response.text().catch(() => response.statusText)
      res.status(response.status).json({ error: `Ollama returned ${response.status}: ${errorText}` })
      return
    }

    const body = await response.text()
    res.send(body)
  } catch (error) {
    // silent-catch-ok — logs to console and returns error response to client
    console.error('[/api/ai/ollama/health] Error:', (error as Error).message)

    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      res.status(504).json({ error: 'Ollama server timed out' })
      return
    }

    const msg = (error as Error).message
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      res.status(502).json({
        error: `Cannot reach Ollama server. Is it running at the specified URL?`,
      })
      return
    }

    res.status(500).json({ error: (error as Error).message })
  }
})

// ──────────────────────────────────────────────────────────────────────────────
// Audiobookshelf Proxy — bypasses browser CORS by proxying through Express.
// No JWT required: the user's own ABS API key authenticates against their server.
// Rate limited to prevent abuse (10 req/min — catalog browsing, not streaming).
// ──────────────────────────────────────────────────────────────────────────────

const ABS_TIMEOUT_MS = 15_000

const absRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too Many Requests',
})

/**
 * GET /api/abs/ping — test ABS connection (lightweight, no auth chain)
 */
app.get('/api/abs/ping', absRateLimit, async (req, res) => {
  const absUrl = req.headers['x-abs-url'] as string
  const absToken = req.headers['x-abs-token'] as string

  if (!absUrl || !absToken) {
    res.status(400).json({ error: 'X-ABS-URL and X-ABS-Token headers are required' })
    return
  }

  if (!isAllowedOllamaUrl(absUrl)) {
    res.status(403).json({ error: 'Server URL targets a disallowed address' })
    return
  }

  try {
    const normalizedUrl = absUrl.replace(/\/+$/, '')
    const response = await fetch(`${normalizedUrl}/ping`, {
      headers: { Authorization: `Bearer ${absToken}`, 'User-Agent': 'Knowlune/1.0' },
      signal: AbortSignal.timeout(ABS_TIMEOUT_MS),
    })

    if (!response.ok) {
      res.status(response.status).json({ error: `Server returned ${response.status}` })
      return
    }

    const data = await response.text()
    res.setHeader('Content-Type', 'application/json')
    res.send(data)
  } catch (error) {
    // silent-catch-ok — returns structured error to client
    console.error('[/api/abs/ping]', (error as Error).message)
    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      res.status(504).json({ error: 'Server timed out' })
      return
    }
    const msg = (error as Error).message
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      res.status(502).json({ error: 'Cannot reach server. Check the URL.' })
      return
    }
    res.status(500).json({ error: msg })
  }
})

/**
 * ALL /api/abs/proxy/* — generic ABS API proxy.
 * Forwards any request to the user's ABS server, relaying method, headers, and body.
 * The ABS server URL and API token are passed via X-ABS-URL / X-ABS-Token headers,
 * or via _absUrl / _absToken query params (for <img>/<audio> tags that can't set headers).
 */
app.use('/api/abs/proxy', absRateLimit, async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  const absUrl = (req.headers['x-abs-url'] as string) || (req.query._absUrl as string)
  const absToken = (req.headers['x-abs-token'] as string) || (req.query._absToken as string)

  if (!absUrl || !absToken) {
    res.status(400).json({ error: 'ABS server URL and token are required (headers or query params)' })
    return
  }

  if (!isAllowedOllamaUrl(absUrl)) {
    res.status(403).json({ error: 'Server URL targets a disallowed address' })
    return
  }

  // req.path is relative to the mount point (/api/abs/proxy)
  const absPath = req.path || '/'
  const normalizedUrl = absUrl.replace(/\/+$/, '')

  // Forward original query params (minus our internal _absUrl/_absToken)
  const forwardParams = new URLSearchParams(req.query as Record<string, string>)
  forwardParams.delete('_absUrl')
  forwardParams.delete('_absToken')
  const qs = forwardParams.toString()
  const targetUrl = `${normalizedUrl}${absPath}${qs ? `?${qs}` : ''}`

  try {
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body != null
    const headers: Record<string, string> = {
      Authorization: `Bearer ${absToken}`,
      'User-Agent': 'Knowlune/1.0',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(ABS_TIMEOUT_MS),
    }

    if (hasBody) {
      fetchOptions.body = JSON.stringify(req.body)
    }

    const response = await fetch(targetUrl, fetchOptions)

    // Relay status and content-type
    const contentType = response.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    // For binary responses (covers, streams), pipe the body directly
    if (contentType && !contentType.includes('application/json') && response.body) {
      res.status(response.status)
      const reader = response.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      } finally {
        res.end()
      }
      return
    }

    // For JSON responses, relay the text
    const text = await response.text()
    res.status(response.status).send(text)
  } catch (error) {
    // silent-catch-ok — returns structured error to client
    console.error('[/api/abs/proxy]', (error as Error).message)
    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      res.status(504).json({ error: 'Server timed out' })
      return
    }
    const msg = (error as Error).message
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      res.status(502).json({ error: 'Cannot reach server. Check the URL.' })
      return
    }
    res.status(500).json({ error: msg })
  }
})

// ──────────────────────────────────────────────────────────────────────────────
// Calendar feed route — token-authenticated, no JWT required (E50-S02)
// MUST BE BEFORE JWT MIDDLEWARE — calendar uses token-in-URL auth model
// Rate limited separately since it bypasses the main middleware chain.
// ──────────────────────────────────────────────────────────────────────────────
const calendarRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 requests per IP per minute (calendar apps poll every 15-60 min)
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too Many Requests',
})
app.use('/api/calendar', calendarRateLimit, calendarRouter)

// ──────────────────────────────────────────────────────────────────────────────
// Apply middleware chain to all /api/ai/* routes below this point.
// Health check (above) is intentionally registered first to bypass all auth.
//
// Middleware order:
//   1. Origin check — reject requests from disallowed origins
//   2. JWT authentication — validate Supabase JWT, attach user to request
//   3. BYOK detection — detect body.apiKey or body.ollamaServerUrl, mark req.isBYOK
//   4. Entitlement check — verify premium subscription (skipped for BYOK)
//   5. Rate limiter — per-user token bucket (BYOK uses separate tier)
// ──────────────────────────────────────────────────────────────────────────────
if (isMiddlewareConfigured) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS!.split(',').map((o) => o.trim())

  // 1. Origin check
  app.use('/api/ai', createOriginCheck({ allowedOrigins }))

  // 2. JWT authentication
  app.use('/api/ai', createAuthMiddleware({ jwtSecret: process.env.SUPABASE_JWT_SECRET }))

  // 3. BYOK detection — marks req.isBYOK for requests with apiKey or ollamaServerUrl
  app.use('/api/ai', createDetectBYOKMiddleware())

  // 4. Entitlement check (skipped for BYOK requests — user provides their own key/server)
  app.use(
    '/api/ai',
    createEntitlementMiddleware({
      supabaseUrl: process.env.VITE_SUPABASE_URL!,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    })
  )

  // 5. Rate limiter — BYOK uses separate tier (30 burst / 120s), default is 100/60s
  app.use('/api/ai', createRateLimiter({ points: 100, duration: 60 }))

  console.log('Middleware chain active: origin-check → authenticate → detectBYOK → entitlement → rate-limiter')
} else {
  console.warn(
    'Middleware chain DISABLED — missing env vars (SUPABASE_JWT_SECRET, ALLOWED_ORIGINS, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). AI endpoints are unprotected.'
  )
}

// Model discovery proxy routes (E90-S04)
app.use('/api/ai/models', modelsRouter)

/**
 * GET /api/ai/ollama/tags
 *
 * Proxy endpoint for listing available Ollama models via GET /api/tags.
 * Avoids CORS issues when the browser needs to discover models before
 * a full LLM client is configured.
 *
 * Note: Registered AFTER middleware chain — requires auth when middleware is active.
 *
 * Query params:
 *   serverUrl - The Ollama server URL (e.g., http://192.168.2.200:11434)
 */
app.get('/api/ai/ollama/tags', async (req, res) => {
  try {
    const serverUrl = req.query.serverUrl as string
    if (!serverUrl) {
      res.status(400).json({ error: 'serverUrl query parameter is required' })
      return
    }

    if (!isAllowedOllamaUrl(serverUrl)) {
      res.status(403).json({ error: 'Ollama server URL targets a disallowed address' })
      return
    }

    const normalizedUrl = serverUrl.replace(/\/+$/, '')
    const response = await fetch(`${normalizedUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      // eslint-disable-next-line error-handling/no-silent-catch -- server-side error handling
      const errorText = await response.text().catch(() => response.statusText)
      res.status(response.status).json({ error: `Ollama returned ${response.status}: ${errorText}` })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    // silent-catch-ok — logs to console and returns error response to client
    console.error('[/api/ai/ollama/tags] Error:', (error as Error).message)

    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      res.status(504).json({ error: 'Ollama server timed out' })
      return
    }

    const msg = (error as Error).message
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      res.status(502).json({
        error: `Cannot reach Ollama server. Is it running at the specified URL?`,
      })
      return
    }

    res.status(500).json({ error: (error as Error).message })
  }
})

/**
 * POST /api/ai/ollama/chat
 *
 * Proxy endpoint for Ollama's native /api/chat endpoint (non-streaming).
 * Used by courseTagger.ts for auto-categorization with structured JSON output.
 * Validates the target URL via isAllowedOllamaUrl() to prevent SSRF.
 *
 * Body:
 *   ollamaServerUrl - The Ollama server URL
 *   model, messages, format, stream, options - Forwarded directly to Ollama
 */
app.post('/api/ai/ollama/chat', async (req, res) => {
  try {
    const { ollamaServerUrl, ...ollamaPayload } = req.body as {
      ollamaServerUrl?: string
      [key: string]: unknown
    }

    if (!ollamaServerUrl || typeof ollamaServerUrl !== 'string') {
      res.status(400).json({ error: 'ollamaServerUrl is required in request body' })
      return
    }

    if (!isAllowedOllamaUrl(ollamaServerUrl)) {
      res.status(403).json({ error: 'Ollama server URL targets a disallowed address' })
      return
    }

    const normalizedUrl = ollamaServerUrl.replace(/\/+$/, '')
    const response = await fetch(`${normalizedUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload),
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      // eslint-disable-next-line error-handling/no-silent-catch -- server-side error handling
      const errorText = await response.text().catch(() => response.statusText)
      res.status(response.status).json({ error: `Ollama returned ${response.status}: ${errorText}` })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    // silent-catch-ok — logs to console and returns error response to client
    console.error('[/api/ai/ollama/chat] Error:', (error as Error).message)

    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      res.status(504).json({ error: 'Ollama server timed out' })
      return
    }

    const msg = (error as Error).message
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      res.status(502).json({
        error: `Cannot reach Ollama server. Is it running at the specified URL?`,
      })
      return
    }

    res.status(500).json({ error: (error as Error).message })
  }
})

/** Ollama request body schema */
const OllamaRequestSchema = z.object({
  ollamaServerUrl: z.string().url('Valid Ollama server URL is required'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1, 'At least one message is required'),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
})

/** Request body schema — validated on every request */
const RequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'groq', 'gemini', 'glm', 'openrouter']),
  apiKey: z.string().min(1, 'API key is required'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1, 'At least one message is required'),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
})

/**
 * POST /api/ai/ollama
 *
 * Proxy endpoint for Ollama requests. Forwards to the user's Ollama server
 * using the OpenAI-compatible /v1/ endpoint. This avoids CORS issues since
 * the request goes: browser → Express proxy → Ollama server.
 *
 * Streams SSE events in the same format as /api/ai/stream for client compatibility.
 */
app.post('/api/ai/ollama', async (req, res) => {
  try {
    const parsed = OllamaRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors })
      return
    }

    const { ollamaServerUrl, messages, model, temperature, maxTokens } = parsed.data

    if (!isAllowedOllamaUrl(ollamaServerUrl)) {
      res.status(403).json({ error: 'Ollama server URL targets a disallowed address' })
      return
    }

    const providerModel = getOllamaProviderModel(ollamaServerUrl, model)

    const result = streamText({
      model: providerModel,
      messages,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
    })

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // Stream text chunks as SSE events
    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }

    // Signal stream end
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    // silent-catch-ok — logs to console and returns error response to client
    console.error('[/api/ai/ollama] Error:', (error as Error).message)

    if (!res.headersSent) {
      const status = getErrorStatus(error as Error)
      res.status(status).json({ error: (error as Error).message })
    } else {
      res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
      res.end()
    }
  }
})

/**
 * POST /api/ai/generate
 *
 * Non-streaming completion. Used by generatePath.ts for learning path generation.
 * Returns { text: string } with the full response.
 */
app.post('/api/ai/generate', async (req, res) => {
  try {
    const parsed = RequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors })
      return
    }

    const { provider, apiKey, messages, model, temperature, maxTokens } = parsed.data

    const providerModel = getProviderModel(provider, apiKey, model)

    const result = await generateText({
      model: providerModel,
      messages,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
    })

    res.json({ text: result.text })
  // eslint-disable-next-line error-handling/no-silent-catch -- server-side error handling
  } catch (error) {
    console.error('[/api/ai/generate] Error:', (error as Error).message)
    const status = getErrorStatus(error as Error)
    res.status(status).json({ error: (error as Error).message })
  }
})

/**
 * POST /api/ai/stream
 *
 * SSE streaming completion. Used by LLM clients for chat/Q&A features.
 * Sends plain SSE events: `data: {"content": "..."}\n\n`
 * Compatible with the existing parseSSEStream in BaseLLMClient.
 */
app.post('/api/ai/stream', async (req, res) => {
  try {
    const parsed = RequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors })
      return
    }

    const { provider, apiKey, messages, model, temperature, maxTokens } = parsed.data

    const providerModel = getProviderModel(provider, apiKey, model)

    const result = streamText({
      model: providerModel,
      messages,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
    })

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // Stream text chunks as SSE events
    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }

    // Signal stream end
    res.write('data: [DONE]\n\n')
    res.end()
  // eslint-disable-next-line error-handling/no-silent-catch -- server-side error handling
  } catch (error) {
    console.error('[/api/ai/stream] Error:', (error as Error).message)

    // If headers haven't been sent yet, send JSON error
    if (!res.headersSent) {
      const status = getErrorStatus(error as Error)
      res.status(status).json({ error: (error as Error).message })
    } else {
      // Headers already sent (mid-stream error) — send error as SSE event
      res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
      res.end()
    }
  }
})

/** Map common API errors to HTTP status codes */
function getErrorStatus(error: Error): number {
  const msg = error.message.toLowerCase()
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    return 401
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return 429
  }
  if (msg.includes('unsupported provider')) {
    return 400
  }
  return 500
}

app.listen(PORT, () => {
  console.log(`AI proxy server running on http://localhost:${PORT}`)
})
