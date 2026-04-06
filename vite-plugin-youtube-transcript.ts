/**
 * Vite plugin that proxies YouTube transcript requests through the dev server.
 *
 * `youtube-transcript` must run server-side because YouTube blocks browser
 * CORS requests to its transcript endpoints. This plugin follows the same
 * pattern as `ollamaDevProxy()` in `vite.config.ts`.
 *
 * Endpoints:
 *   POST /api/youtube/transcript          — Tier 1: youtube-transcript npm
 *   POST /api/youtube/ytdlp/subtitles     — Tier 2: yt-dlp subtitle extraction
 *   POST /api/youtube/ytdlp/metadata      — yt-dlp metadata enrichment
 *   POST /api/youtube/whisper/transcribe   — Tier 3: Whisper transcription
 *   POST /api/audio/transcribe              — Generic audio transcription
 *   POST /api/whisper/health                — Whisper server health check
 *   POST /api/whisper/transcribe            — Cloud Whisper (Groq/OpenAI) CORS proxy
 *
 * Tier 2 & 3 proxy to user-configured servers with SSRF validation.
 */
import type { Plugin } from 'vite'
import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, rm, readFile, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { isAllowedProxyUrl } from './src/lib/ssrfProtection'

const execFile = promisify(execFileCb)

/** Cache for Whisper model IDs per server URL (avoids repeated /v1/models calls) */
const whisperModelCache = new Map<string, string>()

