# Security Review — E88-S03: Remote EPUB Streaming (2026-04-05)

## Scope

Files reviewed: `BookContentService.ts`, `BookReader.tsx`, `BookContentService.test.ts`
Stack: React 19, TypeScript, Vite 6, Cache API, fetch API

## Findings

### HIGH

**S1 — Credentials sent over any URL scheme** — `BookContentService.ts:87-90`

Basic auth credentials are sent regardless of whether the URL uses HTTPS or HTTP. Over plain HTTP, credentials are transmitted in cleartext. Consider validating that `source.url` starts with `https://` before including auth headers, or at minimum logging a warning.

### MEDIUM

**S2 — No URL validation before fetch** — `BookContentService.ts:92`

The `source.url` is passed directly to `fetch()` without validation. A malicious or malformed URL (e.g., `javascript:`, `file:///`, or an internal network address) could be problematic. The browser's fetch API already rejects `javascript:` URLs, but adding URL scheme validation (`http://` or `https://` only) would be a defense-in-depth measure.

### INFO

**S3 — Cache API stores unencrypted EPUBs** — `BookContentService.ts:165-177`

Cached EPUBs are stored as raw ArrayBuffers in the Cache API. This is standard browser behavior and Cache API data is origin-scoped, so this is not a vulnerability. However, on shared devices, cached content persists until evicted. The LRU eviction at 10 books is a reasonable limit.

**S4 — `btoa()` for Basic auth is standard** — `BookContentService.ts:89`

Using `btoa()` for Basic auth encoding is the standard approach. The non-ASCII issue (covered in code review H1) is a functionality bug, not a security issue per se.

## Phases Executed

- Phase 1: Input validation (URL, credentials) -- findings S1, S2
- Phase 2: Authentication/authorization -- finding S1
- Phase 3: Data storage -- finding S3
- Phase 8.1: Secrets scan -- no hardcoded secrets found
- Phase 8.2: Dependency check -- npm audit shows 6 high vulns (upstream, not story-related)
- Phase 8.5: CORS -- story depends on server CORS headers (documented in story notes)

## Verdict

1 HIGH (HTTP credential leak), 1 MEDIUM (URL validation). No blockers. The HTTP credential issue is worth addressing but is mitigated by the fact that Calibre-Web typically runs on local networks or with HTTPS.
