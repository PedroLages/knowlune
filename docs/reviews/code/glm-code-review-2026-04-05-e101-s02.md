## External Code Review: e101-s02 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: e101-s02

### Findings

#### Blockers
*(none)*

#### High Priority
- **[src/stores/useAudiobookshelfStore.ts:33 (confidence: 85)]**: `addServer` uses `db.audiobookshelfServers.put(server)` which silently overwrites an existing record if the `id` already exists. While a UUID collision is astronomically rare, semantically `add()` is the correct operation and fails fast on duplicates, which is the expected behavior for an "add" action. The `updateServer` method is the proper place for overwrite semantics. Fix: Change `await db.audiobookshelfServers.put(server)` to `await db.audiobookshelfServers.add(server)` to enforce uniqueness.

- **[src/app/components/library/AudiobookshelfSettings.tsx:179 (confidence: 90)]**: `handleSave` has no error handling around the async `await addServer(...)` / `await updateServer(...)` calls. If either throws (e.g., IndexedDB quota exceeded, constraint violation), the error is an unhandled promise rejection. The store methods themselves do catch internally and show a toast, but `handleSave` continues executing unconditionally afterward, setting `isSaving(false)`, calling `resetForm()`, and transitioning to `mode='list'` even on failure — making it appear the save succeeded. Fix: Check if the store operation actually failed (e.g., have the store methods return a boolean or throw), and only transition to list mode on success. At minimum, wrap in try/catch.

#### Medium
- **[src/app/components/library/AudiobookshelfSettings.tsx:118 (confidence: 75)]**: `handleTestConnection` continues to fetch libraries even when `connResult.data` has no useful version info (e.g., if `serverVersion` is undefined). More importantly, the `selectedLibraryIds.length === 0` auto-selection check on line 141 captures a stale closure over `selectedLibraryIds` — the `useCallback` dependency array includes `selectedLibraryIds.length`, but the actual array content could differ between renders. Since `handleTestConnection` is async and `setSelectedLibraryIds` is also async state, calling `setSelectedLibraryIds` inside this callback based on the *length* from closure is fragile if the user toggles checkboxes while the test is running. Fix: Use a ref for `selectedLibraryIds` or a functional state update pattern: `setSelectedLibraryIds(prev => prev.length === 0 ? libResult.data.map(lib => lib.id) : prev)`.

- **[src/app/components/library/AudiobookshelfSettings.tsx:196 (confidence: 70)]**: In edit mode, if the user changes the URL but does *not* type a new API key, `effectiveApiKey` resolves to the old `existingApiKey`. The `updates` object will *not* include `apiKey` (only set when `apiKey.trim()` is truthy). This means the URL is updated in the `status: 'connected'` record without re-testing the new URL + old key combination, potentially leaving stale connection state. This is a design choice but could lead to confusing UX where a server shows "Connected" but the URL is untested. Fix: Consider clearing `testResult` on URL change in edit mode (already done via `onUrlChange`), which disables the Save button until re-tested — but the current code only clears testResult, it doesn't prevent save via other paths. Verify the disabled state on the Save button holds in edit mode when URL changes (it does via `!testPassed`). This is acceptable but worth noting the implicit dependency.

#### Nits
- **[src/app/components/library/AudiobookshelfServerCard.tsx:27 (confidence: 95)]**: `STATUS_CONFIG` is typed `as const` but `server.status` is typed as `string` in `AudiobookshelfServer`. If a server has a status not in the config (e.g., a new enum value added later), `STATUS_CONFIG[server.status]` returns `undefined`, causing `status.icon` to throw. Fix: Add a fallback: `const status = STATUS_CONFIG[server.status] ?? STATUS_CONFIG['offline']` or type-narrow `server.status`.

---
Issues found: 4 | Blockers: 0 | High: 2 | Medium: 2 | Nits: 1
