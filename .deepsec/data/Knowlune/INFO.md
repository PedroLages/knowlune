# Knowlune

## What this codebase does

Knowlune is a free, open-source personal learning platform for tracking progress, completing courses, and building study habits. Built with React 19, TypeScript, Vite, and Tailwind CSS v4 with shadcn/ui components. Uses a local-first architecture (Dexie.js/IndexedDB) with optional Supabase cloud sync. Open-core model: core features free under AGPL-3.0, premium AI features (AI Q&A, spaced review, knowledge gap detection, flashcard review, retention analytics) require a paid subscription. A companion Express server at `server/` acts as an AI proxy using the Vercel AI SDK, serving as a CORS bridge for browser-direct LLM calls to Anthropic, OpenAI, Groq, Gemini, and Ollama. The server mounts a 5-middleware chain: origin check, JWT auth (Supabase HS256 via `jose`), BYOK detection, entitlement resolution, and rate limiting.

## Auth shape

- `supabase.auth` (Supabase JS SDK) — PKCE flow for email/password, magic link, Google OAuth. Handles session persistence, token refresh, and `onAuthStateChange` listener. Configured in `src/lib/auth/supabase.ts` with `VITE_SUPABASE_ANON_KEY` (public-safe; RLS enforces access).
- `useAuthStore` (Zustand, `src/stores/useAuthStore.ts`) — Client auth state machine. Exposes `signUp`, `signIn`, `signInWithPassword`, `signInWithOtp` (magic link), `signInWithGoogle` (OAuth), `signOut`. Tracks `initialized`, `sessionExpired`, and the `_userInitiatedSignOut` flag.
- `RouteGuard` (React Router component, `src/app/routes.tsx`) — Three-state route guard: `selectAuthState()` returns `loading | authenticated | guest | anonymous`. Anonymous users render `<Landing />`. Authenticated and guest users see the protected `<Outlet />`.
- `createAuthMiddleware` (Express, `server/middleware/authenticate.ts`) — Server-side JWT verification using `jose.jwtVerify()` with HS256 (Supabase JWT secret).
- Guest mode — `sessionStorage` flags `knowlune-guest` and `knowlune-guest-id` allow unauthenticated exploration with no server-side identity.

## Threat model

1. **LLM API key exfiltration via AI proxy** — The Express proxy receives provider API keys in request body and forwards them to Anthropic/OpenAI/Groq/Gemini. An attacker who bypasses the middleware chain (origin check, JWT auth, rate limiter) or exploits SSRF through the Ollama endpoint could steal keys.
2. **IndexedDB data exfiltration via XSS** — All user notes, progress, highlights, vocabulary, and audiobookshelf credentials are stored unencrypted in Dexie.js/IndexedDB. XSS yields full read access to the entire local data set.
3. **Unauthorized premium entitlement** — `VITE_DEV_PREMIUM=true` in `.env` bypasses all client-side entitlement checks. The server middleware chain protects AI proxy routes but client-rendered premium feature flags depend on the hook being honest.
4. **SSRF through Ollama proxy** — `isAllowedOllamaUrl()` blocks loopback but allows private LAN ranges (192.168.x, 10.x) by design. An attacker who controls `ollamaServerUrl` could reach internal LAN services.

## Project-specific patterns to flag

1. `VITE_DEV_PREMIUM=true` in `.env` — Skips all entitlement checks client-side. Must never reach production.
2. `window.__authStore` / `window.__bookStore` etc. — Stores exposed on `window` only in `import.meta.env.DEV` (tree-shaken in production). If tree-shaking fails, this is a backdoor.
3. `// silent-catch-ok` convention — Applied to many catch blocks across the codebase. When used in security-critical paths (entitlement fallback, sync errors), failures become invisible.
4. Guest mode (`knowlune-guest` in `sessionStorage`) — No server-side identity or validation. Relies on frontend-only gates.
5. `PREMIUM_IMPORT_PATTERNS` in `vite-plugin-premium-guard.ts` — Regex guard blocking `@/premium/*` imports. If it misses a pattern (dynamic import, computed string), proprietary code leaks into the AGPL build.

## Known false-positives

- `VITE_SUPABASE_ANON_KEY` in `src/lib/auth/supabase.ts` — Intentionally public; Supabase RLS enforces actual access control.
- `SUPABASE_JWT_SECRET=dev-placeholder` in `.env` — Dev-only. Middleware validates JWT locally, which is the intended dev workflow.
- Guest mode (`sessionStorage`) — Not a privilege escalation vector. Guests have no server identity and no Supabase write access.
- `window.__authStore` — Only in `import.meta.env.DEV`. Vite tree-shakes the entire block in production builds.
- Ollama proxy allowing private LAN ranges (192.168.x, 10.x) — By design. Ollama servers run on the user's local network.
