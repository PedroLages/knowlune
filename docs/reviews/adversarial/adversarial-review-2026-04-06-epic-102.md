# Adversarial Review — Epic 102: Audiobookshelf Sync & Discovery (Growth)

**Date:** 2026-04-06
**Reviewer:** Adversarial Review Agent
**Scope:** E102-S01 through E102-S04 — all story files, `AudiobookshelfService.ts`, `useAudiobookshelfStore.ts`, `useAudiobookshelfSocket.ts`

---

## Findings

1. **`isConnected` state is stale — `useAudiobookshelfSocket` returns wrong value**
   `useAudiobookshelfSocket` returns `connectionRef.current?.isConnected ?? false`. `connectionRef` is a `useRef` — mutating it does not trigger a re-render. The `forceUpdate.current += 1` mutation also does nothing because it is never read by React's rendering system. The hook's return value will report `false` even after a successful handshake until the component re-renders for an unrelated reason. Any component that gates REST fallback on `isSocketConnected` receives a perpetually stale `false`, meaning socket and REST polling run simultaneously and push duplicate progress updates to ABS.

2. **`seriesLoaded` and `collectionsLoaded` are shared across all servers — switching servers loads stale data**
   The `isLoaded` guards for series and collections use a single boolean that ignores which `serverId` was loaded. If a user switches to a different ABS server (or changes the selected library), `loadSeries()` and `loadCollections()` return immediately with data from the previous server. The store never invalidates the cache on server change. Users browsing a second server will see the first server's series and collections, with no indication that data is wrong.

3. **API key exposed in WebSocket URL as a query parameter — visible in browser devtools and server logs**
   `connectSocket()` appends `?token=${encodeURIComponent(apiKey)}` to the WebSocket URL. WebSocket URLs (including query parameters) are logged in browser developer tools' Network tab and in any reverse-proxy/server access log. The ABS Socket.IO client sends the token in the `auth` payload of the Socket.IO handshake packet instead (`"40" + JSON.stringify({ token })`), which stays in the WebSocket message frame and is not logged by default. The implementation uses the insecure query-parameter approach for the initial WebSocket upgrade and again sends it in the `40` packet — the key is transmitted twice, once in the URL and once in the message.

4. **`pendingSyncQueue` is unbounded and silently grows without eviction policy**
   The sync queue replaces existing entries for the same `itemId` (deduplication), but has no size cap, no age-based eviction, and no maximum retry count. If a server stays unreachable for an entire listening session, every chapter completion and session end enqueues an item. If the server never comes back online, the queue stays populated in memory indefinitely for the session. Furthermore, `flushSyncQueue()` iterates the full queue sequentially without parallelism — for a queue of 50 items, this blocks the store update for up to 50 × 10 s (500 s) before completing.

5. **`fetchCollections` ignores pagination — only first page of collections is returned**
   `fetchCollections()` calls the `/api/collections` endpoint once and returns `result.data.results`. The ABS API response includes `total`, `page`, and `limit` fields, and the endpoint is paginated (default limit: 10). Libraries with more than 10 collections silently return an incomplete list. Compare to `loadSeries()` which correctly implements multi-page fetching — `fetchCollections()` does not. Users with large collections libraries will see a truncated list with no indication that data is missing.

6. **`getLWW` conflict resolution compares position values (seconds), not timestamps, in `useAudiobookshelfSocket`**
   The Socket.IO conflict resolution in `useAudiobookshelfSocket` compares `event.currentTime > localSeconds` (a position-based comparison), while the REST sync in E102-S01 uses `absProgress.lastUpdate` vs `localBook.lastOpenedAt` (a timestamp comparison). These are inconsistent strategies. Position-ahead is not equivalent to timestamp-newer: a user who rewound a chapter intentionally would have their position overwritten by the socket event bearing the older (higher) timestamp. The two LWW implementations diverge in behavior despite the story spec requiring them to be identical.

