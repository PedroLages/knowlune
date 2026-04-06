## External Code Review: E101-S04 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E101-S04

### Findings

#### Blockers

- **src/app/components/audiobook/AudiobookRenderer.tsx:103 (confidence: 90)**: **Stale closure in unmount cleanup.** `savePosition` is wrapped in `useCallback` with only `[book.id]` as a dependency, but it accesses `sharedAudioRef.current.currentTime` — meaning it reads a mutable ref correctly. However, `savePosition` is also called from the `isPlaying` effect (line 96). When playback *pauses*, `savePosition` fires. But the unmount effect (line 101) only captures the `savePosition` from the *last render* that changed `book.id`. Since `book.id` is stable, this is fine for single-book, but if `book.id` ever changes (e.g., navigating between two books without full unmount), the unmount cleanup of the *previous* book will fire `savePosition` with the *new* `book.id` — saving the wrong book's position under the wrong ID. **Fix**: Add a ref to track the current `book.id` and read it inside `savePosition`, or restructure the unmount effect to read the current book id from a ref.

- **src/app/hooks/useAudioPlayer.ts:288 (confidence: 85)**: **API key exposure in URL query parameters.** The stream URL is constructed as `getStreamUrl(book.source.url, absItemId, apiKey)` — this places the bearer token in the URL's query string (`?token=...`). The URL is then assigned to `audio.src`, which means the token is: (1) visible in browser DevTools Network tab, (2) logged in server access logs, (3) cached in browser history, (4) potentially leaked via Referer headers. The token is also trivially extractable from the DOM (`document.querySelector('audio').src`). This is a security vulnerability for any non-trivial deployment. **Fix**: Use the `Authorization: Bearer` header approach instead. Since `<audio>` elements don't support custom headers, consider using a Service Worker to inject the header, or fetch the stream via `fetch()` with headers and create a blob/object URL.

- **src/app/hooks/useAudioPlayer.ts:276-333 (confidence: 80)**: **Unhandled promise rejection in `loadChapter` for remote streaming.** The remote streaming block uses `await` (lines 301, 322, 333) inside `loadChapter` but has no try/catch. If `audio.play()` rejects (e.g., browser autoplay policy), or if the `canplay`/`error` promise rejects, the error propagates as an unhandled promise rejection. This can crash the UI or leave the player in an inconsistent state (`isLoading` stays `true`). **Fix**: Wrap the entire remote streaming block in a try/catch that sets `setIsLoading(false)` and shows a toast on failure.

#### High Priority

- **src/app/components/audiobook/AudiobookRenderer.tsx:107-113 (confidence: 90)**: **Race condition on position restore vs. chapter load.** The position restore effect fires after a 500ms `setTimeout` to seek to the saved position. But the remote streaming path in `loadChapter` awaits `canplay` which may take longer than 500ms on slow connections. The seek may execute before the stream is ready, causing it to fail silently or seek to 0. **Fix**: Instead of a blind timeout, seek after the audio fires `canplay` or `loadedmetadata`. Use a callback/event-driven approach or seek inside the `loadChapter` completion path.

- **src/app/hooks/useAudioPlayer.ts:310-317 (confidence: 75)**: **`revokeSharedObjectUrl()` called before setting new remote URL can break.** When switching from an OPFS-backed book to a remote book, `revokeSharedObjectUrl()` destroys the previous blob URL, then `audio.src = streamUrl` sets the new URL. But if the stream URL load fails (rejected promise at line 314), `audio.src` is now the failed URL and `_loadedBookId` is already set to `book.id` (line 299). On retry, the condition `_loadedBookId !== book.id` is `false`, so the stream is never reloaded — the player is stuck. **Fix**: Only set `_loadedBookId = book.id` after the stream loads successfully (after the await on line 314 resolves). Also, consider resetting `_loadedBookId` in the error path.

#### Medium

- **src/app/hooks/useAudioPlayer.ts:194-199 (confidence: 70)**: **`handleError` doesn't clean up event listeners from the pending `loadChapter` promise.** If an error occurs during streaming (triggering `handleError`), any pending `canplay`/`error` listeners attached inside `loadChapter` (lines 307-314) will still be registered. When they eventually fire (or if the audio element is reused), they can resolve/reject a stale promise, causing unexpected behavior. **Fix**: In `handleError`, check if there's a pending load operation and reject it, or use an AbortController to cancel pending operations.

- **src/app/hooks/useAudioPlayer.ts:280-282 (confidence: 65)**: **`absItemId` and `apiKey` extraction is fragile.** `const apiKey = auth && 'bearer' in auth ? auth.bearer : ''` — if `auth` is `{ username, password }` (OPDS Basic Auth for a remote source), `apiKey` becomes `''`, and the function shows "Cannot stream: missing server configuration". But the user *has* configured auth — just not bearer auth. The error message is misleading. **Fix**: Either support Basic Auth for streaming, or differentiate the error message to indicate that bearer token auth is required for ABS streaming.

---
Issues found: 7 | Blockers: 3 | High: 2 | Medium: 2 | Nits: 0
