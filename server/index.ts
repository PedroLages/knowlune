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

const app = express()
const PORT = 3001

app.use(express.json({ limit: '1mb' }))

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

    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    return true
  } catch {
    return false
  }
}

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
  provider: z.enum(['openai', 'anthropic', 'groq', 'gemini', 'glm']),
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

    if (provider === 'glm') {
      res.status(400).json({ error: 'GLM provider is not yet supported' })
      return
    }

    const providerModel = getProviderModel(provider, apiKey, model)

    const result = await generateText({
      model: providerModel,
      messages,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
    })

    res.json({ text: result.text })
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

    if (provider === 'glm') {
      res.status(400).json({ error: 'GLM provider is not yet supported' })
      return
    }

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
