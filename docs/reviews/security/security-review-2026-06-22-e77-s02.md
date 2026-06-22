## Security Review: E77-S02 — Google Drive Service Layer (OAuth Scope + Token Helper)

**Date:** 2026-06-22
**Phases executed:** 4/8
**Diff scope:** 6 files changed, 301 insertions(+), 18 deletions(-)

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 3 categories checked |
| 8 | Config Security | Always-on | 0 findings introduced by story |

### Attack Surface Changes

1. **OAuth scope expansion** (`src/stores/useAuthStore.ts:155`): Google sign-in now requests `drive.file` scope, `access_type=offline`, and `prompt=consent`. The `drive.file` scope is narrow (app-specific folder only, not user's full Drive). The `offline` + `consent` params obtain a `provider_refresh_token` so token refresh works without user presence.

2. **New token retrieval module** (`src/lib/googleDriveToken.ts`): Exposes `getDriveToken()` and `refreshDriveToken()`. Tokens are read from in-memory Zustand state (`useAuthStore.session.provider_token`) and refreshed via `supabase.auth.refreshSession()`. No tokens are persisted by Knowlune's own code — see informational finding about Supabase's built-in session persistence.

### Findings

#### Blockers
_None._

#### High Priority
_None._

#### Medium
_None._

#### Informational

- **I1** `src/lib/auth/supabase.ts:16` — **provider_token persisted to localStorage by Supabase** (advisory, confidence: 65)

  **Context:** Supabase's `createClient()` is configured with `persistSession: true` (line 16). This causes the GoTrue client to write the full session object — including the Google `provider_token` — to `localStorage` under a key like `sb-{project_ref}-auth-token`.

  **Why this is low risk:**
  - `persistSession: true` was already configured before this story. The incremental change is that the session now contains a `provider_token` (Google Drive OAuth token) where it previously did not (no Drive scope was requested).
  - The `drive.file` scope grants access only to app-created files, not the user's full Drive. Compromise would expose at most backup data within the `Knowlune/` folder.
  - Supabase already stores the `access_token` and `refresh_token` in localStorage via this same mechanism. The `provider_token` is an additional token with the same storage characteristics.
  - This is the standard Supabase OAuth pattern — every Supabase project with Google OAuth operates this way.

  **Recommendation:** Document in the Drive feature's threat model that the `provider_token` lives in localStorage (accessible via XSS). If this risk becomes unacceptable in a future security posture upgrade, consider:
  - Setting `persistSession: false` in the Supabase client config (this would break auto-refresh on page reload and require a different session management strategy)
  - Moving to a proxy-based architecture where Drive tokens are managed server-side

  **Autofix class:** advisory (no code change, threat model awareness)

---

- **I2** `src/stores/useAuthStore.ts:158` — **prompt=consent on every sign-in** (advisory, confidence: 70)

  **Context:** `queryParams: { prompt: 'consent' }` forces the Google OAuth consent screen every time the user signs in with Google.

  **Why this is by design:** Google only issues a `provider_refresh_token` on first-time consent. Using `prompt=consent` ensures every sign-in counts as "first time" for refresh token issuance, which is necessary for offline token refresh in the Drive service layer.

  **Consent fatigue risk:** Users who sign in frequently will see the consent screen each time, which may lead to habituated clicking without reading the scope list. This is a UX concern documented in the story's own design notes.

  **Mitigation:** Google's consent screen clearly states the `drive.file` scope (access to app-created files only). Users who are already signed in for a session won't see this again until they sign out and back in. The impact is limited to the sign-in frequency.

  **Recommendation:** Accept as intentional design choice. If user feedback indicates fatigue, explore alternatives (e.g., only sending `prompt=consent` on the first sign-in with Drive scope, using `access_type=offline` without `prompt=consent` on subsequent sign-ins). Note: Google may not issue a new refresh token on subsequent sign-ins without `prompt=consent`.

  **Autofix class:** advisory (design trade-off, no immediate fix)

### Secrets Scan

**Clean** — no secrets, API keys, or credentials detected in the diff.

Scanned patterns: AKIA, sk-, ghp_, gho_, github_pat_, xoxb-, xoxp-, password, secret, api_key, token (in credential context), bearer (in credential context).

The diff contains only mock token values in test files (`'google-token-123'`, `'fresh-token'`, `'refreshed-token'`) which are clearly test fixtures, not real credentials.

No `.env` files are tracked by git. `.mcp.json` is not tracked by git.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS2: Client-Side Injection (XSS) | No | No | No new DOM manipulation, user input rendering, or `dangerouslySetInnerHTML` introduced |
| CS3: Sensitive Data in Client Storage | Yes | I1 | provider_token now present in session, persisted by Supabase's built-in localStorage mechanism |
| CS7: Client-Side Security Logging | Yes | No | Both console.error statements are gated by `import.meta.env.DEV`. No token values are logged in any path |
| A05: Security Misconfiguration | No | No | No changes to CSP, CORS, or build configuration in this diff |
| A07: Auth Failures | Yes | No | OAuth flow follows Supabase PKCE pattern correctly. Token refresh uses standard `refreshSession()` API. `drive.file` scope is minimal necessary |

### CSP Impact

The CSP in `index.html` already includes `https://www.googleapis.com` in `connect-src` (line 24). No CSP changes are needed for Drive API calls in this story.

### STRIDE Analysis

Conditional phase not fully triggered (no new page components or routes), but the new `googleDriveToken.ts` module was reviewed:

| Threat | Assessment |
|--------|-----------|
| Spoofing | Tokens come from Supabase OAuth flow — identity is verified by Google + Supabase |
| Tampering | Token is read-only from in-memory store. Refresh path uses signed Supabase session |
| Repudiation | No audit trail in this module — Drive operations not yet introduced |
| Information Disclosure | Token returned only to caller, never logged. CSP allows `connect-src` to Google APIs |
| Denial of Service | Token refresh calls Supabase API — rate limited by Supabase/Google |
| Elevation of Privilege | `drive.file` scope is minimally permissive (app folder only) |

### What's Done Well

1. **In-memory-only token access in Knowlune code:** The Zustand `useAuthStore` uses no `persist` middleware — the `session` (including `provider_token`) is replicated from Supabase's own storage only when the store is initialized. Knowlune's own code never writes the token to localStorage or IndexedDB.
2. **Minimal Drive scope:** Using `drive.file` instead of `drive` or `drive.readonly` follows the principle of least privilege. The app only accesses files it creates, not the user's existing Drive content.
3. **Clean error handling:** Both `getDriveToken()` and `refreshDriveToken()` return `null` on errors instead of throwing. No stack traces or error details are exposed to callers. The error messages visible to users in `useAuthStore` are mapped through `mapSupabaseError()`.

---
Phases: 4/8 | Findings: 2 total | Blockers: 0 | False positives filtered: 0
