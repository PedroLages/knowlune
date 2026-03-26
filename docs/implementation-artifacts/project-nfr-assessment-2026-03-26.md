# Knowlune Project NFR Assessment

**Date:** 2026-03-26
**Scope:** Full project (8 epics, 40 stories)
**Assessor:** Claude Opus 4.6 (automated)

---

## 1. Performance

**Rating: PASS with minor concerns**

### Bundle Size
- **Total dist:** 79 MB (includes PWA precache of 16.8 MB across 269 entries)
- **Largest JS chunks (gzipped):**
  - `index-BYACUWur.js`: 629 KB / 180 KB gzip (main app bundle)
  - `tiptap-emoji-BZnsdF5h.js`: 468 KB / 59 KB gzip (emoji data)
  - `pdf-TnLvfXsN.js`: 461 KB / 136 KB gzip (PDF.js renderer)
  - `chart-C7XeHwjG.js`: 422 KB / 121 KB gzip (Recharts/D3)
  - `jspdf.es.min`: 391 KB / 129 KB gzip
  - `tiptap-_p5Qc0Ur.js`: 356 KB / 111 KB gzip
  - `ai-zhipu-B5evk791.js`: 300 KB / 72 KB gzip
- **CSS:** 231 KB / 35 KB gzip (single bundle)
- **Vite warning:** 1 chunk exceeds 500 KB after minification (`index-BYACUWur.js` at 629 KB)

### Code Splitting
- **Excellent route-level splitting:** All 35+ pages use `React.lazy()` with `Suspense` boundaries
- **Manual chunks configured:** 18 vendor chunk strategies in `vite.config.ts` (React, Radix, TipTap, ProseMirror, PDF.js, date-fns, AI SDKs, etc.)
- **WebLLM excluded from bundle** (loaded from CDN at runtime) -- smart choice for a 6 MB dependency
- **166 JS chunks** in dist -- granular splitting

### Memoization
- **137 occurrences** of `useMemo`/`useCallback`/`React.memo` across 20+ page components
- React Compiler enabled (`babel-plugin-react-compiler`) -- handles automatic memoization
- Good coverage of expensive computations in data-heavy pages (Reports, Overview, Notes)

### Rate Limiting
- YouTube API quota tracker: 500 units/day budget (conservative vs 10,000 limit), warning at 400 units
- YouTube rate limiter exists (`youtubeRateLimiter.ts`)
- Ollama proxy: AbortSignal timeouts (10-120s depending on endpoint)
- Debounce/throttle patterns in search, video player, quiz timer

### IndexedDB Patterns
- **Compound indexes** used appropriately: `[courseId+videoId]`, `[courseId+itemId]`, `[quizId+completedAt]`
- **Multi-entry indexes** for tags (`*tags`)
- **287+ database operations** across the codebase with appropriate indexing
- `persistWithRetry` utility with exponential backoff (3 retries, up to 8s delay)
- `quotaResilientStorage` for localStorage with quota exceeded handling

### Web Vitals
- `performanceMonitoring.ts` tracks all 5 Core Web Vitals (LCP, CLS, FCP, TTFB, INP)
- In-memory buffer capped at 100 entries (FIFO)

### Concerns
- **Main bundle at 629 KB:** The `index-BYACUWur.js` chunk could benefit from further splitting. Static imports of `db/index.ts` and `useCourseStore.ts` (Vite warnings) prevent these from being lazy-loaded despite dynamic import attempts in `main.tsx`
- **PWA precache size (16.8 MB):** Large initial cache footprint; consider excluding rarely-used chunks from precache

---

## 2. Security

**Rating: PASS**

