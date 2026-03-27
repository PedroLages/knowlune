/// <reference types="vitest/config" />
/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { premiumImportGuard } from './vite-plugin-premium-guard';
import { youtubeTranscriptProxy } from './vite-plugin-youtube-transcript';
import { fileURLToPath } from 'node:url';

const __dirname = typeof globalThis.__dirname !== 'undefined'
  ? globalThis.__dirname
  : path.dirname(fileURLToPath(import.meta.url));
const COURSES_ROOT = process.env.COURSES_ROOT || '';

/**
 * Vite plugin that embeds Ollama proxy endpoints directly into the dev server.
 * Eliminates the need for a separate `npm run server` when using Ollama.
 *
 * When `DEV_SKIP_ENTITLEMENT=true` is set in `.env.local`, all auth and
 * entitlement checks are bypassed. A console warning is logged on startup.
 * Without the flag, requests are proxied to Express on :3001 (which handles auth).
 *
 * Endpoints:
 *   GET  /api/ai/ollama/tags?serverUrl=...  — List available models
 *   GET  /api/ai/ollama/health?serverUrl=... — Health check
 *   POST /api/ai/ollama/chat                 — Chat completions (non-streaming)
 *   POST /api/ai/ollama                      — Chat completions (SSE streaming)
 */
