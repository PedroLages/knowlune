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
 *
 * Tier 2 & 3 proxy to user-configured servers with SSRF validation.
 */
import type { Plugin } from 'vite'
import { isAllowedProxyUrl } from './src/lib/ssrfProtection'

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
      // -----------------------------------------------------------------------
      server.middlewares.use('/api/youtube/whisper/transcribe', async (req, res, next) => {
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

          // Proxy to user's Whisper server — longer timeout for transcription
          const proxyResponse = await fetch(`${normalizedUrl}/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, lang }),
            signal: AbortSignal.timeout(60_000),
          })

          if (!proxyResponse.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errText = await proxyResponse.text().catch(() => proxyResponse.statusText) // silent-catch-ok — fallback to statusText
            sendError(res, proxyResponse.status, `Whisper server: ${errText}`, 'whisper-fetch-error')
            return
          }

          const data = await proxyResponse.text()
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
        } catch (error) { // silent-catch-ok — server-side middleware returns JSON error to client
          handleProxyError(res, error, 'whisper/transcribe')
        }
      })
    }
  }
}
