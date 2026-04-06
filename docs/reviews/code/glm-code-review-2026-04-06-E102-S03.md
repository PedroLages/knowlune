## External Code Review: E102-S03 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E102-S03

### Findings

#### Blockers

- **[src/stores/useAudiobookshelfStore.ts:207 (confidence: 95)]**: `loadCollections` calls `collectionsLoaded` guard and then fetches from a server resolved by `serverId`, but `collectionsLoaded` is a single boolean shared across all servers. If the user connects server A, loads collections, then switches to server B, `loadCollections(serverB.id)` will short-circuit and never fetch server B's collections. The stale data from server A will be displayed instead. The same bug exists in `loadSeries` (line ~185), which uses `seriesLoaded` the same way. Fix: Either key the loaded flag per server (e.g., `collectionsLoadedServerId: string | null` and compare against the requested serverId), or reset `collectionsLoaded` to `false` whenever the active server changes, or always remove the guard and let the UI handle caching semantics.

#### High Priority

- **[src/stores/useAudiobookshelfStore.ts:213 (confidence: 88)]**: `loadCollections` accepts only `serverId` but `fetchCollections` requires `url` and `apiKey` which come from the stored server record. The server lookup `get().servers.find(...)` may return nothing if servers haven't been loaded yet (e.g., on fresh mount). Unlike `loadSeries` which also takes a `libraryId`, there's no explicit error/toast when the server is not found — it silently returns, leaving the UI in loading state forever since `isLoadingCollections` is never set to `false`. Fix: Set `isLoadingCollections = false` before returning when server is not found, or show a toast indicating the server could not be resolved.

#### Medium

- **[src/app/components/library/CollectionCard.tsx:48-51 (confidence: 75)]**: The first connected server is used for cover URLs (`servers.find(s => s.status === 'connected')`), but a user can have multiple connected servers. The cover URL will always resolve against the first connected server, which may not be the server that owns the collection. This produces broken images or wrong covers. Fix: Determine the owning server from the collection data (e.g., via `libraryId` mapping) or pass the server ID through from the parent where it's already known.

- **[src/app/pages/Library.tsx:329-335 (confidence: 70)]**: When the user clicks the Collections tab, `loadCollections` is called with `connectedServer.id`, but `CollectionsView`'s own `useEffect` also calls `loadCollections` with the same server ID. On first click, both fire simultaneously — the tab's `onClick` and the mount effect. This causes a double fetch and potential race with the loading state. Fix: Remove the eager load from the tab's `onClick` and let `CollectionsView`'s `useEffect` be the sole trigger, or vice versa.

- **[src/app/components/library/CollectionCard.tsx:116 (confidence: 65)]**: When `server` is falsy (no connected server), expanded books show a `BookOpen` fallback icon but no cover. However, the collapsed header's cover URL is already guarded with `server && firstBookId`. If the server disconnects while a card is expanded, book covers will silently break (showing fallback) while the header still shows the cached `img` `src`. This is a minor UX inconsistency but worth noting. No code change strictly needed.

#### Nits

— None —

---
Issues found: 5 | Blockers: 1 | High: 1 | Medium: 3 | Nits: 0
