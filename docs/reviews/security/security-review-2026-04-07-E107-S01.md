## Security Review: E107-S01 — Fix Cover Image Display

**Date:** 2026-04-07
**Phases executed:** 8/8
**Diff scope:** 14 files changed, 605 insertions, 21 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | 1 informational finding (not in diff) |
| 3 | OWASP Top 10 | Always | 9 categories checked |
| 4 | Dependencies | package.json not changed | N/A |
| 5 | Auth & Access | No auth files changed | N/A |
| 6 | STRIDE | New hook + modified components | 0 new threats |
| 7 | Configuration | No config files changed in diff | N/A |
| 8 | Config Security | Always-on (8.1, 8.2, 8.5) | 1 informational finding |

### Attack Surface Changes

This story introduces a new `useBookCoverUrl` hook that resolves custom protocol identifiers (`opfs-cover://`, `opfs://`) to displayable blob URLs. The attack surface changes are:

1. **URL protocol routing in `useBookCoverUrl`** (new): The hook acts as a URL dispatcher -- it receives a `coverUrl` string and routes it to different handlers based on protocol. Any protocol that is not `http://` or `https://` falls through to `OpfsStorageService.getCoverUrl()`. This is a potential injection vector if `coverUrl` were attacker-controlled.

2. **CSS `backgroundImage` injection via resolved URL** (modified in `AudiobookRenderer.tsx:282`): The `resolvedCoverUrl` is interpolated directly into a CSS `url()` template literal. If the resolved URL were malicious, it could potentially inject CSS.

Both vectors are **mitigated** in the current implementation:
- The `coverUrl` values originate from IndexedDB/Dexie (user's own data), not from external input.
- The hook only returns: (a) the original http/https URL, (b) a blob URL from `URL.createObjectURL()`, or (c) `null`. None of these can inject CSS or execute script.
- The `OpfsStorageService.getCoverUrl()` reads a hardcoded filename (`cover.jpg`) from a directory keyed by `bookId`, preventing path traversal.

### Findings

#### Blockers (critical vulnerabilities -- must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

**[src/app/hooks/useBookCoverUrl.ts:57](src/app/hooks/useBookCoverUrl.ts:57)** (confidence: 72): Unrecognized protocol values silently fall through to OPFS resolution.

The hook's protocol dispatch has only two explicit branches (`http://`, `https://`) and a catch-all that calls `opfsStorageService.getCoverUrl(bookId)`. If a `coverUrl` with an unexpected protocol (e.g., `data:image/png;base64,...`, `javascript:...`, `ftp://...`) were stored in the database, the hook would attempt to resolve it via OPFS, which would fail gracefully (returning null). This is not exploitable today because: (a) `coverUrl` is set by the application during book import, not by user input; (b) the OPFS call ignores the `coverUrl` string entirely and uses only `bookId`; (c) the catch block returns null.

However, this is a defense-in-depth concern. If the hook is reused in a context where `coverUrl` could be a `data:` URL (e.g., an imported cover stored inline), the current logic would discard it and try OPFS instead of displaying it. Consider adding explicit protocol handling:

```typescript
// After the http/https check:
if (coverUrl.startsWith('data:')) {
  if (!isCancelled) setResolvedUrl(coverUrl)
  return
}
```

And adding a fallback for truly unknown protocols that logs a warning rather than silently calling OPFS.

#### Informational (awareness only)

**[.mcp.json](/.mcp.json) and [.claude/settings.local.json](/.claude/settings.local.json)** (confidence: 95): These files contain real API keys (Google API key in `.mcp.json`, OpenAI and ZAI keys in `.claude/settings.local.json`) and are tracked by git. While `.claude/settings.json` was previously removed from tracking (commit `229eea20`), `.mcp.json` and `.claude/settings.local.json` remain tracked. Neither file is part of this diff, so this is not a blocker for E107-S01, but it is a persistent risk. Recommendation: add `.mcp.json` to `.gitignore`, and verify `.claude/settings.local.json` is also gitignored (it is listed in `.gitignore` but `git ls-files` shows it tracked, suggesting it was added before the gitignore entry).

### Secrets Scan

**Diff scope: Clean** -- no secrets detected in the changed files (7 source files, 1 test file, documentation files).

**Out-of-scope finding:** API keys exist in `.mcp.json` (Google API key) and `.claude/settings.local.json` (OpenAI `sk-proj-*`, ZAI API key). These are tracked by git but not part of this story's changes. See informational finding above.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No access control changes; cover URL resolution does not gate premium content |
| CS2: Client-Side Injection (XSS) | Yes | No | Checked `backgroundImage: url(${resolvedCoverUrl})` -- safe because resolved URLs are either external http/https, blob: URLs from createObjectURL, or null. No `dangerouslySetInnerHTML` or `ref.innerHTML` in changed files. |
| CS3: Sensitive Data in Client Storage | No | No | No BYOK keys, tokens, or auth data involved. Cover URLs are not sensitive. |
| CS5: Client-Side Integrity | Yes | No | Blob URL lifecycle is properly managed: created in useEffect, revoked in cleanup. `previousUrlRef` tracks the URL for revocation. |
| CS7: Client-Side Security Logging | No | No | No console.log of sensitive data. The catch block in the hook is intentionally silent (cover not found is not a security event). |
| CS9: Client-Side Communication | No | No | No postMessage, cross-window, or cross-origin communication in changed code. |
| A05: Security Misconfiguration | No | No | No Vite config, CSP, or CORS changes. |
| A06: Vulnerable Components | No | No | No new dependencies added. |
| A07: Auth Failures | No | No | No authentication or session changes. |

### STRIDE Analysis

| Threat | Applicable? | Details |
|--------|------------|---------|
| Spoofing | No | Cover URLs do not authenticate or represent identity. |
| Tampering | Low | `coverUrl` stored in IndexedDB could be tampered via DevTools, but the hook routes unknown protocols to OPFS (which fails gracefully). The `bookId` used for OPFS lookup is not derived from `coverUrl`, so tampering `coverUrl` to a different book's ID would not expose that book's cover. |
| Repudiation | No | Cover display has no audit requirements. |
| Information Disclosure | Low | Blob URLs are scoped to the same origin. A blob URL from OPFS cannot be used to access another origin's data. |
| Denial of Service | No | Creating blob URLs is lightweight. Revocation in cleanup prevents accumulation. |
| Elevation of Privilege | No | Cover URL resolution does not grant any elevated capabilities. |

### What's Done Well

1. **Proper blob URL lifecycle management** -- The hook correctly creates blob URLs in useEffect and revokes them in the cleanup function, preventing memory leaks. The `previousUrlRef` pattern ensures the old URL is cleaned up even when the `coverUrl` prop changes, not just on unmount.

2. **Cancel flag for async state updates** -- The `isCancelled` flag prevents stale state updates after component unmount or prop changes, avoiding the common React async useEffect bug that can cause memory warnings or visual flickering.

3. **Clean separation of concerns** -- The URL resolution logic is centralized in one hook rather than duplicated across 5+ components. This reduces the attack surface to a single auditable location and ensures all components get the same security guarantees.

4. **OPFS path safety** -- `getBookDir()` uses the File System Access API's directory handle chain (not string concatenation), which inherently prevents path traversal. The cover filename is hardcoded to `cover.jpg`, so no user-controlled path segments reach the filesystem.

---
Phases: 8/8 | Findings: 3 total | Blockers: 0 | False positives filtered: 0
