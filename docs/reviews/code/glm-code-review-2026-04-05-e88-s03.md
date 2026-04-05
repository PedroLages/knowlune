## External Code Review: E88-S03 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-05
**Story**: E88-S03

### Findings

#### Blockers
- **[src/services/BookContentService.ts:90-92] (confidence: 90)**: **Credentials stored and sent in plaintext.** `source.auth.password` is stored as plaintext in the `Book` record (IndexedDB/Dexie) and transmitted via HTTP Basic Auth (`btoa` is not encryption — just base64). On a non-HTTPS connection (common for local Calibre servers like `calibre.local`), credentials are exposed in clear text on the wire. This is a real security concern for a feature that handles user credentials to remote catalog servers. Fix: At minimum, warn users about non-HTTPS in the UI when configuring catalog auth. Ideally, do not persist plaintext passwords — use the Credential Management API or prompt at fetch time. If plaintext storage is intentional for this MVP, document the risk and ensure the UI communicates it to users.

#### High Priority
- **[src/services/BookContentService.ts:98] (confidence: 75)**: **ArrayBuffer may be neutered/detached after caching.** `response.arrayBuffer()` is called, and then the same `arrayBuffer` reference is both returned to the caller and passed to `cacheEpub`. If the `ArrayBuffer` is transferred or neutered by any intermediary (e.g., a future change to pass it to a Worker), the cache write silently gets an empty buffer. Currently safe because both operations just read from the same memory, but this is fragile — the `Response` constructed in `cacheEpub` from the same buffer could fail if the buffer were consumed. Fix: Clone the buffer for caching: `this.cacheEpub(bookId, arrayBuffer.slice(0))` to defensively decouple the consumer's buffer from the cached copy.

#### Medium
- **[src/services/BookContentService.ts:104] (confidence: 85)**: **`clearTimeout` called twice on non-RemoteEpubError paths — redundant but harmless.** In the outer `catch`, `clearTimeout(timeoutId)` is called, but `timeoutId` was already cleared on the success path (line 87). However, on abort/network errors where the inner `catch` is reached, the timeout may have already fired and `clearTimeout` was never called on the success path — so this is actually correct for error paths. On `RemoteEpubError` paths (auth/not-found/server), `clearTimeout` was called on line 87, and then again on line 104 before the `if (err instanceof RemoteEpubError)` re-throw. This is harmless but indicates the timeout cleanup logic is subtle. Not flagging as a real issue.

- **[src/services/BookContentService.ts:148] (confidence: 80)**: **`Response` constructed from `ArrayBuffer` without the correct MIME type.** `cacheEpub` creates a `new Response(buffer, { headers: { 'X-Cached-At': ... } })` but doesn't set `Content-Type: application/epub+zip`. While `getCachedEpub` only calls `.arrayBuffer()` so it doesn't matter functionally, it's semantically incorrect and could cause issues if the cached `Response` were ever read differently (e.g., streaming). Fix: Add `'Content-Type': 'application/epub+zip'` to the headers.

- **[src/services/BookContentService.ts:125-133] (confidence: 70)**: **`evictOldestIfNeeded` reads all cached responses fully just to check timestamps.** For each key, it calls `cache.match(request)` which deserializes the entire EPUB ArrayBuffer from IndexedDB just to read the `X-Cached-At` header. With 10 cached EPUBs (potentially tens of MB each), this is expensive. Fix: Consider storing just the metadata (bookId → timestamp) in a separate lightweight store (e.g., a single IndexedDB record or a meta-cache entry), or read only headers using a streaming approach.

- **[src/app/pages/BookReader.tsx:455-487] (confidence: 85)**: **`handleLoadCached` doesn't set `isLoaded = true`.** After successfully loading the cached EPUB and setting `epubUrl`, the code sets `setIsLoadingContent(false)` but never calls `setIsLoaded(true)`. Looking at the render logic (line 570), content is shown when `!isLoadingContent && isLoaded`, so the reader will show nothing after loading the cached version — the `EpubRenderer` won't mount. Fix: Add `setIsLoaded(true)` after successfully setting `setEpubUrl(url)` on line 482, or verify that `isLoaded` is set elsewhere in the flow (it's likely set via the `onRenditionReady` callback from `EpubRenderer`, which may be triggered by the `epubUrl` change — if so, document this dependency).

- **[src/services/BookContentService.ts:148-154] (confidence: 65)**: **Race condition on concurrent `cacheEpub` calls.** If two fetches complete near-simultaneously and both call `cacheEpub`, they both read the current key count, both see ≤ MAX, and both write — resulting in MAX+1 entries until the next eviction cycle. Fix: This is mitigated by eviction running on every write, so the next `cacheEpub` call will clean up. Low practical impact, but worth noting for correctness.

#### Nits
- **[src/app/pages/BookReader.tsx:477] (confidence: 60)**: The silent catch in `handleLoadCached` has a comment saying the error surfaces as a user-visible error below, but the toast and `setLoadError` immediately follow in the same `catch` block — the comment is slightly misleading about where the error surfaces.

---
Issues found: 5 | Blockers: 1 | High: 1 | Medium: 3 | Nits: 1