### CSP Headers
Content Security Policy configured in `vite.config.ts`:
- `frame-src`: restricted to self + YouTube domains
- `img-src`: self + data/blob + Unsplash + YouTube thumbnails
- `connect-src`: self + YouTube API + local dev servers
- Missing: `script-src` directive (defaults to browser default, acceptable for SPA)

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Cross-Origin-Embedder-Policy: credentialless` (for SharedArrayBuffer + YouTube coexistence)
- `Cross-Origin-Opener-Policy: same-origin`

### SSRF Protection
- Dedicated `ssrfProtection.ts` module with URL validation
- Blocks loopback (localhost, 127.x.x.x, ::1, 0.0.0.0)
- Blocks cloud metadata (169.254.x.x)
- Protocol restricted to HTTP/HTTPS only
- Allows private LAN (192.168.x.x, 10.x.x.x) for home server use case
- Has unit tests (`ssrfProtection.test.ts`)

### Path Traversal Protection
- `serveLocalMedia()` plugin validates resolved paths against `COURSES_ROOT`
- Blocks `../` traversal attempts with 403 response
- Has dedicated test (`pathTraversal.test.ts`)

### API Key Storage
- AES-GCM 256-bit encryption via Web Crypto API (`crypto.ts`)
- Session-scoped keys (regenerated on tab close/refresh)
- Random IV per encryption operation
- Keys never persisted to disk
- Has unit tests (`crypto.test.ts`)

### Input Sanitization
- DOMPurify used across 21 files for HTML sanitization
- `sanitizeFilename` for export service
- `extractTextFromHtml` for safe text extraction
- Only 1 file uses `dangerouslySetInnerHTML` (shadcn `chart.tsx` -- vendor component, acceptable)

### Concerns
- None significant. Security posture is strong for a client-side application.

---

## 3. Accessibility

**Rating: PASS with minor concerns**

### ARIA Support
- **283+ ARIA attribute occurrences** across 30+ components
- `aria-label`, `aria-describedby`, `aria-live`, `role`, `aria-hidden` all used
- Page loader has `role="status"` with `aria-busy="true"` and `aria-label="Loading page"`
- Error boundary SVG uses `aria-hidden="true"`

### Keyboard Navigation
- **37+ keyboard interaction patterns** (onKeyDown, tabIndex, focus-visible, sr-only)
- Radix UI primitives (136 KB chunk) provide built-in keyboard navigation for all interactive components
- `focus:ring-2 focus:ring-brand focus:ring-offset-2` pattern used consistently
- `sr-only` class used for screen-reader-only content

### Design Token System
- Color contrast enforced via design tokens (not hardcoded colors)
- ESLint rule `design-tokens/no-hardcoded-colors` blocks violations at save-time
- Brand color contrast rules documented: separate `text-brand-soft-foreground` for dark mode WCAG compliance
- Lint passes clean (0 violations)

### Component Library
- 50+ shadcn/ui components built on Radix UI primitives
- Radix provides WCAG-compliant focus management, keyboard navigation, and ARIA patterns out of the box

### Concerns
- **Semantic HTML audit needed:** Could not verify comprehensive use of `<nav>`, `<main>`, `<section>`, `<article>` across all pages from automated analysis alone
- **Missing skip-to-content link:** No evidence of a skip navigation link for keyboard users

---

## 4. Reliability

**Rating: PASS**

### Error Handling
- **ErrorBoundary component** wraps the app with retry/reload actions and error logging via `reportError()`
- **68+ toast.error/toast.warning calls** across 30+ files providing user-visible error feedback
- ESLint rule `error-handling/no-silent-catch` prevents swallowed exceptions
- `toastHelpers.ts` provides centralized, consistent error messaging

### Offline Support
- **PWA with service worker** (VitePWA with Workbox)
  - `generateSW` mode with 269 precached entries
  - `CacheFirst` for local images (200 entries, 30 days)
  - `StaleWhileRevalidate` for Unsplash images (80 entries, 30 days)
  - `CacheFirst` for HuggingFace models (20 entries, 90 days)
  - `NetworkOnly` for API routes (correct -- no stale AI responses)
  - `navigateFallback: 'index.html'` for SPA routing
- **`useOnlineStatus` hook** for online/offline detection
- **IndexedDB as primary storage** (Dexie) -- works fully offline
- **`persistWithRetry`** handles transient IndexedDB failures with exponential backoff
- **`quotaResilientStorage`** handles localStorage quota exceeded gracefully

### Data Integrity
- 26 Dexie schema versions with proper upgrade migrations
- Compound primary keys for relationship tables
- Schema tests (`db/__tests__/schema.test.ts` with 116+ assertions)

### Graceful Degradation
- `DelayedFallback` component prevents loading flash
- Skeleton loading states for all lazy-loaded pages
- PWA update prompt (not auto-update -- user-controlled)

### Concerns
- None significant. Error handling and offline support are well-implemented.

---

## 5. Maintainability

**Rating: PASS**

### Code Organization
- **Clean separation:** Pages, components (UI/figma/domain), hooks, stores, lib, AI modules, DB layer
- **~285K lines** across the codebase (including tests)
- **50+ reusable UI components** via shadcn/ui
- **18 Zustand stores** for state management (well-separated domains)
- **Import alias** `@/` for clean imports

### Test Coverage
- **189 unit test files** (`src/**/*.test.{ts,tsx}`)
- **167 E2E spec files** (`tests/**/*.spec.ts`)
- **356 total test files** (unit + E2E)
- Coverage threshold: 70% lines (enforced in vitest config)
- Experimental and vendor code excluded from coverage (`src/ai/orchestration/**`, `src/app/components/ui/**`)
- 8 custom ESLint rules for test quality enforcement

### TypeScript Strictness
- **`strict: true`** enabled
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- **TypeScript compiles clean** (0 errors from `tsc --noEmit`)

### Automation & Quality Gates
- **13 automated enforcement mechanisms** across 3 stages (save/commit/review)
- 8 custom ESLint rules (design tokens, test patterns, async cleanup, imports, error handling)
- 2 git hooks (pre-review, pre-push)
- 3 review agents (design, code, test coverage)
- Pre-commit lint passes clean

### Documentation
- Comprehensive `CLAUDE.md` with architecture, conventions, and troubleshooting
- Modular `.claude/rules/` system with path-specific loading
- Story workflow documentation with quality gates
- Engineering patterns document
- Design token cheat sheet and enforcement strategy

### Concerns
- **Dynamic import warnings:** Vite reports that `db/index.ts`, `useCourseStore.ts`, and `noteSearch.ts` are both dynamically and statically imported, preventing effective code splitting. Refactoring static imports to lazy patterns would improve both maintainability and bundle performance.

---

## Summary

| Category | Rating | Key Strengths | Concerns |
|----------|--------|---------------|----------|
| **Performance** | PASS | Route-level code splitting, React Compiler, Web Vitals monitoring, rate limiting, indexed queries | Main bundle 629 KB, PWA precache 16.8 MB |
| **Security** | PASS | CSP, SSRF protection, AES-GCM encryption, DOMPurify, path traversal prevention, security headers | None significant |
| **Accessibility** | PASS | 283+ ARIA attributes, Radix UI primitives, design token enforcement, keyboard patterns | Missing skip-to-content link |
| **Reliability** | PASS | ErrorBoundary, PWA offline, IndexedDB with retry, quota-resilient storage, 68+ error toasts | None significant |
| **Maintainability** | PASS | TypeScript strict, 356 test files, 13 automation mechanisms, clean lint/typecheck, modular architecture | Static/dynamic import conflicts |

**OVERALL: PASS**

The application demonstrates mature engineering practices across all NFR categories. Security is the strongest area with defense-in-depth patterns. The primary optimization opportunity is further bundle splitting to reduce the main chunk below 500 KB.
