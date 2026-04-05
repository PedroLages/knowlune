## External Code Review: E101-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E101-S01

### Findings

#### Blockers
- **[src/services/AudiobookshelfService.ts:61](https://github.com/.../src/services/AudiobookshelfService.ts#L61) (confidence: 95)**: **Timeout never fires — AbortController timeout is a no-op with fake timers in tests, and critically, the timeout is cleared in the catch block.** The `setTimeout` callback calls `controller.abort()`, but if `fetch` hangs (the very case the timeout is meant to handle), the `await fetch()` never completes, `clearTimeout(timeoutId)` is never reached in the `try`, and the `setTimeout` lambda never fires either if `fetch` is in an uninterruptible native state. More importantly, in the test suite, `vi.useFakeTimers()` is called in `beforeEach` but `vi.advanceTimersByTime(10_000)` is never invoked. This means the timeout path is **completely untested** — the `AbortError` test only passes because `fetch` is mocked to reject *immediately* with an `AbortError`, never actually testing that the timeout triggers it. The timeout race condition is unverified.
  Fix: In the `AbortError` test, mock `fetch` to return a pending promise that never resolves, then call `vi.advanceTimersByTime(10_000)` and assert the timeout error. Consider also using `AbortSignal.timeout()` or ensuring the timeout callback is guaranteed to fire even if fetch is suspended.

- **[src/services/AudiobookshelfService.ts:55](https://github.com/.../src/services/AudiobookshelfService.ts#L55) (confidence: 80)**: **Timer leak when `response.json()` throws.** If the server returns a 200 response with an invalid/malformed JSON body, `response.json()` throws a `SyntaxError`. This error is caught by the `catch` block, which calls `clearTimeout(timeoutId)` — but the timeout was already cleared on line 47 for the successful response. The real issue is that a `SyntaxError` from malformed JSON is caught by the generic catch and returns the misleading error `"Could not connect to server. Check the URL and try again."` instead of indicating a parse failure. This silently masks server-side bugs.
  Fix: Add a specific check for `SyntaxError` in the catch block to return a more accurate error like `"Received invalid response from server."` Alternatively, parse JSON inside the try block before the first `clearTimeout`, or use a separate try/catch around `response.json()`.

#### High Priority
- **[src/services/AudiobookshelfService.ts:108](https://github.com/.../src/services/AudiobookshelfService.ts#L108) (confidence: 90)**: **`libraryId` is interpolated directly into the URL path without validation or encoding.** If `libraryId` contains special characters (e.g., `../`, `?`, `#`, or URL-encoded slashes), it could manipulate the request path. For `searchLibrary` (line 169), the `query` parameter is properly encoded with `encodeURIComponent`, but `libraryId` is not. Same issue in `fetchItem` (line 126) for `itemId`. While these IDs typically come from previous API responses and are safe UUIDs, defensive encoding should still be applied.
  Fix: Use `encodeURIComponent(libraryId)` and `encodeURIComponent(itemId)` in all URL template literals, e.g., `` `/api/libraries/${encodeURIComponent(libraryId)}/items` ``.

- **[src/services/AudiobookshelfService.ts:138](https://github.com/.../src/services/AudiobookshelfService.ts#L138) (confidence: 85)**: **`getCoverUrl` does not include authentication, leaking the API key pattern inconsistency.** The `getStreamUrl` correctly includes a `token` query parameter for auth, but `getCoverUrl` returns an unauthenticated URL. When the ABS server has authentication enabled (which is the common case for non-local deployments), this cover URL will return a 401/403 and images won't load. This creates a silent failure where covers appear broken with no error message.
  Fix: Add the token parameter: `` `${baseUrl}/api/items/${encodeURIComponent(itemId)}/cover?token=${encodeURIComponent(apiKey)}` `` — or accept `apiKey` as a parameter to `getCoverUrl` and include it. Document if covers are expected to be public on the target ABS config.

#### Medium
- **[src/services/AudiobookshelfService.ts:148](https://github.com/.../src/services/AudiobookshelfService.ts#L148) (confidence: 75)**: **`baseUrl` / `url` parameter is never validated or normalized.** If a user provides a URL with a trailing slash (e.g., `"http://192.168.1.50:13378/"`), the constructed URLs become `"http://192.168.1.50:13378//api/ping"` with a double slash. While most servers handle this, it can cause issues with some reverse proxies or strict CORS configurations. There's no trimming or validation anywhere.
  Fix: Normalize the base URL by trimming trailing slashes: `const base = url.replace(/\/+$/, '')` at the top of `absApiFetch`, or validate/normalize at the point of user input.

#### Nits
- **[src/services/__tests__/AudiobookshelfService.test.ts:27-33](https://github.com/.../src/services/__tests__/AudiobookshelfService.test.ts#L27) (confidence: 70)**: **`Response` constructor used in test mocks may not include `ok` property in all test environments.** The `mockFetchJson` and `mockFetchStatus` helpers create `new Response(...)` but never set `ok`. In most environments, `Response` auto-sets `ok` based on status, but if the test runner uses a minimal polyfill, `response.ok` in the service code could be `undefined`, causing all error-branch logic to be skipped. Worth verifying the `ok` field is present on constructed `Response` objects in the actual test environment.

---
Issues found: 6 | Blockers: 2 | High: 2 | Medium: 1 | Nits: 1
