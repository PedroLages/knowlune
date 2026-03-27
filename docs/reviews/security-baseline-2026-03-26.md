# Security Baseline Audit - 2026-03-26

## 1. Content Security Policy (CSP)

The CSP is defined as a `<meta http-equiv>` tag in `index.html`. The Vite dev server also sets a supplementary CSP header.

### Production CSP Directives (index.html)

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Restricts all resource loading to same origin by default |
| `manifest-src` | `'self'` | PWA manifest from same origin |
| `script-src` | `'self' 'wasm-unsafe-eval'` | Scripts from same origin + WebAssembly eval (needed for WebLLM/WASM) |
| `style-src` | `'self' 'unsafe-inline'` | Same-origin stylesheets + inline styles (Tailwind CSS runtime) |
| `img-src` | `'self' data: blob: https://images.unsplash.com https://*.unsplash.com` | Course images from Unsplash CDN |
| `media-src` | `'self' blob:` | Local media + blob URLs for video/audio |
| `font-src` | `'self'` | Fonts from same origin only |
| `connect-src` | See below | API and data connections |
| `frame-src` | `'self' https://www.youtube.com https://www.youtube-nocookie.com https://checkout.stripe.com https://js.stripe.com` | YouTube embeds + Stripe checkout |
| `worker-src` | `'self' blob:` | Service workers and web workers |
| `object-src` | `'none'` | Blocks Flash/Java plugins entirely |
| `base-uri` | `'self'` | Prevents base tag hijacking |
| `form-action` | `'self'` | Limits form submissions to same origin |
| `upgrade-insecure-requests` | (present) | Forces HTTPS for mixed content |
| `block-all-mixed-content` | (present) | Blocks HTTP resources on HTTPS pages |

### connect-src Breakdown

| Domain | Purpose |
|--------|---------|
| `'self'` | Same-origin API calls |
| `ws: wss:` | WebSocket connections (Vite HMR in dev) |
| `https://huggingface.co https://*.huggingface.co https://*.hf.co` | HuggingFace model downloads for WebLLM |
| `https://raw.githubusercontent.com` | GitHub raw content (model configs) |
| `http://titan.local:*` | Ollama server on local network (Unraid) |
| `http://localhost:* http://127.0.0.1:*` | Local development services |
| `https://*.stripe.com` | Stripe payment processing |
| `https://*.supabase.co` | Supabase auth and database |
| `https://www.googleapis.com` | YouTube Data API v3 |
| `https://www.youtube.com` | YouTube video embeds |

### Dev Server Security Headers (vite.config.ts)

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Cross-Origin-Embedder-Policy` | `credentialless` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

### CSP Assessment

**Strengths:**
- `object-src 'none'` blocks legacy plugin attacks
- `base-uri 'self'` prevents base tag injection
- `upgrade-insecure-requests` + `block-all-mixed-content` enforce HTTPS
- `form-action 'self'` limits form target hijacking

**Risks:**
- `style-src 'unsafe-inline'` is required by Tailwind CSS runtime -- standard tradeoff for CSS-in-JS frameworks
- `'wasm-unsafe-eval'` in script-src needed for WebLLM WASM -- scoped specifically to WASM, not general eval
- `http://localhost:*` and `http://titan.local:*` in connect-src are dev/LAN only -- should be stripped in a true production deploy
- `ws: wss:` wildcard in connect-src is overly broad -- could be scoped to `ws://localhost:*` for dev only

---

## 2. External Domain Inventory

| Domain | Protocol | Purpose | Required? |
|--------|----------|---------|-----------|
| `*.supabase.co` | HTTPS | Authentication, user data, edge functions | Required for auth |
| `www.youtube.com` | HTTPS | Video embeds (iframe) | Required for YouTube courses |
| `www.youtube-nocookie.com` | HTTPS | Privacy-enhanced YouTube embeds | Optional (fallback) |
| `www.googleapis.com` | HTTPS | YouTube Data API v3 | Required for YouTube import |
| `i.ytimg.com` / `img.youtube.com` | HTTPS | YouTube thumbnails (dev CSP only) | Required for YouTube courses |
| `checkout.stripe.com` / `js.stripe.com` | HTTPS | Stripe payment checkout | Required for premium features |
| `*.stripe.com` | HTTPS | Stripe API calls | Required for premium features |
| `images.unsplash.com` / `*.unsplash.com` | HTTPS | Course cover images | Required for course display |
| `huggingface.co` / `*.huggingface.co` / `*.hf.co` | HTTPS | AI model downloads (WebLLM) | Optional (AI features) |
| `raw.githubusercontent.com` | HTTPS | Model config files | Optional (AI features) |
| `titan.local` | HTTP | Ollama server on local network | Optional (self-hosted AI) |

---

## 3. API Key & Secret Exposure Assessment

### VITE_ Environment Variables

