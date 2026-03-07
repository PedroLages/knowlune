/// <reference types="vitest/config" />
/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
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
        const filePath = path.join(COURSES_ROOT, decodedPath);
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
  }), tailwindcss(), serveLocalMedia()],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src')
    }
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
      output: {
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
        },
      },
    },
  },
});