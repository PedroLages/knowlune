# Security Review — E50-S02: iCal Feed Generation Endpoint

**Date:** 2026-04-04
**Story:** E50-S02 — iCal Feed Generation Endpoint
**Reviewer:** Security Review Agent
**Branch:** feature/e50-s02-ical-feed-generation-endpoint

---

## Scope

Diff-scoped review: `server/routes/calendar.ts`, `src/lib/icalFeedGenerator.ts`, `server/index.ts`

---

## Findings

### HIGH — No rate limiting on public calendar endpoint

**File:** `server/index.ts:160` / `server/routes/calendar.ts`

**What:** The `/api/calendar/:token.ics` endpoint is mounted before the rate-limiter middleware and has no per-IP or per-token rate limiting. Any actor can make unlimited requests to this endpoint.

**Exploit scenario:** Attacker enumerates valid tokens by hitting the endpoint with random 40-char hex strings at high volume (trivially parallelized). With 40 hex chars, the space is 16^40 ≈ 10^48, so brute force is infeasible — but known token values can still be hammered to cause DoS on the Supabase `calendar_tokens` table, or the attacker can spray requests to amplify Supabase read costs.

**Recommended fix:** Add a simple IP-based rate limiter on this route. Since the calendar route bypasses the main middleware chain, add a dedicated lightweight limiter:

```typescript
import rateLimit from 'express-rate-limit'

const calendarRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too Many Requests',
})

app.use('/api/calendar', calendarRateLimit, calendarRouter)
```

`express-rate-limit` is already a transitive dependency via Express ecosystem or add it. This is industry standard for public subscription feed endpoints.

**Effort:** ~20 min

---

### INFO — Token exposed in server logs via standard Express request logging

**File:** `server/routes/calendar.ts`

**What:** If Express is configured with morgan or similar request logger (check `server/index.ts`), the full URL `/api/calendar/{token}.ics` will appear in access logs, including the secret token.

**Severity:** INFO — This is a well-known characteristic of token-in-URL auth (used by Google Calendar, GitHub, etc.) and is generally accepted. Mitigated by: (a) tokens can be revoked (E50-S03), (b) HTTPS in production prevents network interception.

**Recommended:** Document in the route that tokens appear in logs, and ensure log retention policy is appropriate. No code change required unless log scrubbing is required.

---

### INFO — `VITE_SUPABASE_URL` env var used in server context

**File:** `server/routes/calendar.ts:31`

**What:** Uses `VITE_SUPABASE_URL` (a client-side env var prefix) to configure a server-side Supabase client with service role key. This works but mixes client/server env naming conventions.

**Risk:** Low — `VITE_` prefixed vars are exposed to the browser bundle by Vite by design. The URL itself is not secret, but using this naming in the server suggests the env setup could become confusing. The `SUPABASE_SERVICE_ROLE_KEY` (line 32) correctly has no `VITE_` prefix, which is correct since it is secret.

**Note:** This is consistent with the rest of the server codebase (other routes also use `VITE_SUPABASE_URL`). No change needed unless the team decides to introduce `SUPABASE_URL` as a separate server-only env var.

---

## OWASP Top 10 Assessment

| Risk | Status |
|------|--------|
| A01 Broken Access Control | ✅ Token-only auth, no JWT bypass possible, 404 for invalid tokens |
| A02 Cryptographic Failures | ✅ Token is 40-char hex (160-bit entropy), HTTPS assumed in prod |
| A03 Injection | ✅ Token validated against strict regex before DB query, no SQL injection via ORM |
| A04 Insecure Design | ⚠️ No rate limiting (HIGH finding above) |
| A05 Security Misconfiguration | ✅ Cache-Control headers prevent sensitive data caching |
| A06 Vulnerable Components | ⚠️ 3 high-severity npm audit findings (pre-existing, not from this story) |
| A07 Auth Failures | ✅ No distinction between invalid/expired token (AC4) |
| A08 Software/Data Integrity | ✅ No deserialization of untrusted data |
| A09 Logging Failures | ✅ Errors logged to console, no sensitive data in error messages returned to client |
| A10 SSRF | N/A — no user-controlled URLs fetched |

---

## Secrets Scan

- `SUPABASE_SERVICE_ROLE_KEY` — read from env, not hardcoded ✅
- `VITE_SUPABASE_URL` — read from env, not hardcoded ✅
- No API keys, tokens, or credentials in diff ✅

---

**Verdict:** 1 HIGH (no rate limiting on public endpoint), 2 INFO. Rate limiting is the only actionable item before shipping.
