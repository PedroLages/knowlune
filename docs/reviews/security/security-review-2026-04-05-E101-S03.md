# Security Review — E101-S03: Library Browsing & Catalog Sync

**Date:** 2026-04-05
**Reviewer:** Claude Opus (security-review agent)
**Stack:** React 19 + TypeScript, Vite 6, Dexie.js, Zustand

## Phases Executed: 4/8

### Phase 1: Secrets Scan
- No hardcoded API keys, tokens, or credentials in diff
- API key passed via `useAudiobookshelfStore` (persisted in IndexedDB, not source code)
- Cover URL includes `?token=` query param — acceptable for img auth, but token visible in browser network tab and server logs

### Phase 2: Input Validation
- ABS API responses are used to construct URLs and book metadata
- `server.url.replace(/\/+$/, '')` trims trailing slashes — prevents double-slash URLs
- `encodeURIComponent(server.apiKey)` — properly encodes token in cover URL query param
- No user-supplied input directly rendered as HTML (React auto-escapes)

### Phase 5: Attack Surface
- Cover URLs point to user-configured ABS server — if the server is compromised, it could serve malicious images
- `source.url` constructed from user-configured server URL — no execution risk (used for API calls only)
- IntersectionObserver sentinel — no security implications

### Phase 8: Lightweight Checks
- 8.1 Dependencies: 11 vulnerabilities (6 high) via `npm audit` — all in vite-plugin-pwa chain, pre-existing
- 8.2 No new npm packages added — attack surface unchanged
- 8.5 No secrets in committed files

## Findings

### INFO

**[INFO] API token in cover image URL query parameter**
- File: `src/app/hooks/useAudiobookshelfSync.ts:65`
- The `?token=` in cover URLs is visible in browser DevTools Network tab and could appear in server access logs
- This is the standard pattern for ABS cover access (img elements cannot set Authorization headers)
- No mitigation needed for a personal self-hosted tool

## Verdict

**PASS** — No security concerns. Token-in-URL is an acceptable pattern for self-hosted Audiobookshelf integration.
