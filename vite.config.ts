/// <reference types="vitest/config" />
/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const __dirname = typeof globalThis.__dirname !== 'undefined'
  ? globalThis.__dirname
  : path.dirname(fileURLToPath(import.meta.url));
const COURSES_ROOT = '/Volumes/SSD/GFX/Chase Hughes - The Operative Kit';
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
  VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
    manifest: {
      name: 'Knowlune',
      short_name: 'Knowlune',
      description: 'Personal learning platform with progress tracking and study streaks',
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
    proxy: {
      '/api/ai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    headers: {
      // XSS Protection
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',

      // Privacy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',

      // Required for WebLLM/WebGPU (SharedArrayBuffer)
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
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
    hookTimeout: 15_000,
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