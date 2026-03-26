/**
 * Vite plugin that proxies YouTube transcript requests through the dev server.
 *
 * `youtube-transcript` must run server-side because YouTube blocks browser
 * CORS requests to its transcript endpoints. This plugin follows the same
 * pattern as `ollamaDevProxy()` in `vite.config.ts`.
 *
 * Endpoint:
 *   POST /api/youtube/transcript
 *   Body: { videoId: string; lang?: string }
 *   Response: { cues: TranscriptCue[]; language: string } | { error: string; code: string }
 */
import type { Plugin } from 'vite'

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

      server.middlewares.use('/api/youtube/transcript', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          const rawBody = await readBody(req)
          const { videoId, lang } = JSON.parse(rawBody) as {
            videoId?: string
            lang?: string
          }

          if (!videoId || typeof videoId !== 'string') {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'videoId is required', code: 'invalid-request' }))
            return
          }

          // Validate videoId format (11 alphanumeric chars + hyphens/underscores)
          if (!/^[\w-]{11}$/.test(videoId)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid video ID format', code: 'invalid-video-id' }))
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

          res.statusCode = statusCode
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message, code }))
        }
      })
    }
  }
}
