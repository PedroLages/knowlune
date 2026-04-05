# Security Review: E101-S01 — AudiobookshelfService & Data Foundation

**Reviewer**: Claude Opus (security-review agent)
**Date**: 2026-04-05
**Story**: E101-S01

## Scope

- `src/services/AudiobookshelfService.ts` (new)
- `src/services/__tests__/AudiobookshelfService.test.ts` (new)
- `src/data/types.ts` (modified)
- `src/db/schema.ts` (modified)
- `src/db/checkpoint.ts` (modified)
- `src/db/__tests__/schema-checkpoint.test.ts` (modified)

## OWASP Top 10 Scan

| Category | Finding | Verdict |
| --- | --- | --- |
| A01 Broken Access Control | API key passed as function parameter, never stored in global state | PASS |
| A02 Cryptographic Failures | API key stored plaintext in IndexedDB — documented as local-first acceptable with encryption-before-sync tracking note | KNOWN (per architecture) |
| A03 Injection | All URL path segments use `encodeURIComponent` | PASS |
| A04 Insecure Design | `isInsecureUrl` helper warns about HTTP URLs | PASS |
| A05 Security Misconfiguration | No server-side config in scope | N/A |
| A06 Vulnerable Components | No new dependencies added | PASS |
| A07 Auth Failures | Bearer token sent via Authorization header for API calls; query param token for streaming (architectural decision, HTML5 audio limitation) | KNOWN |
| A08 Data Integrity | TypeScript types enforce structure | PASS |
| A09 Logging Failures | API key never included in error messages or console logs | PASS |
| A10 SSRF | Client-side only, no server to exploit | N/A |

## Secrets Scan

- No hardcoded secrets in source files
- Test files use `test-api-key-123` (not a real key)
- No `.env` files modified
- No credentials in comments or commit messages

## Attack Surface

- **New IndexedDB table**: `audiobookshelfServers` stores API keys — same pattern as `opdsCatalogs` storing auth credentials. Local-only, no network exposure.
- **New outbound API calls**: All go through `absApiFetch` with timeout protection. No open redirect risk (URLs are user-configured server addresses).
- **Token in URL**: `getStreamUrl` exposes API key in query parameter. This is documented as an architectural necessity for HTML5 `<audio>` streaming. Risk is mitigated by local network usage pattern (most ABS servers are on LAN).

## Findings

**None.** No new security vulnerabilities introduced. Known architectural decisions (plaintext local storage, token-in-URL for streaming) are documented and tracked.

---

Security verdict: **PASS**
