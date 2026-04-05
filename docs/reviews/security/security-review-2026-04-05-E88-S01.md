## Security Review -- E88-S01 OPDS Catalog Connection (2026-04-05)

### Scope
New feature: OPDS catalog URL validation and credential storage for self-hosted book servers.

### OWASP Assessment

| Category | Risk | Notes |
|----------|------|-------|
| A01 Broken Access Control | LOW | No server-side access control -- local-first app |
| A02 Cryptographic Failures | MEDIUM | Credentials stored unencrypted in IndexedDB |
| A03 Injection | LOW | XML parsed via DOMParser in application/xml mode (safe) |
| A04 Insecure Design | LOW | Feature by design connects to user-specified URLs |
| A05 Security Misconfiguration | N/A | No server config |
| A06 Vulnerable Components | N/A | No new dependencies added |
| A07 Auth Failures | MEDIUM | Basic Auth over HTTP possible |
| A08 Data Integrity | LOW | No data signing needed for catalog config |
| A09 Logging Failures | LOW | Errors logged to console |
| A10 SSRF | LOW | Client-side only -- browser fetch sandbox prevents SSRF |

### Findings

#### HIGH -- Basic Auth credentials over HTTP (confidence: 90)
**File:** `src/services/OpdsService.ts:48-49`
When auth credentials are provided, `Authorization: Basic ${btoa(...)}` is sent regardless of URL protocol. On `http://` URLs, credentials are transmitted in plaintext. 
**Risk:** Low in practice (self-hosted local network), but principle of least surprise suggests warning users.
**Recommendation:** Add a `url.startsWith('http://')` check when auth is provided. Show a warning in the UI: "Warning: Credentials will be sent over an unencrypted connection."

#### MEDIUM -- Credentials stored unencrypted in IndexedDB (confidence: 80)
**File:** `src/data/types.ts:729-730`, `src/db/schema.ts` (opdsCatalogs table)
The `OpdsCatalog.auth` object stores `username` and `password` as plain strings. IndexedDB is origin-sandboxed, so other websites cannot access it. However:
- Browser extensions with `storage` permission can read IndexedDB
- If Supabase sync (Epic 19) syncs this table, credentials go to the server
**Recommendation:** Track as tech debt. Before sync, encrypt auth fields or exclude from sync.

#### INFO -- DOMParser used safely (confidence: 95)
**File:** `src/services/OpdsService.ts:88`
XML parsing uses `parseFromString(text, 'application/xml')` which is the safe mode. This does NOT execute scripts or load resources. The `parsererror` check correctly catches invalid XML. No XSS risk from parsed content since the DOM is never inserted into the page.

#### INFO -- AbortController timeout (confidence: 90)
**File:** `src/services/OpdsService.ts:42-43`
10-second timeout via `AbortController` prevents hanging connections. Properly cleaned up with `clearTimeout` on success. Good defensive pattern.

#### INFO -- No secrets in codebase
No API keys, tokens, or hardcoded credentials found in the diff. Auth credentials are user-provided at runtime.

### Verdict: PASS
No blockers. The HTTP credential transmission is the most significant finding but is mitigated by the target use case (self-hosted local network servers). Recommend adding an HTTP warning in a follow-up.
