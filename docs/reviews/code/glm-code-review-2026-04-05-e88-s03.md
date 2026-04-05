## External Code Review: e88-s03 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-05
**Story**: e88-s03

### Findings

#### Blockers
(None)

#### High Priority
- **[src/services/BookContentService.ts:97 (confidence: 90)]**: **`btoa(String.fromCharCode(...encoded))` throws `RangeError` for large credentials.** The spread operator passes every byte as a separate argument to `String.fromCharCode`. JavaScript functions have an argument-count limit (~65,535 in V8). A username+password exceeding ~65KB will crash at runtime with `RangeError: Maximum call stack size exceeded`. While unlikely for normal credentials, this is a correctness regression from the original `btoa()`. Fix: Use a chunked approach, e.g., `const binary = Array.from(encoded, b => String.fromCharCode(b)).join('')` or `String.fromCharCode.apply(null, encoded)` with chunking for very large inputs.

#### Medium
- **[src/app/pages/BookReader.tsx:485-487 (confidence: 92)]**: **`handleLoadCached` never sets `isLoaded` to true after setting the epub URL.** The render guard at line ~577 is `!isLoadingContent && isLoaded` to show the EpubRenderer. After `handleLoadCached` runs, `isLoadingContent` is `false` but `isLoaded` remains its previous value. If this is the *first* successful load (e.g., remote fetch failed, then user clicked "Read cached version"), `isLoaded` is still `false` and the `LoadingSkeleton` remains visible forever — the EpubRenderer never mounts. Fix: Set `setIsLoaded(true)` after `setEpubUrl(url)` in the success path (line ~485), or verify that the EpubRenderer mount lifecycle sets `isLoaded` (it appears to via `onRenditionReady` in the existing code — but if so, there's a flash of skeleton during the gap, and the comment/docs should note this dependency explicitly).

- **[src/services/BookContentService.ts:91-93 (confidence: 80)]**: **Auth header is sent even when `username` is an empty string `""`.** The guard is `if (source.auth?.username)`, which is falsy for `undefined`, `null`, and `""`. However, if `source.auth` is `{ username: "", password: "secret" }`, the condition evaluates to falsy and auth is correctly skipped. The real concern is the inverse: if `username` is truthy but `password` is `undefined`, the credential string becomes `"admin:undefined"`. Fix: Validate that both `username` and `password` are present non-empty strings before constructing auth headers, e.g., `if (source.auth?.username && source.auth?.password)`.

#### Nits
- **[src/services/BookContentService.ts:96-98 (confidence: 60)]**: **`clearTimeout(timeoutId)` is called twice for RemoteEpubError paths.** On line 88, `clearTimeout` runs after a successful response. If the response status triggers a RemoteEpubError (e.g., 401/404/500), the error is thrown, caught by the outer `catch` on line ~131, and `clearTimeout(timeoutId)` is called again on line ~133. Harmless since calling `clearTimeout` on an already-cleared timer is a no-op, but the asymmetry makes the control flow harder to reason about.

---
Issues found: 4 | Blockers: 0 | High: 1 | Medium: 2 | Nits: 1
