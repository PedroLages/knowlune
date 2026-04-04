## Security Review: E50-S03 — Feed URL Management

**Date**: 2026-04-04
**Reviewer**: Claude (Opus) — Security pass
**Branch**: feature/e50-s03-feed-url-management
**Scope**: supabase/migrations/002_calendar_tokens.sql, src/stores/useStudyScheduleStore.ts, src/lib/icalFeedGenerator.ts

### Stack Context

- React 19 + TypeScript, Vite 6, Supabase (Postgres + RLS), client-side Zustand store

---

### Phase 1: Secrets Scan

No secrets, API keys, or credentials in diff. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are env vars only — not hardcoded. The `SUPABASE_SERVICE_ROLE_KEY` is used server-side only (confirmed in `server/routes/calendar.ts`) — never exposed to the client. **PASS.**

---

### Phase 2: Token Security (STRIDE Analysis)

**Threat: Token Guessing / Brute Force**
- Token entropy: 20 bytes from `crypto.getRandomValues` = 160 bits. Probability of guessing: 1/2^160. Not feasible. **PASS.**

**Threat: Token Enumeration via Timing**
- Server validates token with Supabase DB lookup (`maybeSingle`). Response time may vary for valid vs invalid tokens (DB hit vs miss). For a personal calendar tool, timing-based enumeration is not a realistic threat. **INFO — acceptable risk.**

**Threat: Token Exposure in Logs**
- `getFeedUrl()` returns the full token URL. This URL should not be logged to analytics or error reporting services. There are no such logging calls in the diff. **PASS.**

**Threat: Token in URL (iCal pattern)**
- Token-in-URL is the industry standard for calendar feed authentication (Google Calendar, Todoist, Canvas LMS). Tokens appear in server access logs — this is expected and accepted in this threat model. Users should be warned in the UI (future story). **INFO — acceptable, document in UI.**

---

### Phase 3: RLS Policy Review

All four operations (SELECT, INSERT, UPDATE, DELETE) have RLS policies scoped to `auth.uid() = user_id`. RLS is enabled (`ENABLE ROW LEVEL SECURITY`). Token lookup for calendar serving uses `SUPABASE_SERVICE_ROLE_KEY` (server-side, bypasses RLS intentionally). **PASS.**

**Gap**: No RLS policy for `SELECT` via service role — service role bypasses RLS by default in Supabase. This is intentional and correct. **PASS.**

---

### Phase 4: Input Validation

- Server-side: `TOKEN_REGEX = /^[a-f0-9]{40}$/` validates token format before DB lookup — prevents SQL injection via URL parameters. **PASS.**
- Client-side: `generateHexToken()` produces only lowercase hex — no injection surface. **PASS.**

---

### Phase 5: OWASP Top 10 Spot Check

| # | Risk | Assessment |
|---|------|------------|
| A01 Broken Access Control | RLS scoped to auth.uid() | PASS |
| A02 Cryptographic Failures | Web Crypto API, 160-bit entropy | PASS |
| A03 Injection | Token regex validation server-side | PASS |
| A04 Insecure Design | Token-in-URL (industry standard) | ACCEPTABLE |
| A05 Security Misconfiguration | Service role only server-side | PASS |
| A07 Authentication Failures | Token generation requires auth | PASS |

---

### Findings

#### High Priority

- **[src/stores/useStudyScheduleStore.ts:276] (confidence: 80)** `[Security/Config]`: `VITE_API_BASE_URL` is not in `.env.example`. If a developer misconfigures this (e.g., points to a different server), feed URLs will point to an uncontrolled server. The fallback `window.location.origin` is safe for development but could expose the wrong base URL in staging environments. Fix: Document this env var in `.env.example` with a clear comment. Effort: ~2 min.

#### Medium

- **[supabase/migrations/002_calendar_tokens.sql] (confidence: 70)** `[Security/Defense in depth]`: No rate limiting on token generation via RLS or DB trigger. A malicious actor with a valid session could call `generateFeedToken` rapidly to rotate their own token (effectively a DoS on their own subscriptions). Not a security risk to other users, but worth noting. Fix: Add application-level rate limiting in the UI (disable regenerate button for N seconds after use). The `feedLoading` guard already prevents rapid calls from a single browser session. **INFO.**

#### Nits

- **Nit** `[icalFeedGenerator.ts:152]` (confidence: 55): MIME type `text/calendar;charset=utf-8` is correct per RFC 5545. No issue.

---
Issues found: 2 | Blockers: 0 | High: 1 | Medium: 1 | Info: 1 | Nits: 0
Overall: PASS with minor recommendations
