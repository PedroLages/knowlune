## Security Review: E107-S04 — Wire About Book Dialog

**Date:** 2026-04-09
**Phases executed:** 5/8
**Diff scope:** 32 files changed, 4274 insertions, 42 deletions (source: 196 insertions, 1 deletion in 3 story files)

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 1 vector identified |
| 2 | Secrets Scan | Always | 3 secrets in config files (1 on origin/main, 2 local-only) |
| 3 | OWASP Top 10 | Always | 9 categories checked |
| 4 | Dependencies | No package.json changes | N/A |
| 5 | Auth & Access | No auth file changes | N/A |
| 6 | STRIDE | New component added | 0 novel threats |
| 7 | Configuration | .gitignore and .mcp.json changed | 1 remediation action noted |
| 8 | Config Security | Always-on (secrets) + .mcp.json/.gitignore changed | 3 findings (1 blocker pre-existing, 2 high local-only) |

### Attack Surface Changes

This story adds one new dialog component (`AboutBookDialog`) that displays read-only book metadata. The attack surface is minimal:

1. **User-controlled data rendered in JSX** — `book.title`, `book.author`, `book.description`, `book.tags`, `book.isbn`, `book.format`, `book.fileSize` are all rendered via React JSX expressions. React auto-escapes all interpolated values. No `dangerouslySetInnerHTML`, no `ref.current.innerHTML`, no dynamic `href` attributes, no `eval()`, no `window.open()` calls.

The component is purely presentational with no network requests, no data writes, no authentication logic, and no user input handling. The only external data flow is the `resolvedCoverUrl` from `useBookCoverUrl`, which already has protocol validation at the hook level.

### Findings

#### Blockers (critical vulnerabilities -- must fix before merge)

- **`.mcp.json` on `origin/main` (commit `f01a1d76`)** (confidence: 95): **Plaintext Stitch/Google API key committed to git history and pushed to origin/main.**

  The file `main:.mcp.json` contains `"X-Goog-Api-Key": "AQ.Ab8RN6Ia9IACG-t07VIkRNEatPGi8_kVq3EK3tXmrRPjk8C1mA"`. This key exists in the git history reachable from `origin/main`, meaning it is accessible to anyone with read access to the GitHub repository.

  **Important context for this story:** This diff **fixes** the tracking issue. Commit `43d2c00e` in this branch deletes `.mcp.json` from git tracking and adds it to `.gitignore`. However, the key remains in git history on `origin/main` and is still the same value on disk (despite commit `db0abbcb` claiming rotation -- the key was never actually rotated).

  **Exploit:** Anyone with read access to the repository can extract this API key from git history and use it to make requests to the Stitch/Google API, potentially incurring costs or accessing data associated with that key.

  **Fix:**
  1. Rotate the Stitch/Google API key immediately at the Google Cloud Console. The current key `AQ.Ab8RN6Ia9IACG-...` must be assumed compromised.
  2. This branch's removal of `.mcp.json` from tracking (commit `43d2c00e`) is the correct forward fix.
  3. After merge, scrub the key from git history using BFG Repo Cleaner: `java -jar bfg.jar --replace-text .gitignore && git reflog expire --expire=now --all && git gc --prune=now --aggressive`
  4. Force-push the cleaned history to origin (coordinate with any other contributors).
  5. Use environment variable references in `.mcp.json` (e.g., `"X-Goog-Api-Key": "${STITCH_API_KEY}"`) so the file can be tracked without containing secrets.

#### High Priority (should fix)

- **`.claude/settings.json:17-18`** (confidence: 85): **Plaintext API keys in local settings file -- not tracked by git but risky pattern.**

  The file contains an OpenAI API key (`sk-proj-RDQ7...`) and a ZAI API key (`8f368d07...`). This file is correctly in `.gitignore` (added in commit `229eea20`) and is not tracked by git. However, the plaintext storage pattern is fragile.

  **Exploit:** If the file is accidentally re-added via `git add -A` or similar, the secrets would be committed. The OpenAI key format (`sk-proj-...`) is immediately recognizable and exploitable for billing abuse.

  **Fix:**
  1. Rotate both API keys (OpenAI and ZAI).
  2. Move secrets to `.env.local` (already in `.gitignore` via `*.local` pattern).
  3. Reference them as environment variables in `.claude/settings.local.json` or use OS keychain integration.
  4. Consider adding a pre-commit hook with `detect-secrets` or `gitleaks` to catch accidental commits of these patterns.

#### Medium (fix when possible)

No medium findings.

#### Informational (awareness only)

- **`src/app/components/library/AboutBookDialog.tsx:68-72`** (confidence: 60): The `resolvedCoverUrl` from `useBookCoverUrl` is used in `<img src>`. The hook has a protocol whitelist (`https:`, `opfs:`, `opfs-cover:`, `data:image/`) that rejects dangerous schemes. The `data:image/` allowance is safe in `<img src>` context (cannot execute JavaScript), but would be dangerous in `<iframe src>`. Current usage is safe.

