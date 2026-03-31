/**
 * Model Discovery Proxy Routes
 *
 * Proxies model listing API calls to cloud providers to avoid CORS issues.
 * Gemini's API is CORS-friendly so it's called directly from the browser.
 *
 * Endpoints:
 *   GET /api/ai/models/openai  — Proxy to OpenAI GET /v1/models
 *   GET /api/ai/models/groq    — Proxy to Groq GET /openai/v1/models
 *
 * @see E90-S04 — Model Discovery for Cloud Providers
 */

import { Router } from 'express'

const router = Router()

/**
 * GET /api/ai/models/openai
 *
 * Proxies to OpenAI's model listing endpoint.
 * Requires X-API-Key header with the user's OpenAI API key.
 */
router.get('/openai', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] as string
    if (!apiKey) {
      res.status(400).json({ error: 'X-API-Key header is required' })
      return
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText) // eslint-disable-line error-handling/no-silent-catch -- server-side
      res.status(response.status).json({ error: `OpenAI returned ${response.status}: ${errorText}` })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    // silent-catch-ok — logs to console and returns error response to client
    console.error('[/api/ai/models/openai] Error:', (error as Error).message)
    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      res.status(504).json({ error: 'OpenAI API timed out' })
      return
    }
    res.status(500).json({ error: (error as Error).message })
  }
})

/**
 * GET /api/ai/models/groq
 *
 * Proxies to Groq's model listing endpoint (OpenAI-compatible).
 * Requires X-API-Key header with the user's Groq API key.
 */
router.get('/groq', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] as string
    if (!apiKey) {
      res.status(400).json({ error: 'X-API-Key header is required' })
      return
    }

    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText) // eslint-disable-line error-handling/no-silent-catch -- server-side
      res.status(response.status).json({ error: `Groq returned ${response.status}: ${errorText}` })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    // silent-catch-ok — logs to console and returns error response to client
    console.error('[/api/ai/models/groq] Error:', (error as Error).message)
    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      res.status(504).json({ error: 'Groq API timed out' })
      return
    }
    res.status(500).json({ error: (error as Error).message })
  }
})

/**
 * GET /api/ai/models/openrouter
 *
 * Proxies to OpenRouter's model listing endpoint.
 * Returns models grouped by source provider with cost tier info.
 * Requires X-API-Key header with the user's OpenRouter API key.
 *
 * @see E90-S09 — Add OpenRouter as Optional Single-Gateway Provider
 */
router.get('/openrouter', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] as string
    if (!apiKey) {
      res.status(400).json({ error: 'X-API-Key header is required' })
      return
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://knowlune.app',
        'X-Title': 'Knowlune',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText) // eslint-disable-line error-handling/no-silent-catch -- server-side
      res.status(response.status).json({ error: `OpenRouter returned ${response.status}: ${errorText}` })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    // silent-catch-ok — logs to console and returns error response to client
    console.error('[/api/ai/models/openrouter] Error:', (error as Error).message)
    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      res.status(504).json({ error: 'OpenRouter API timed out' })
      return
    }
    res.status(500).json({ error: (error as Error).message })
  }
})

export default router