7. **`useAudiobookshelfSocket` effect dependency array omits `handleProgressUpdate` from the push-on-pause effect**
   The push-on-pause `useEffect` closes over `activeItemId` but the exhaustive-deps rule should also flag `handleProgressUpdate` (or at least note the missing deps). More critically, the periodic push interval effect's dependency array is `[isPlaying, activeItemId]`, but `currentTimeRef` and `connectionRef` are accessed inside — these are refs and do not need to be deps, which is correct, but `bookRef` is also used for `totalDuration` without the effect re-registering if `totalDuration` changes. If a book's total duration is updated mid-session (e.g., due to a metadata sync), the push payload will carry stale duration data.

8. **`_unsub` is stored as an ad-hoc property on a typed object using a type assertion — fragile and bypasses TypeScript**
   The `onProgressUpdate` unsubscribe function is stored as `(connection as { _unsub?: () => void })._unsub = unsub`. This casts a typed `AbsSocketConnection` to an ad-hoc anonymous type to smuggle a callback into it. If `connectSocket()` ever resets the connection object, the stored `_unsub` is orphaned. A `useRef` for the unsubscribe function is the correct pattern and eliminates the cast entirely. This is a design smell that would fail any principled code review.

9. **`E102-S04` story skipped multiple review gates — design review, performance benchmark, security review, exploratory QA all marked `-skipped`**
   The story frontmatter shows `design-review-skipped`, `performance-benchmark-skipped`, `security-review-skipped`, and `exploratory-qa-skipped`. While the story has no UI, the security review is particularly significant given that this story adds WebSocket connections with API key transmission. The security gate should not have been skipped for a story that introduces a new authenticated transport channel. The API key in the WebSocket URL (finding #3) would have been caught by any OWASP-aware security reviewer.

10. **`connectSocket` silently succeeds even when WebSocket constructor throws — callers cannot distinguish unavailable from degraded**
    The `try/catch` around `new WebSocket(wsUrl)` catches constructor exceptions (invalid URL), logs a `console.warn`, and returns a connection object with `isConnected: false` and `ws: null`. The hook's `onReady` callback is never called, and `onDisconnect` is never called either. The caller (`useAudiobookshelfSocket`) has no way to know whether the socket was never attempted, failed immediately, or is still in progress. The REST fallback only activates when `onDisconnect` fires — if the constructor throws, the fallback never triggers via the callback path. The hook will silently report `isSocketConnected: false` without REST taking over via the explicit `onDisconnect` path (it will still work via the stale-false issue in finding #1, but for the wrong reason).

11. **`loadSeries` pagination error handling silently terminates mid-load without setting `seriesLoaded`**
    In `loadSeries()`, if a page beyond the first fails (`if (!nextResult.ok) break`), the loop breaks and the function sets `seriesLoaded: true` with a partial dataset. The user has no indication that series data is incomplete. The error is swallowed — `toast.error()` is only called on first-page failure. A partial series list that looks complete is worse than a visible error — users will trust incomplete data without any signal that something went wrong.

12. **ABS Socket.IO event name `update_media_progress` is unverified — ABS source uses a different name**
    `pushProgressViaSocket()` emits `update_media_progress`. The story implementation notes reference ABS `server/SocketAuthority.js` for the correct event name, and note that "event names may have changed." The ABS source in v2.x actually uses `media_progress_updated` (server-to-client) and processes client push via the REST PATCH endpoint — not a client-emitted socket event. There is no evidence in the ABS source that ABS accepts `update_media_progress` from clients via Socket.IO. The push path via socket may be entirely non-functional, silently failing without error or fallback.

---

**Total findings: 12**

**Critical (would cause user-visible data corruption or silent data loss):**
- Finding #1: stale `isSocketConnected` → double-push to ABS on every session
- Finding #2: stale series/collections data when switching ABS servers
- Finding #5: truncated collections list (pagination ignored)
- Finding #6: inconsistent LWW strategy → unintentional position overwrites
- Finding #12: `update_media_progress` socket event likely non-functional in ABS

**High (security or correctness concern):**
- Finding #3: API key in WebSocket URL (logged in plaintext)
- Finding #9: security review gate skipped for authenticated transport story

**Medium (maintainability, reliability):**
- Finding #4: unbounded sync queue, sequential flush
- Finding #8: `_unsub` stored via type cast
- Finding #10: silent constructor failure bypasses REST fallback callback
- Finding #11: partial series load marked as complete without error
