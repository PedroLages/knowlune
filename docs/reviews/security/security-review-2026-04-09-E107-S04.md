## Security Review: E107-S04 — Wire About Book Dialog

**Date:** 2026-04-09
**Phases executed:** 5/8
**Diff scope:** 11 files changed, 1364 insertions, 1 deletion

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 1 vector identified |
| 2 | Secrets Scan | Always | 3 secrets found (pre-existing, not from this story) |
| 3 | OWASP Top 10 | Always | 9 categories checked |
| 4 | Dependencies | No package.json changes | N/A |
| 5 | Auth & Access | No auth file changes | N/A |
| 6 | STRIDE | New component added | 0 novel threats |
| 7 | Configuration | No config file changes in diff | N/A |
| 8 | Config Security | Always-on (secrets) | 3 secrets in tracked config files |

### Attack Surface Changes

This story adds one new dialog component (`AboutBookDialog`) that displays read-only book metadata. The attack surface is minimal:

1. **User-controlled data rendered in JSX** — `book.title`, `book.author`, `book.description`, `book.tags`, `book.isbn` are all rendered via React JSX expressions (auto-escaped). No `dangerouslySetInnerHTML`, no `innerHTML` manipulation, no dynamic `href` attributes.

The component is purely presentational with no network requests, no data writes, and no authentication logic.

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

- **`.mcp.json:15`** (confidence: 95): **Plaintext API key committed to git and pushed to origin/main.**
  The file contains a Google/Stitch API key: `"X-Goog-Api-Key": "AQ.Ab8RN6Ia9IACG..."`. This file is tracked by git (`git ls-files --error-unmatch .mcp.json` succeeds), was committed in `f01a1d76`, and exists on `origin/main`. The `.gitignore` file does not include `.mcp.json`.
  
  **Exploit:** Anyone with read access to the repository (including all collaborators and potentially the public if the repo is public or leaked) can extract this API key and use it to make requests to the Stitch/Google API, potentially incurring costs or accessing data associated with that key.
  
  **Note:** This is a pre-existing issue, not introduced by E107-S04. However, the secrets scan is always-on and must flag it when detected.
  
  **Fix:**
  1. Rotate the exposed Stitch/Google API key immediately at the provider's console.
  2. Add `.mcp.json` to `.gitignore`.
  3. Remove from git tracking: `git rm --cached .mcp.json`
  4. Scrub from git history using BFG Repo Cleaner or `git filter-branch` (the key exists in commit history on `origin/main`).
  5. Use environment variable references in `.mcp.json` instead (e.g., reference `${STITCH_API_KEY}` from a `.env.local` or OS keychain).

- **`.claude/settings.json:17-18`** (confidence: 90): **Plaintext API keys stored in local settings file.**
  The file contains an OpenAI API key (`sk-proj-RDQ7...`) and a ZAI API key (`8f368d07...`). While this file was removed from git tracking in commit `229eea20` and is now in `.gitignore`, the keys remain in the file on disk. This is lower severity since the file is no longer tracked, but the pattern of storing plaintext secrets in configuration files is risky.
  
  **Exploit:** If the file is accidentally re-added to git (e.g., `git add -A`), the secrets would be committed again. The OpenAI key format (`sk-proj-...`) is immediately recognizable and exploitable.
  
  **Fix:**
  1. Rotate both API keys (OpenAI and ZAI).
  2. Move secrets to `.env.local` (already in `.gitignore` via `*.local` pattern).
  3. Reference them as environment variables in `.claude/settings.local.json` or use OS keychain integration.
  4. Add a pre-commit hook pattern (e.g., `detect-secrets`) to catch accidental commits.

#### High Priority (should fix)

No high-priority findings in the E107-S04 story-specific code.

#### Medium (fix when possible)

No medium findings.

#### Informational (awareness only)