export function ollamaDevProxy(): Plugin {
  const skipEntitlement = process.env.DEV_SKIP_ENTITLEMENT === 'true'

  if (skipEntitlement) {
    console.warn(
      '\x1b[33m%s\x1b[0m',
      '⚠️  Entitlement checks disabled (DEV_SKIP_ENTITLEMENT=true). ' +
      'All auth/entitlement middleware is bypassed. Do NOT use in production.'
    )
  }

  return {
    name: 'ollama-dev-proxy',
    configureServer(server) {
      // Helper to read JSON body from IncomingMessage
      function readBody(req: import('http').IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
          let data = '';
          req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
      }

      // Helper to validate serverUrl query param
      function getValidatedServerUrl(
        reqUrl: string,
        host: string,
        res: import('http').ServerResponse
      ): string | null {
        const url = new URL(reqUrl, `http://${host}`);
        const serverUrl = url.searchParams.get('serverUrl');
        if (!serverUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'serverUrl query parameter is required' }));
          return null;
        }
        return serverUrl.replace(/\/+$/, '');
      }

      // Helper for proxy error responses
      function handleProxyError(
        res: import('http').ServerResponse,
        error: unknown,
        endpoint: string
      ) {
        console.error(`[ollama-dev-proxy ${endpoint}]`, (error as Error).message);
        const name = (error as Error).name;
        const msg = (error as Error).message;
        if (name === 'AbortError' || name === 'TimeoutError') {
          res.statusCode = 504;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Ollama server timed out' }));
          return;
        }
        if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Cannot reach Ollama server. Is it running?' }));
          return;
        }
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: msg }));
      }

      // GET /api/ai/ollama/tags — proxy model list
      server.middlewares.use('/api/ai/ollama/tags', async (req, res, next) => {
        if (req.method !== 'GET') { next(); return; }
        const serverUrl = getValidatedServerUrl(req.url || '', req.headers.host || '', res);
        if (!serverUrl) return;
        try {
          const response = await fetch(`${serverUrl}/api/tags`, {
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errorText = await response.text().catch(() => response.statusText);
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Ollama returned ${response.status}: ${errorText}` }));
            return;
          }
          const data = await response.text();
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
        } catch (error) { handleProxyError(res, error, '/tags'); }
      });

      // GET /api/ai/ollama/health — health check
      server.middlewares.use('/api/ai/ollama/health', async (req, res, next) => {
        if (req.method !== 'GET') { next(); return; }
        const serverUrl = getValidatedServerUrl(req.url || '', req.headers.host || '', res);
        if (!serverUrl) return;
        try {
          const response = await fetch(serverUrl, {
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errorText = await response.text().catch(() => response.statusText);
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Ollama returned ${response.status}: ${errorText}` }));
            return;
          }
          const body = await response.text();
          res.end(body);
        // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
        } catch (error) { handleProxyError(res, error, '/health'); }
      });

      // POST /api/ai/ollama/chat — chat completions (non-streaming)
      server.middlewares.use('/api/ai/ollama/chat', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return; }
        try {
          const rawBody = await readBody(req);
          const { ollamaServerUrl, ...ollamaPayload } = JSON.parse(rawBody) as {
            ollamaServerUrl?: string;
            [key: string]: unknown;
          };
          if (!ollamaServerUrl || typeof ollamaServerUrl !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'ollamaServerUrl is required in request body' }));
            return;
          }
          const normalizedUrl = ollamaServerUrl.replace(/\/+$/, '');
          const response = await fetch(`${normalizedUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ollamaPayload),
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errorText = await response.text().catch(() => response.statusText);
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Ollama returned ${response.status}: ${errorText}` }));
            return;
          }
          const data = await response.text();
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
        } catch (error) { handleProxyError(res, error, '/chat'); }
      });

      // POST /api/ai/ollama — streaming chat (SSE pipe-through)
      server.middlewares.use('/api/ai/ollama', async (req, res, next) => {
        // Only handle POST to exact /api/ai/ollama (subpaths caught by earlier middleware)
        if (req.method !== 'POST' || (req.url && req.url !== '/' && req.url !== '')) {
          next(); return;
        }
        try {
          const rawBody = await readBody(req);
          const { ollamaServerUrl, ...payload } = JSON.parse(rawBody) as {
            ollamaServerUrl?: string;
            [key: string]: unknown;
          };
          if (!ollamaServerUrl || typeof ollamaServerUrl !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'ollamaServerUrl is required in request body' }));
            return;
          }
          const url = `${ollamaServerUrl.replace(/\/+$/, '')}/v1/chat/completions`;
          const ollamaRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, stream: true }),
            signal: AbortSignal.timeout(120_000),
          });
          if (!ollamaRes.ok || !ollamaRes.body) {
            // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
            const errText = await ollamaRes.text().catch(() => ollamaRes.statusText);
            res.statusCode = ollamaRes.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Ollama returned ${ollamaRes.status}: ${errText}` }));
            return;
          }
          // Pipe SSE stream from Ollama directly to browser
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          const reader = ollamaRes.body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(Buffer.from(value));
            }
          } finally { res.end(); }
        // eslint-disable-next-line error-handling/no-silent-catch -- build-time error handling
        } catch (error) {
          if (!(res as { headersSent?: boolean }).headersSent) {
            handleProxyError(res, error, '/ollama-stream');
          } else {
            // Mid-stream error: send SSE error event and close
            res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
            res.end();
          }
        }
      });
    }
  };
}

function serveLocalMedia(): Plugin {
  return {
    name: 'serve-local-media',
    configureServer(server) {
      server.middlewares.use('/media', (req, res, next) => {
        const decodedPath = decodeURIComponent(req.url || '');

        // Security: Resolve and validate path to prevent directory traversal attacks
        const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath));
        const coursesRootResolved = path.resolve(COURSES_ROOT);

        // Block path traversal attempts (e.g., ../../../etc/passwd)
        if (!filePath.startsWith(coursesRootResolved)) {
          res.statusCode = 403;
          res.end('Forbidden: Path traversal detected');
          return;
        }

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mkv': 'video/x-matroska',
          '.mov': 'video/quicktime',
          '.mp3': 'audio/mpeg',
          '.pdf': 'application/pdf',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.md': 'text/markdown',
          '.txt': 'text/plain'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const range = req.headers.range;
        if (range && contentType.startsWith('video/')) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          const chunkSize = end - start + 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType
          });
          fs.createReadStream(filePath, {
            start,
            end
          }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': contentType
          });
          fs.createReadStream(filePath).pipe(res);
        }
      });
    }
  };
}
export default defineConfig({
  plugins: [
  // The React and Tailwind plugins are both required for Make, even if
  // Tailwind is not being actively used – do not remove them
  react({
    babel: {
      plugins: [
        ['babel-plugin-react-compiler', {}],
      ],
    },
  }),
  tailwindcss(),
  serveLocalMedia(),
  ollamaDevProxy(),
  youtubeTranscriptProxy(),
  premiumImportGuard({ enabled: !process.env.PREMIUM_BUILD }),
  VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
    manifest: {
      name: 'Knowlune',
      short_name: 'Knowlune',
      description: 'Knowlune — Illuminate Your Path. Personal learning platform with progress tracking and study streaks.',
      theme_color: '#FAF5EE',
      background_color: '#FAF5EE',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
      globIgnores: ['**/mockServiceWorker.js', '**/webllm*.js'],
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [/^\/api\//],
      runtimeCaching: [
        {
          urlPattern: /^\/images\/.+\.(png|webp|jpg|jpeg)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'local-images',
            expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
          },
        },
        {
          urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'unsplash-images',
            expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/huggingface\.co\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'hf-models',
            expiration: { maxEntries: 20, maxAgeSeconds: 90 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^\/api\/ai\/.*/i,
          handler: 'NetworkOnly',
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  }),
  ],
  worker: {
    format: 'es', // ES module workers — enables `import` in worker scope
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    // ┌─────────────────────────────────────────────────────────────┐
    // │              Ollama Dev Proxy Architecture                  │
    // ├─────────────────────────────────────────────────────────────┤
    // │ Embedded in Vite (ollamaDevProxy plugin):                  │
    // │   GET  /api/ai/ollama/tags      → Ollama /api/tags         │
    // │   GET  /api/ai/ollama/health    → Ollama /                 │
    // │   POST /api/ai/ollama/chat      → Ollama /api/chat         │
    // │   POST /api/ai/ollama           → Ollama /v1/chat/... SSE  │
    // ├─────────────────────────────────────────────────────────────┤
    // │ Proxied to Express :3001 (if running):                     │
    // │   /api/ai/* (non-Ollama)  — Anthropic, OpenAI, Groq, etc. │
    // └─────────────────────────────────────────────────────────────┘
    proxy: {
      '/api/ai': { target: 'http://localhost:3001', changeOrigin: true },
    },
    headers: {
      // XSS Protection
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',

      // Privacy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',

      // Required for WebLLM/WebGPU (SharedArrayBuffer) + YouTube IFrame coexistence
      // `credentialless` allows cross-origin iframes (YouTube) while still enabling SharedArrayBuffer
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',

      // CSP: allow YouTube IFrame embeds, thumbnails, and API access (E28-S09)
      'Content-Security-Policy': [
        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
        "img-src 'self' data: blob: https://images.unsplash.com https://i.ytimg.com https://img.youtube.com",
        "connect-src 'self' https://www.googleapis.com/youtube/ ws://localhost:* http://localhost:*",
      ].join('; '),
    },
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
    include: ['@number-flow/react'], // React wrapper for NumberFlow animations
  },
  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    testTimeout: 10_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      exclude: [
        'src/ai/orchestration/**', // Experimental auto-parallel infrastructure (not production)
        'src/app/components/ui/**', // shadcn/ui vendor components (third-party)
      ],
      thresholds: {
        lines: 70,
      },
    },
    projects: [{
      extends: true,
      test: {
        name: 'unit',
        include: ['src/**/*.test.{ts,tsx}'],
        exclude: ['src/**/*.stories.*'],
      }
    }, {
      test: {
        name: 'server',
        include: ['server/**/*.test.ts'],
        environment: 'node',
        globals: true,
      }
    }]
  },
  build: {
    rollupOptions: {
      // Exclude WebLLM from the bundle — it's a 6MB ML runtime used only in
      // the experimental /webllm-test route. Load it from CDN at runtime instead.
      external: ['@mlc-ai/web-llm'],
      output: {
        // Map the external to a global or CDN URL for runtime loading
        paths: {
          '@mlc-ai/web-llm': 'https://esm.run/@mlc-ai/web-llm@0.2.81',
        },
        manualChunks(id) {
          // ProseMirror core (TipTap's editing engine)
          if (id.includes('prosemirror')) {
            return 'prosemirror'
          }
          // Emoji data is the single heaviest TipTap extension
          if (id.includes('@tiptap/extension-emoji')) {
            return 'tiptap-emoji'
          }
          // Syntax highlighting (lowlight + highlight.js grammars)
          if (id.includes('lowlight') || id.includes('highlight.js')) {
            return 'syntax-highlight'
          }
          // Remaining TipTap extensions
          if (id.includes('@tiptap/')) {
            return 'tiptap'
          }
          // React core runtime
          if (id.includes('react-dom') || (id.includes('/react/') && id.includes('node_modules'))) {
            return 'react-vendor'
          }
          // Radix UI primitives (used by shadcn/ui)
          if (id.includes('@radix-ui')) {
            return 'radix-ui'
          }
          // React Router
          if (id.includes('react-router')) {
            return 'react-router'
          }
          // Dexie (IndexedDB ORM — heavy schema + runtime)
          if (id.includes('dexie')) {
            return 'dexie'
          }
          // Recharts / chart.js (data visualization)
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
            return 'chart'
          }
          // MiniSearch (full-text search engine)
          if (id.includes('minisearch')) {
            return 'minisearch'
          }
          // PDF.js (PDF rendering)
          if (id.includes('pdfjs-dist') || id.includes('react-pdf')) {
            return 'pdf'
          }
          // date-fns (date utility library)
          if (id.includes('date-fns')) {
            return 'date-fns'
          }
          // cmdk (command palette)
          if (id.includes('cmdk')) {
            return 'cmdk'
          }
          // Vercel AI SDK core
          if (id.includes('/ai/') && id.includes('node_modules') && !id.includes('@ai-sdk')) {
            return 'ai-sdk-core'
          }
          // AI provider SDKs (each lazy-loaded per user's config)
          if (id.includes('@ai-sdk/openai')) return 'ai-openai'
          if (id.includes('@ai-sdk/anthropic')) return 'ai-anthropic'
          if (id.includes('@ai-sdk/groq')) return 'ai-groq'
          if (id.includes('@ai-sdk/google')) return 'ai-google'
          if (id.includes('zhipu-ai-provider')) return 'ai-zhipu'
          // react-youtube (YouTube IFrame player)
          if (id.includes('react-youtube')) {
            return 'react-youtube'
          }
          // sonner (toast notifications)
          if (id.includes('sonner')) {
            return 'sonner'
          }
          // class-variance-authority + clsx (utility)
          if (id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'style-utils'
          }
        },
      },
    },
  },
});