- **`src/data/types.ts:682`** (confidence: 50): The `Book.author` field was changed from `string` to `string | undefined` (optional). The `AboutBookDialog` component handles the `undefined` case with a fallback "Unknown author" display. No security impact -- purely a type safety improvement.

### Secrets Scan

**3 secrets detected in configuration files (2 local-only, 1 in remote history):**

| File | Secret Type | Tracked in Git? | On Remote? | Severity |
|------|-------------|-----------------|------------|----------|
| `.mcp.json:15` | Google/Stitch API Key | Was -- this branch removes tracking | YES -- in `origin/main` history | BLOCKER |
| `.claude/settings.json:17` | OpenAI API Key (`sk-proj-...`) | No (removed in `229eea20`) | No | HIGH |
| `.claude/settings.json:18` | ZAI API Key | No (removed in `229eea20`) | No | HIGH |

**Diff-specific scan (story source files):** Clean. No secrets in `AboutBookDialog.tsx`, `BookContextMenu.tsx`, or `types.ts`.

**Test files:** Root-level `test-about-book-dialog.js` and `test-about-book-dialog.mjs` contain no secrets -- they are Playwright test scripts using local IndexedDB seeding only.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No access control logic in changed code |
| CS2: Client-Side Injection (XSS) | Yes | No | All user data rendered via JSX auto-escaping. No `dangerouslySetInnerHTML`, `innerHTML`, or dynamic `href`. Verified safe. |
| CS3: Sensitive Data in Client Storage | No | No | No new localStorage/IndexedDB writes in story code |
| CS5: Client-Side Integrity | No | No | No data mutations, no schema changes (only `author` field made optional) |
| CS7: Client-Side Security Logging | Yes | No | No `console.log` statements in new code. No sensitive data logged. |
| CS9: Client-Side Communication | No | No | No postMessage, no cross-window communication |
| A05: Security Misconfiguration | Yes | Yes | `.mcp.json` with plaintext API key in git history (pre-existing). This branch remediates the tracking issue. |
| A06: Vulnerable Components | No | No | No new dependencies added (package.json unchanged) |
| A07: Auth Failures | No | No | No authentication logic changed |

### STRIDE Analysis (AboutBookDialog)

| Threat | Risk | Notes |
|--------|------|-------|
| Spoofing | None | No identity assertions in dialog |
| Tampering | None | Read-only display component, no data writes |
| Repudiation | None | No auditable actions |
| Information Disclosure | None | Displays user's own book metadata (already accessible via IndexedDB DevTools) |
| Denial of Service | None | Static dialog, no expensive computations or network calls |
| Elevation of Privilege | None | No auth or permission checks involved |

### Configuration Security (Phase 8)

**Check 8.1 -- Secrets in Configuration Files:** 3 secrets found (see Secrets Scan above).

**Check 8.2 -- MCP Server Security:**
- `.mcp.json` contains API key in `headers` field (plaintext).
- `.mcp.json` was on `origin/main` (now removed in this branch's commit `43d2c00e`).
- `.mcp.json` added to `.gitignore` in this branch -- correct fix.
- **Recommendation:** Use `${STITCH_API_KEY}` environment variable reference instead of plaintext key.

**Check 8.5 -- .env File Tracking:** Clean. `.env`, `.env.local`, `.env.production` are not tracked by git.

### What's Done Well

1. **Clean JSX rendering with no injection surface** -- All user-controlled data (`book.title`, `book.author`, `book.description`, `book.tags`) is rendered through React JSX expressions, which auto-escape HTML. The diff was thoroughly checked for `dangerouslySetInnerHTML`, `innerHTML`, dynamic `href`, `eval()`, `Function()`, `window.open()`, and `document.write()` -- none found. This is a textbook safe presentational component.

2. **Proactive secrets remediation in this branch** -- This story's diff includes commit `43d2c00e` which removes `.mcp.json` from git tracking and adds it to `.gitignore`. This directly addresses a previously identified blocker. The remediation is correct.

3. **Defense-in-depth URL validation** -- The `useBookCoverUrl` hook (used by the new component) maintains a strict protocol whitelist (`https:`, `opfs:`, `opfs-cover:`, `data:image/`) that rejects `javascript:`, `file:`, `ftp:`, and other dangerous schemes before any URL reaches the DOM. This prevents content injection through manipulated `coverUrl` values in IndexedDB.

4. **Proper dialog accessibility** -- The component uses `aria-describedby`, semantic `DialogDescription`, and `data-testid` attributes. Radix UI's `Dialog` primitive handles focus trapping and keyboard navigation.

---
Phases: 5/8 | Findings: 3 total | Blockers: 1 (pre-existing -- Stitch API key in git history) | High: 2 (local-only config secrets) | False positives filtered: 2