export function youtubeTranscriptProxy(): Plugin {
  return {
    name: 'youtube-transcript-proxy',
    configureServer(server) {
      // Helper to read JSON body from IncomingMessage
      function readBody(req: import('http').IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
          let data = ''
          req.on('data', (chunk: Buffer) => { data += chunk.toString() })
          req.on('end', () => resolve(data))
          req.on('error', reject)
        })
      }

      // Helper for JSON error responses
      function sendError(
        res: import('http').ServerResponse,
        statusCode: number,
        error: string,
        code: string
      ) {
        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error, code }))
      }

      // Helper for proxy error handling
      function handleProxyError(
        res: import('http').ServerResponse,
        error: unknown,
        endpoint: string
      ) {
        const err = error as Error
        console.error(`[youtube-proxy ${endpoint}]`, err.message)

        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
          sendError(res, 504, `${endpoint} timed out`, 'timeout')
          return
        }
        if (err.message?.includes('fetch failed') || err.message?.includes('ECONNREFUSED')) {
          sendError(res, 502, `Cannot reach server. Is it running?`, 'network-error')
          return
        }
        sendError(res, 500, err.message, 'fetch-error')
      }

      // Validate video ID format (11 alphanumeric chars + hyphens/underscores)
      function isValidVideoId(videoId: unknown): videoId is string {
        return typeof videoId === 'string' && /^[\w-]{11}$/.test(videoId)
      }

      // Validate server URL with SSRF protection
      function validateServerUrl(
        serverUrl: unknown,
        res: import('http').ServerResponse
      ): string | null {
        if (!serverUrl || typeof serverUrl !== 'string') {
          sendError(res, 400, 'serverUrl is required', 'invalid-request')
          return null
        }
        if (!isAllowedProxyUrl(serverUrl)) {
          sendError(res, 403, 'Server URL rejected by SSRF validation', 'ssrf-blocked')
          return null
        }
        return serverUrl.replace(/\/+$/, '')
      }

      // -----------------------------------------------------------------------
      // POST /api/youtube/transcript — Tier 1: youtube-transcript npm
      // -----------------------------------------------------------------------
      server.middlewares.use('/api/youtube/transcript', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          const rawBody = await readBody(req)
          const { videoId, lang } = JSON.parse(rawBody) as {
            videoId?: string
            lang?: string
          }

          if (!isValidVideoId(videoId)) {
            sendError(res, 400, 'Invalid or missing videoId', 'invalid-video-id')
            return
          }

          // Dynamic import to avoid bundling server-only dependency
          const { YoutubeTranscript } = await import('youtube-transcript')

          const config: { lang?: string } = {}
          if (lang) config.lang = lang

          const segments = await YoutubeTranscript.fetchTranscript(videoId, config)

          // Map to TranscriptCue format (offset/duration in ms → seconds)
          const cues = segments.map(seg => ({
            startTime: seg.offset / 1000,
            endTime: (seg.offset + seg.duration) / 1000,
            text: seg.text
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim(),
          }))

          const detectedLang = segments[0]?.lang || lang || 'en'

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ cues, language: detectedLang }))
        } catch (error) { // silent-catch-ok — server-side middleware returns JSON error to client
          const err = error as Error
          console.error('[youtube-transcript-proxy]', err.message)

          // Map specific error types to user-friendly codes
          let code = 'fetch-error'
          let statusCode = 500

          if (err.constructor?.name === 'YoutubeTranscriptNotAvailableError' ||
              err.message?.includes('not available')) {
            code = 'no-captions-available'
            statusCode = 404
          } else if (err.constructor?.name === 'YoutubeTranscriptDisabledError' ||
                     err.message?.includes('disabled')) {
            code = 'captions-disabled'
            statusCode = 403
          } else if (err.constructor?.name === 'YoutubeTranscriptVideoUnavailableError' ||
                     err.message?.includes('unavailable')) {
            code = 'video-unavailable'
            statusCode = 404
          } else if (err.constructor?.name === 'YoutubeTranscriptTooManyRequestError' ||
                     err.message?.includes('Too many')) {
            code = 'rate-limited'
            statusCode = 429
          } else if (err.constructor?.name === 'YoutubeTranscriptNotAvailableLanguageError' ||
                     err.message?.includes('language')) {
            code = 'language-not-available'
            statusCode = 404
          } else if (err.message?.includes('fetch failed') || err.message?.includes('ECONNREFUSED')) {
            code = 'network-error'
            statusCode = 502
          }

          sendError(res, statusCode, err.message, code)
        }
      })

      // -----------------------------------------------------------------------
      // POST /api/youtube/ytdlp/subtitles — Tier 2: yt-dlp subtitle extraction
      // -----------------------------------------------------------------------
      server.middlewares.use('/api/youtube/ytdlp/subtitles', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          const rawBody = await readBody(req)
          const { videoId, serverUrl, lang } = JSON.parse(rawBody) as {
            videoId?: string
            serverUrl?: string
            lang?: string
          }

          if (!isValidVideoId(videoId)) {
            sendError(res, 400, 'Invalid or missing videoId', 'invalid-video-id')
            return
          }

          const normalizedUrl = validateServerUrl(serverUrl, res)
          if (!normalizedUrl) return

          // Proxy to user's yt-dlp server
          const proxyResponse = await fetch(`${normalizedUrl}/subtitles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, lang }),
            signal: AbortSignal.timeout(15_000),
          })

          if (!proxyResponse.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errText = await proxyResponse.text().catch(() => proxyResponse.statusText) // silent-catch-ok — fallback to statusText
            sendError(res, proxyResponse.status, `yt-dlp server: ${errText}`, 'ytdlp-fetch-error')
            return
          }

          const data = await proxyResponse.text()
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
        } catch (error) { // silent-catch-ok — server-side middleware returns JSON error to client
          handleProxyError(res, error, 'ytdlp/subtitles')
        }
      })

      // -----------------------------------------------------------------------
      // POST /api/youtube/ytdlp/metadata — yt-dlp metadata enrichment
      // -----------------------------------------------------------------------
      server.middlewares.use('/api/youtube/ytdlp/metadata', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          const rawBody = await readBody(req)
          const { videoId, serverUrl } = JSON.parse(rawBody) as {
            videoId?: string
            serverUrl?: string
          }

          if (!isValidVideoId(videoId)) {
            sendError(res, 400, 'Invalid or missing videoId', 'invalid-video-id')
            return
          }

          const normalizedUrl = validateServerUrl(serverUrl, res)
          if (!normalizedUrl) return

          // Proxy to user's yt-dlp server
          const proxyResponse = await fetch(`${normalizedUrl}/metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId }),
            signal: AbortSignal.timeout(15_000),
          })

          if (!proxyResponse.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errText = await proxyResponse.text().catch(() => proxyResponse.statusText) // silent-catch-ok — fallback to statusText
            sendError(res, proxyResponse.status, `yt-dlp server: ${errText}`, 'ytdlp-metadata-error')
            return
          }

          const data = await proxyResponse.text()
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
        } catch (error) { // silent-catch-ok — server-side middleware returns JSON error to client
          handleProxyError(res, error, 'ytdlp/metadata')
        }
      })

      // -----------------------------------------------------------------------
      // POST /api/youtube/whisper/transcribe — Tier 3: Whisper transcription
      //
      // Smart pipeline: downloads YouTube audio via yt-dlp, sends to any
      // OpenAI-compatible Whisper API (Speaches, faster-whisper-server, etc.),
      // returns VTT transcript.
      // -----------------------------------------------------------------------
      server.middlewares.use('/api/youtube/whisper/transcribe', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        let tempDir: string | undefined
        try {
          const rawBody = await readBody(req)
          const { videoId, serverUrl, lang } = JSON.parse(rawBody) as {
            videoId?: string
            serverUrl?: string
            lang?: string
          }

          if (!isValidVideoId(videoId)) {
            sendError(res, 400, 'Invalid or missing videoId', 'invalid-video-id')
            return
          }

          const normalizedUrl = validateServerUrl(serverUrl, res)
          if (!normalizedUrl) return

          // 1. Resolve Whisper model (cached per server URL)
          const modelId = await resolveWhisperModel(normalizedUrl)
          if (!modelId) {
            sendError(res, 502, 'Cannot detect Whisper model. Is the server running?', 'whisper-model-detection-failed')
            return
          }

          // 2. Download YouTube audio via yt-dlp
          tempDir = await mkdtemp(join(tmpdir(), 'knowlune-whisper-'))
          const audioPath = join(tempDir, 'audio.opus')
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

          try {
            await execFile('yt-dlp', [
              '-x',
              '--audio-format', 'opus',
              '--max-filesize', '100M',
              '--no-playlist',
              '--no-warnings',
              '-o', audioPath,
              videoUrl,
            ], { timeout: 30_000 })
          } catch (dlError) {
            const err = dlError as Error & { code?: string }
            if (err.code === 'ENOENT') {
              sendError(res, 501, 'yt-dlp not found. Install it: https://github.com/yt-dlp/yt-dlp#installation', 'ytdlp-not-installed')
              return
            }
            console.error('[whisper/transcribe] yt-dlp download failed:', err.message)
            sendError(res, 502, `Audio download failed: ${err.message}`, 'audio-download-failed')
            return
          }

          // Verify audio file exists
          const audioStat = await stat(audioPath).catch(() => null)
          if (!audioStat || audioStat.size === 0) {
            sendError(res, 502, 'yt-dlp produced no audio output', 'audio-download-failed')
            return
          }

          // 3. Send audio to Whisper API (OpenAI-compatible multipart form)
          const audioData = await readFile(audioPath)
          const formData = new FormData()
          formData.append('file', new Blob([new Uint8Array(audioData)], { type: 'audio/ogg' }), 'audio.opus')
          formData.append('model', modelId)
          formData.append('response_format', 'vtt')
          if (lang) {
            formData.append('language', lang)
          }

          const whisperResponse = await fetch(`${normalizedUrl}/v1/audio/transcriptions`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(120_000),
          })

          if (!whisperResponse.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errText = await whisperResponse.text().catch(() => whisperResponse.statusText) // silent-catch-ok — fallback to statusText
            sendError(res, 502, `Whisper server: ${errText}`, 'whisper-transcription-failed')
            return
          }

          // 4. Return VTT response (matches WhisperTranscribeResponse interface)
          const vtt = await whisperResponse.text()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            vtt,
            language: lang || 'en',
          }))
        } catch (error) { // silent-catch-ok — server-side middleware returns JSON error to client
          handleProxyError(res, error, 'whisper/transcribe')
        } finally {
          // Cleanup temp directory
          if (tempDir) {
            rm(tempDir, { recursive: true, force: true }).catch(() => {})
          }
        }
      })
      // -----------------------------------------------------------------------
      // POST /api/audio/transcribe — Generic audio transcription
      //
      // Accepts multipart form with audio file + serverUrl, forwards to any
      // OpenAI-compatible Whisper API. Enables voice notes, local video
      // transcription, and audiobook chapter extraction.
      // -----------------------------------------------------------------------
      server.middlewares.use('/api/audio/transcribe', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          // Parse multipart form data manually (Node.js IncomingMessage)
          const contentType = req.headers['content-type'] || ''
          if (!contentType.includes('multipart/form-data')) {
            sendError(res, 400, 'Expected multipart/form-data', 'invalid-content-type')
            return
          }

          // Read raw body as Buffer for multipart parsing
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(chunk as Buffer)
            // 25MB size limit (OpenAI API standard)
            const totalSize = chunks.reduce((sum, c) => sum + c.length, 0)
            if (totalSize > 25 * 1024 * 1024) {
              sendError(res, 413, 'File too large. Maximum 25MB.', 'file-too-large')
              return
            }
          }
          const rawBuffer = Buffer.concat(chunks)

          // Extract boundary from content-type header
          const boundaryMatch = contentType.match(/boundary=(.+)/)
          if (!boundaryMatch) {
            sendError(res, 400, 'Missing multipart boundary', 'invalid-content-type')
            return
          }

          // Parse fields from multipart body
          const { fields, fileData, fileName, fileMimeType } = parseMultipart(rawBuffer, boundaryMatch[1])

          if (!fileData || fileData.length === 0) {
            sendError(res, 400, 'No audio file provided', 'missing-file')
            return
          }

          const serverUrl = fields['serverUrl']
          if (!serverUrl) {
            sendError(res, 400, 'serverUrl field is required', 'invalid-request')
            return
          }

          const normalizedUrl = serverUrl.replace(/\/+$/, '')
          if (!isAllowedProxyUrl(normalizedUrl)) {
            sendError(res, 403, 'Server URL rejected by SSRF validation', 'ssrf-blocked')
            return
          }

          // Resolve model
          const modelId = await resolveWhisperModel(normalizedUrl)
          if (!modelId) {
            sendError(res, 502, 'Cannot detect Whisper model. Is the server running?', 'whisper-model-detection-failed')
            return
          }

          // Forward to Whisper API
          const formData = new FormData()
          formData.append('file', new Blob([new Uint8Array(fileData)], { type: fileMimeType || 'audio/mpeg' }), fileName || 'audio.mp3')
          formData.append('model', modelId)
          formData.append('response_format', 'vtt')
          if (fields['lang']) {
            formData.append('language', fields['lang'])
          }

          const whisperResponse = await fetch(`${normalizedUrl}/v1/audio/transcriptions`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(120_000),
          })

          if (!whisperResponse.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errText = await whisperResponse.text().catch(() => whisperResponse.statusText) // silent-catch-ok — fallback to statusText
            sendError(res, 502, `Whisper server: ${errText}`, 'whisper-transcription-failed')
            return
          }

          const vtt = await whisperResponse.text()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            vtt,
            language: fields['lang'] || 'en',
          }))
        } catch (error) { // silent-catch-ok — server-side middleware returns JSON error to client
          handleProxyError(res, error, 'audio/transcribe')
        }
      })

      // -----------------------------------------------------------------------
      // POST /api/whisper/health — Whisper server health check
      //
      // Validates server reachability by listing available models.
      // Used by SelfHostedWhisperProvider.isAvailable().
      // -----------------------------------------------------------------------
      server.middlewares.use('/api/whisper/health', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          const rawBody = await readBody(req)
          const { serverUrl } = JSON.parse(rawBody) as { serverUrl?: string }

          const normalizedUrl = validateServerUrl(serverUrl, res)
          if (!normalizedUrl) return

          const response = await fetch(`${normalizedUrl}/v1/models`, {
            signal: AbortSignal.timeout(5_000),
          })

          if (!response.ok) {
            sendError(res, 502, 'Whisper server returned non-OK status', 'whisper-health-failed')
            return
          }

          const data = (await response.json()) as { data?: Array<{ id: string }> }
          const models = (data.data || []).map(m => m.id)

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, models }))
        } catch (error) { // silent-catch-ok — server-side middleware returns JSON error to client
          handleProxyError(res, error, 'whisper/health')
        }
      })

      // -----------------------------------------------------------------------
      // POST /api/whisper/transcribe — Cloud Whisper transcription (Groq/OpenAI)
      //
      // CORS bypass proxy: accepts multipart form with audio file + cloud
      // provider credentials, forwards to Groq or OpenAI Whisper API.
      // API key comes from the client per-request (encrypted in localStorage).
      // -----------------------------------------------------------------------
      server.middlewares.use('/api/whisper/transcribe', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          const contentType = req.headers['content-type'] || ''
          if (!contentType.includes('multipart/form-data')) {
            sendError(res, 400, 'Expected multipart/form-data', 'invalid-content-type')
            return
          }

          // Read raw body as Buffer for multipart parsing
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(chunk as Buffer)
            const totalSize = chunks.reduce((sum, c) => sum + c.length, 0)
            if (totalSize > 25 * 1024 * 1024) {
              sendError(res, 413, 'File too large. Maximum 25MB.', 'file-too-large')
              return
            }
          }
          const rawBuffer = Buffer.concat(chunks)

          const boundaryMatch = contentType.match(/boundary=(.+)/)
          if (!boundaryMatch) {
            sendError(res, 400, 'Missing multipart boundary', 'invalid-content-type')
            return
          }

          const { fields, fileData, fileName, fileMimeType } = parseMultipart(rawBuffer, boundaryMatch[1])

          if (!fileData || fileData.length === 0) {
            sendError(res, 400, 'No audio file provided', 'missing-file')
            return
          }

          const provider = fields['provider']
          if (provider !== 'groq' && provider !== 'openai') {
            sendError(res, 400, 'Invalid provider. Must be "groq" or "openai".', 'invalid-provider')
            return
          }

          const apiKey = fields['apiKey']
          if (!apiKey) {
            sendError(res, 400, 'apiKey field is required', 'missing-api-key')
            return
          }

          const model = fields['model']
          if (!model) {
            sendError(res, 400, 'model field is required', 'missing-model')
            return
          }

          const responseFormat = fields['response_format'] || 'vtt'
          const language = fields['language']

          // Hardcoded cloud API URLs (not user input, no SSRF risk)
          const cloudUrls: Record<string, string> = {
            groq: 'https://api.groq.com/openai/v1/audio/transcriptions',
            openai: 'https://api.openai.com/v1/audio/transcriptions',
          }

          // Build new FormData for the cloud API
          const formData = new FormData()
          formData.append(
            'file',
            new Blob([new Uint8Array(fileData)], { type: fileMimeType || 'audio/webm' }),
            fileName || 'audio.webm'
          )
          formData.append('model', model)
          formData.append('response_format', responseFormat)
          if (language) {
            formData.append('language', language)
          }

          const cloudResponse = await fetch(cloudUrls[provider], {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
            signal: AbortSignal.timeout(120_000),
          })

          if (!cloudResponse.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errText = await cloudResponse.text().catch(() => cloudResponse.statusText) // silent-catch-ok -- fallback to statusText
            sendError(res, cloudResponse.status, `${provider} API: ${errText}`, 'cloud-transcription-failed')
            return
          }

          const vtt = await cloudResponse.text()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            vtt,
            language: language || 'en',
          }))
        } catch (error) { // silent-catch-ok -- server-side middleware returns JSON error to client
          handleProxyError(res, error, 'whisper/cloud-transcribe')
        }
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the Whisper model ID from an OpenAI-compatible server.
 * Caches results per server URL to avoid repeated requests.
 */