Vite exposes any `VITE_*` env vars to the client bundle. These are the current variables:

| Variable | Value Type | Secret? | Exposure Risk |
|----------|-----------|---------|---------------|
| `VITE_SUPABASE_URL` | URL | No | Public -- Supabase project URL is intended to be public |
| `VITE_SUPABASE_ANON_KEY` | JWT | No | Public -- The anon key is a public client key. Row-Level Security (RLS) on Supabase controls access |
| `VITE_STRIPE_PRICE_ID` | Price ID | No | Public -- Stripe price IDs are non-secret identifiers |
| `VITE_API_URL` | URL | No | Public -- Backend API base URL |

**Assessment: No secrets are exposed through VITE_ variables.** The Supabase anon key is explicitly designed to be client-side. Stripe secret keys are handled server-side via Supabase Edge Functions (`supabase secrets set`).

### Codebase Scan for Hardcoded Secrets

Scanned `src/**/*.{ts,tsx}` (excluding test/spec/mock files) for patterns: `sk_`, `pk_`, `apikey`, `api_key`, `secret`, `password`.

**Results:**
- `password` references: Only in `useAuthStore.ts` (function parameters for `signIn`/`signUp`) and `deleteAccount.ts` (reauthentication) -- these are user-input values, not hardcoded secrets
- `secret` references: Only in test files (`crypto.test.ts`) using test fixture strings
- `sk_`/`pk_` references: None in source code
- `api_key` references: None in source code

**No hardcoded secrets found in the source code.**

### AI API Key Storage

AI provider API keys (OpenAI, Anthropic, Groq, etc.) are entered by users in Settings and stored in the browser:
- **Storage location:** localStorage (via `src/lib/aiConfiguration.ts`)
- **Encryption:** Keys are encrypted using Web Crypto API (`src/lib/crypto.ts`) with AES-GCM before storage
- **Server exposure:** Keys are never sent to any server except the AI provider's own API endpoint

---

## 4. Environment Variable Documentation

### Required Variables

| Variable | Default | Purpose | Required For |
|----------|---------|---------|-------------|
| `VITE_SUPABASE_URL` | `http://localhost:8000` | Supabase instance URL | Authentication, user management |
| `VITE_SUPABASE_ANON_KEY` | (none) | Supabase anonymous/public key | Authentication, user management |

**Graceful degradation:** If these are missing, the `supabase` client is `null` (`src/lib/auth/supabase.ts:10-11`). The auth store surfaces a clear error message: "Authentication is not configured." The app runs fully in offline/local mode without auth.

### Optional Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_STRIPE_PRICE_ID` | (none) | Stripe price ID for premium checkout. Checkout is a server-side redirect, so this is optional client-side |
| `VITE_API_URL` | `http://localhost:3000/api` | Backend API base URL. Falls back to localhost for development |
| `COURSES_ROOT` | `''` (empty) | Local filesystem path for course media (used by Vite dev server plugin) |
| `PREMIUM_BUILD` | (unset) | When set, disables premium import guard (allows premium features in build) |

### Server-Side Only (Supabase Edge Functions)

These are configured via `supabase secrets set` and never reach the client:
- `STRIPE_SECRET_KEY` -- Stripe secret key for payment processing
- `STRIPE_WEBHOOK_SECRET` -- Stripe webhook signature verification

---

## 5. OWASP Top 10 Assessment

### A01:2021 -- Broken Access Control

| Area | Status | Details |
|------|--------|---------|
| Server-side auth | Supabase RLS | Row-Level Security policies enforce access per-user on Supabase |
| Client-side auth | Supabase session | JWT-based session management via `@supabase/supabase-js` |
| Premium gating | Build-time guard | `vite-plugin-premium-guard` strips premium imports from free builds |
| Local data | No auth needed | IndexedDB data (courses, notes, progress) is user-local; no multi-tenant risk |

**Risk:** LOW -- Local-first app with Supabase RLS for server interactions.

### A02:2021 -- Cryptographic Failures

| Area | Status | Details |
|------|--------|---------|
| API key encryption | AES-GCM via Web Crypto | AI provider keys encrypted before localStorage storage (`src/lib/crypto.ts`) |
| Transport | HTTPS enforced | CSP `upgrade-insecure-requests` + `block-all-mixed-content` |
| Password handling | Supabase Auth | Passwords handled entirely by Supabase; never stored client-side |

**Risk:** LOW -- No custom crypto for auth; Web Crypto for optional AI key storage.

### A03:2021 -- Injection

| Area | Status | Details |
|------|--------|---------|
| XSS | React default escaping | React escapes all JSX expressions by default; CSP blocks inline scripts |
| SQL injection | N/A | No direct database queries; Supabase uses parameterized queries |
| Command injection | N/A | No server-side command execution in client app |
| HTML injection | `dangerouslySetInnerHTML` | Used in TipTap rich text editor -- input is sanitized by ProseMirror |
| URL injection | SSRF protection | `src/lib/ssrfProtection.ts` validates Ollama proxy URLs; blocks loopback/private IPs |