- **`src/app/components/library/AboutBookDialog.tsx:64-70`** (confidence: 60): The `resolvedCoverUrl` from `useBookCoverUrl` is used directly in `<img src>`. The hook validates URL protocols (rejects `javascript:`, `file:`, `ftp:`), but allows `data:image/` URIs. While `data:` URIs in `<img src>` cannot execute JavaScript (only in `<iframe src>` or `<object data>`), this is a defense-in-depth note. The existing protocol whitelist in `useBookCoverUrl` (line 56) is adequate for the `<img>` element context.

- **`src/app/components/library/BookContextMenu.tsx:99`** (confidence: 55): The `aboutDialogOpen` state is managed alongside `confirmDeleteOpen` and `linkDialogOpen` states. Multiple dialogs can technically be open simultaneously if a user triggers multiple state changes rapidly. This is a minor UX concern, not a security issue, since the dialog overlay stacking is handled by Radix UI primitives.

### Secrets Scan

**3 secrets detected in configuration files (pre-existing, not introduced by E107-S04):**

| File | Secret Type | Tracked in Git? | Severity |
|------|-------------|-----------------|----------|
| `.mcp.json:15` | Google/Stitch API Key (`X-Goog-Api-Key`) | YES — on `origin/main` | BLOCKER |
| `.claude/settings.json:17` | OpenAI API Key (`sk-proj-...`) | No (removed in `229eea20`) | HIGH |
| `.claude/settings.json:18` | ZAI API Key | No (removed in `229eea20`) | HIGH |

**Diff-specific scan:** No secrets found in the E107-S04 story code (`AboutBookDialog.tsx`, `BookContextMenu.tsx`, `story-e107-s04.spec.ts`).

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No access control logic in changed code |
| CS2: Client-Side Injection (XSS) | Yes | No | All user data rendered via JSX auto-escaping. No `dangerouslySetInnerHTML`, `innerHTML`, or dynamic `href`. Verified safe. |
| CS3: Sensitive Data in Client Storage | No | No | No new localStorage/IndexedDB writes |
| CS5: Client-Side Integrity | No | No | No data mutations, no schema changes |
| CS7: Client-Side Security Logging | Yes | No | No `console.log` statements in new code |
| CS9: Client-Side Communication | No | No | No postMessage, no cross-window communication |
| A05: Security Misconfiguration | Yes | Yes | `.mcp.json` with plaintext API key tracked in git (pre-existing) |
| A06: Vulnerable Components | No | No | No new dependencies added |
| A07: Auth Failures | No | No | No authentication logic changed |

### STRIDE Analysis (AboutBookDialog)

| Threat | Risk | Notes |
|--------|------|-------|
| Spoofing | None | No identity assertions |
| Tampering | None | Read-only display component, no data writes |
| Repudiation | None | No auditable actions |
| Information Disclosure | Low | Displays book metadata (title, author, ISBN, tags) — all user's own data already accessible via DevTools/IndexedDB |
| Denial of Service | None | Static dialog, no expensive computations |
| Elevation of Privilege | None | No auth or permission checks involved |

### What's Done Well

1. **Clean JSX rendering** — All user-controlled data (`book.title`, `book.author`, `book.description`, `book.tags`) is rendered through React JSX expressions, which auto-escape HTML. No raw HTML injection points exist.

2. **Proper dialog accessibility** — The component uses `aria-describedby`, semantic `DialogDescription`, and `data-testid` attributes. Radix UI's `Dialog` primitive handles focus trapping and keyboard navigation, preventing common a11y-related security issues (focus escape to background content).

3. **URL protocol validation** — The `useBookCoverUrl` hook (used by the new component) has a protocol whitelist that rejects `javascript:`, `file:`, `ftp:` and other dangerous schemes before rendering in `<img src>`. This is good defense-in-depth against content injection via cover URLs.

---
Phases: 5/8 | Findings: 3 total | Blockers: 2 (pre-existing config secrets) | False positives filtered: 0
