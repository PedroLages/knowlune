## Security Review: E107-S01 — Fix Cover Image Display

**Date:** 2026-04-08
**Phases executed:** 7/8
**Diff scope:** 67 files changed, 2756 insertions, 1140 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | 1 informational (out-of-scope) |
| 3 | OWASP Top 10 | Always | 9 categories checked |
| 4 | Dependencies | package.json not changed | N/A |
| 5 | Auth & Access | No auth files changed | N/A |
| 6 | STRIDE | New hook + modified components | 0 new threats |
| 7 | Configuration | .gitignore changed | 1 positive finding |
| 8 | Config Security | Always-on (8.1, 8.2, 8.5) | 1 informational (persistent, not in diff) |

### Attack Surface Changes

This is a re-review of E107-S01 after additional commits (formatting, Prettier, review feedback). The core security-relevant change remains the same: the new `useBookCoverUrl` hook introduced in the prior review (2026-04-07). The additional commits are predominantly auto-formatting (Prettier), dead code removal (`AudiobookshelfServerCard.tsx` removes unused `StatusIcon`), and documentation. Two attack vectors from the prior review persist:

1. **URL protocol routing in `useBookCoverUrl`** (unchanged from prior review): The hook dispatches based on `coverUrl` protocol. Only `http://` and `https://` are explicitly handled; all other values fall through to `opfsStorageService.getCoverUrl(bookId)`. This was assessed as Medium (confidence: 72) in the prior review and is unchanged. No new protocol branches were added.

2. **CSS `backgroundImage` injection via resolved URL** (unchanged): `AudiobookRenderer.tsx` interpolates `resolvedCoverUrl` into `url(${resolvedCoverUrl})`. The resolved value is always a blob URL, an external http/https URL, or null -- none of which enable CSS injection. Unchanged.

**New changes reviewed for security impact:**

- **`OpdsBrowser.tsx`**: Refactored `isAlreadyInLibrary` to use a type guard (`b.source as { type: 'remote'; url: string }`) before accessing `.url`. This is a safety improvement -- the prior code accessed `.url` on a union type without narrowing. No security impact, but positive for type safety.
- **`AudiobookshelfServerCard.tsx`**: Removed unused `StatusIcon` variable. Dead code removal, no security impact.
- **`AudiobookshelfSettings.tsx`**: Removed unused `dialogTitle` and `dialogDescription` variables. Dead code removal, no security impact.
- **`useBookStore.ts`**: Changed `setFilter` type signature from `string | undefined` to `string | string[] | undefined`. This is a type correction for filter arrays. No security impact.
- **`.gitignore`**: Added `.claude/settings.local.json` to gitignore. Positive security improvement (see Phase 7).

The majority of the remaining 50+ changed files are test files and review documentation -- these have no security impact.

### Findings

#### Blockers (critical vulnerabilities -- must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

**[src/app/hooks/useBookCoverUrl.ts:57](src/app/hooks/useBookCoverUrl.ts:57)** (confidence: 72): Unrecognized protocol values silently fall through to OPFS resolution.

This finding is carried forward from the prior review (2026-04-07) unchanged. The hook's protocol dispatch has only two explicit branches (`http://`, `https://`) and a catch-all that calls `opfsStorageService.getCoverUrl(bookId)`. If a `coverUrl` with an unexpected protocol (e.g., `data:image/png;base64,...`, `javascript:...`, `ftp://...`) were stored in the database, the hook would attempt to resolve it via OPFS, which would fail gracefully (returning null). Not exploitable today because: (a) `coverUrl` is set by the application during book import, not by user input; (b) the OPFS call ignores the `coverUrl` string entirely and uses only `bookId`; (c) the catch block returns null.

Defense-in-depth recommendation: add explicit `data:` protocol handling and warn on truly unknown protocols.

#### Informational (awareness only)

**[.mcp.json](/.mcp.json)** (confidence: 95): This file contains a Google API key (`X-Goog-Api-Key: AQ.Ab8R...`) in the `stitch` MCP server headers. It is tracked by git and has been since commit `f01a1d76`. It was NOT changed in this diff. This was reported in the prior review and remains unaddressed. Recommendation: add `.mcp.json` to `.gitignore` and use environment variable substitution (`${STITCH_API_KEY}`) supported by Claude Code's MCP config format.

**Positive note**: The `.claude/settings.local.json` file (which contained OpenAI `sk-proj-*` and ZAI API keys) was successfully removed from git tracking in this diff via the `.gitignore` addition. This resolves the informational finding from the prior review.

### Secrets Scan

**Diff scope: Clean** -- no secrets detected in the changed files. The 67 changed files include only source code (hooks, components, services), test files, documentation, and review reports. No API keys, tokens, or credentials in the diff.

**Out-of-scope (persistent)**: `.mcp.json` contains a Google API key and is tracked by git. Not part of this diff. See informational finding above.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No access control changes. Cover URL resolution does not gate premium content. |
| CS2: Client-Side Injection (XSS) | Yes | No | No `dangerouslySetInnerHTML`, `ref.innerHTML`, or `javascript:` protocol in changed files. `backgroundImage: url(${resolvedCoverUrl})` in AudiobookRenderer is safe: resolved URLs are blob:, http/https, or null. |
| CS3: Sensitive Data in Client Storage | No | No | No BYOK keys, tokens, or auth data involved. Cover URLs are not sensitive. |
| CS5: Client-Side Integrity | Yes | No | Blob URL lifecycle is properly managed with revocation in cleanup. `previousUrlRef` tracks URLs for revocation on prop changes. |
| CS7: Client-Side Security Logging | No | No | No console.log of sensitive data in changed source files. |
| CS9: Client-Side Communication | No | No | No postMessage, cross-window, or cross-origin communication in changed code. |
| A05: Security Misconfiguration | Yes | No (positive) | `.gitignore` now includes `.claude/settings.local.json`, removing API keys from tracking. Positive finding. |
| A06: Vulnerable Components | No | No | No `package.json` changes. No new dependencies. |
| A07: Auth Failures | No | No | No authentication or session changes. |

### What's Done Well

1. **`.claude/settings.local.json` removed from git tracking** -- The `.gitignore` addition in this diff removes a file containing real API keys (OpenAI, ZAI) from version control. This directly addresses the informational finding from the prior review and is a meaningful security improvement.

2. **Type safety improvement in `OpdsBrowser.tsx`** -- The `isAlreadyInLibrary` function now properly narrows the `b.source` union type with a type guard before accessing `.url`. This prevents potential runtime errors from accessing properties on the wrong variant of a discriminated union.

3. **Dead code removal** -- Unused variables (`StatusIcon`, `dialogTitle`, `dialogDescription`) were removed, reducing the attack surface and improving code clarity. Dead code can be a source of subtle bugs and makes security auditing harder.

4. **Consistent cover URL resolution across all components** -- The `useBookCoverUrl` hook is now used consistently in BookCard, BookListItem, AudioMiniPlayer, AudiobookRenderer, and LinkFormatsDialog (both BookPickerCard and the main dialog). This eliminates the previous pattern where raw `book.coverUrl` was passed directly to `<img src>`, which could have rendered non-displayable protocol URLs.

---
Phases: 7/8 | Findings: 3 total | Blockers: 0 | False positives filtered: 0