**Risk:** LOW -- React's default escaping + CSP provides strong XSS protection.

### A04:2021 -- Insecure Design

| Area | Status | Details |
|------|--------|---------|
| Error handling | Structured + ErrorBoundary | `src/lib/errorTracking.ts` ring buffer + React ErrorBoundary catches all errors |
| Offline mode | Progressive degradation | `useOnlineStatus` hook; app functions without network |
| Data validation | Type-safe | TypeScript + Zod schemas for API responses |

**Risk:** LOW

### A05:2021 -- Security Misconfiguration

| Area | Status | Details |
|------|--------|---------|
| CSP | Configured | Comprehensive CSP in index.html (see section 1) |
| Security headers | Configured | X-Content-Type-Options, X-Frame-Options, etc. in Vite config |
| Debug info | Dev-only | Error stack traces only shown when `import.meta.env.DEV` is true |
| Source maps | Build config | Vite defaults to no source maps in production build |

**Risk:** LOW -- Headers and CSP are well-configured.

### A06:2021 -- Vulnerable and Outdated Components

| Area | Status | Details |
|------|--------|---------|
| Dependencies | npm audit | Should be run regularly; no known critical vulnerabilities at time of audit |
| React | 19.2.4 | Latest stable |
| Vite | 6.4.1 | Latest stable |

**Risk:** LOW -- Stack uses current versions. Recommend adding `npm audit` to CI.

### A07:2021 -- Identification and Authentication Failures

| Area | Status | Details |
|------|--------|---------|
| Auth provider | Supabase Auth | Industry-standard JWT auth with refresh tokens |
| Session management | Supabase SDK | Automatic token refresh, secure cookie handling |
| Password policy | Supabase default | Minimum 6 characters (Supabase default) |
| MFA | Not implemented | Supabase supports TOTP MFA but it's not enabled yet |

**Risk:** MEDIUM -- Consider enabling MFA for sensitive accounts.

### A08:2021 -- Software and Data Integrity Failures

| Area | Status | Details |
|------|--------|---------|
| Build pipeline | Vite + npm | Standard build toolchain with lockfile |
| CDN resources | Pinned versions | WebLLM CDN import uses pinned version (`@0.2.81`) |
| Service worker | Workbox | Precache manifest ensures integrity of cached assets |

**Risk:** LOW

### A09:2021 -- Security Logging and Monitoring Failures

| Area | Status | Details |
|------|--------|---------|
| Error tracking | In-memory ring buffer | `src/lib/errorTracking.ts` captures errors locally (50 max) |
| External monitoring | Not configured | Sentry SDK not yet integrated; errors are client-only |
| Performance monitoring | Web Vitals | `src/lib/performanceMonitoring.ts` tracks CLS, FID, LCP |

**Risk:** MEDIUM -- No external error reporting means production issues may go unnoticed. Sentry integration is planned.

### A10:2021 -- Server-Side Request Forgery (SSRF)

| Area | Status | Details |
|------|--------|---------|
| Ollama proxy | SSRF protection | `src/lib/ssrfProtection.ts` validates URLs; blocks loopback by default |
| YouTube proxy | Server-side only | `vite-plugin-youtube-transcript.ts` proxies transcript requests |
| Path traversal | Protected | `serveLocalMedia()` in vite.config.ts validates resolved paths stay within COURSES_ROOT |

**Risk:** LOW -- SSRF protection is implemented for the Ollama proxy. The YouTube transcript proxy runs server-side through Vite middleware.

---

## 6. Summary & Recommendations

### Current Security Posture: GOOD

The application demonstrates security-conscious design:
- Comprehensive CSP with restrictive defaults
- No hardcoded secrets in source code
- Encrypted storage for sensitive user data (AI API keys)
- SSRF protection for proxy endpoints
- Path traversal protection for local media serving
- Security headers configured on dev server

### Recommendations

| Priority | Item | Details |
|----------|------|---------|
| HIGH | Strip dev-only CSP entries for production | Remove `http://localhost:*`, `http://127.0.0.1:*`, `ws:` from connect-src in production builds |
| HIGH | Integrate Sentry | Connect `src/lib/errorTracking.ts` to Sentry for production error visibility |
| MEDIUM | Add `npm audit` to CI | Catch vulnerable dependencies before merge |
| MEDIUM | Enable Supabase MFA | Add TOTP MFA option in Settings for enhanced account security |
| MEDIUM | Scope WebSocket CSP | Replace `ws: wss:` with specific dev server URL |
| LOW | Add Subresource Integrity | SRI hashes for CDN-loaded resources (WebLLM) |
| LOW | Rate limiting | Add client-side rate limiting for auth attempts (Supabase handles server-side) |
