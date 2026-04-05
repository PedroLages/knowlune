# Edge Case Review — E88-S03: Remote EPUB Streaming (2026-04-05)

## Unhandled Edge Cases

**[BookContentService.ts:87-89]** -- `source.auth.username` contains colon character
> Consequence: RFC 7617 Section 2 states the user-id MUST NOT contain a colon. If `username` contains `:`, the server will parse credentials incorrectly (splitting on first `:`).
> Guard: Validate or escape colon in username before encoding.

**[BookContentService.ts:92]** -- `source.url` is an empty string or whitespace
> Consequence: `fetch('')` resolves relative to the current page URL, potentially making an unintended request to the app's own origin.
> Guard: `if (!source.url?.trim()) throw new RemoteEpubError('No URL configured', 'network', false)`

**[BookContentService.ts:126]** -- Response body is not valid EPUB (e.g., HTML error page returned with 200 status)
> Consequence: `response.arrayBuffer()` succeeds but epub.js fails to parse the content, producing an opaque error. The invalid content gets cached.
> Guard: Check `Content-Type` header or first bytes for EPUB magic number (`PK\x03\x04`) before caching.

**[BookReader.tsx:457-488]** -- User clicks "Read cached version" while a retry is already in progress
> Consequence: Two async operations compete to set `epubUrl`, potentially causing a flash or stale blob URL.
> Guard: Disable the cached button while `isLoadingContent` is true (already partially mitigated by the `isLoadingContent` check hiding the error UI).

---
**Total:** 4 unhandled edge cases found.
