# Security Review — E88-S03: Remote EPUB Streaming (2026-04-05, Round 2)

## Scope

Files reviewed: `BookContentService.ts`, `BookReader.tsx`, `BookContentService.test.ts`
Stack: React 19, TypeScript, Vite 6, Cache API, fetch API

## Round 1 Fix Verification

- **S1 (HIGH) — HTTP credential warning**: FIXED. `console.warn` emitted when URL is `http://` with credentials (BookContentService.ts:98-103).
- **S2 (MEDIUM) — URL validation**: FIXED. Rejects non-http/https URLs before fetch (BookContentService.ts:87-93).

## Findings

### HIGH

(None — Round 1 HIGH fixed)

### MEDIUM

(None — Round 1 MEDIUM fixed)

### INFO

**S3 — Cache API stores unencrypted EPUBs** — `BookContentService.ts:184-198`

Cached EPUBs are stored as raw ArrayBuffers. Cache API data is origin-scoped. Not a vulnerability, but on shared devices cached content persists until evicted. LRU eviction at 10 books is reasonable.

**S4 — UTF-8 auth encoding is correct** — `BookContentService.ts:105-107`

TextEncoder + base64 encoding handles non-ASCII credentials correctly per RFC 7617. No security concern.

## Phases Executed

- Phase 1: Input validation (URL, credentials) -- S1, S2 both fixed
- Phase 2: Authentication/authorization -- HTTP warning added
- Phase 3: Data storage -- finding S3 (informational)
- Phase 8.1: Secrets scan -- no hardcoded secrets found
- Phase 8.2: Dependency check -- npm audit shows 6 high vulns (upstream, not story-related)
- Phase 8.5: CORS -- documented in story notes, error message includes CORS guidance

## Verdict

0 blockers, 0 HIGH, 0 MEDIUM. All Round 1 security findings addressed. No new security concerns.