async function resolveWhisperModel(serverUrl: string): Promise<string | null> {
  const cached = whisperModelCache.get(serverUrl)
  if (cached) return cached

  try {
    const response = await fetch(`${serverUrl}/v1/models`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return null

    const data = (await response.json()) as { data?: Array<{ id: string }> }
    const modelId = data.data?.[0]?.id
    if (modelId) {
      whisperModelCache.set(serverUrl, modelId)
    }
    return modelId || null
  } catch {
    return null
  }
}

/**
 * Minimal multipart form parser for Node.js Buffer.
 * Extracts text fields and a single file upload.
 */
function parseMultipart(buffer: Buffer, boundary: string): {
  fields: Record<string, string>
  fileData: Buffer | null
  fileName: string | null
  fileMimeType: string | null
} {
  const fields: Record<string, string> = {}
  let fileData: Buffer | null = null
  let fileName: string | null = null
  let fileMimeType: string | null = null

  const boundaryBuf = Buffer.from(`--${boundary}`)
  const parts: Buffer[] = []

  // Split buffer by boundary
  let start = 0
  while (true) {
    const idx = buffer.indexOf(boundaryBuf, start)
    if (idx === -1) break
    if (start > 0) {
      // Strip trailing \r\n before boundary
      const end = idx - 2 >= start ? idx - 2 : idx
      parts.push(buffer.subarray(start, end))
    }
    start = idx + boundaryBuf.length + 2 // skip boundary + \r\n
  }

  for (const part of parts) {
    // Find header/body separator (\r\n\r\n)
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue

    const headers = part.subarray(0, headerEnd).toString()
    const body = part.subarray(headerEnd + 4)

    const nameMatch = headers.match(/name="([^"]+)"/)
    if (!nameMatch) continue

    const filenameMatch = headers.match(/filename="([^"]+)"/)
    if (filenameMatch) {
      // This is a file field
      fileData = body
      fileName = filenameMatch[1]
      const typeMatch = headers.match(/Content-Type:\s*(.+)/i)
      fileMimeType = typeMatch ? typeMatch[1].trim() : null
    } else {
      // This is a text field
      fields[nameMatch[1]] = body.toString().trim()
    }
  }

  return { fields, fileData, fileName, fileMimeType }
}
