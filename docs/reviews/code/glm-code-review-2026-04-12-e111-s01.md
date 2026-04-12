## External Code Review: E111-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-12
**Story**: E111-S01

### Findings

#### Blockers

- **[src/stores/useAudioClipStore.ts:70-74] (confidence: 95)**: **Race condition in `addClip` — duplicate sortOrder values under concurrent calls.** The `addClip` method reads `maxSortOrder` from Dexie in an async call, then writes a new clip with `maxSortOrder + 1`. If two `addClip` calls execute concurrently (e.g., rapid double-tap completing two clips), both can read the same max value and write clips with identical `sortOrder`, violating the uniqueness assumption that `reorderClips` and the sorted query rely on. Fix: Wrap the read-compute-write in a Dexie `db.transaction('rw', db.audioClips, ...)` to serialize access, or use `Dexie.currentTransaction` pattern. Alternatively, compute `Math.max(...state.clips.map(c => c.sortOrder), -1) + 1` from the already-loaded in-memory state (which is synchronous) since `loadClips` is called first and state is the source of truth during a session.

- **[src/stores/useAudioClipStore.ts:53-58] (confidence: 90)**: **`loadClips` silently swallows errors — `isLoaded` never set to `true` on query failure, permanently disabling the store.** If `db.audioClips.where(...)` throws (IndexedDB quota, corrupted DB, browser private-mode restrictions), the catch block shows a toast but never sets `isLoaded = true`. Any component gated on `isLoaded` will remain permanently in a loading/skeleton state. The user has no way to recover besides reloading. Fix: Set `isLoaded: true` in the catch block as well (with `clips: []`), or introduce a distinct `error` state so the UI can show a retry prompt.

- **[src/stores/useAudioClipStore.ts:96-103] (confidence: 88)**: **Optimistic `deleteClip` rollback is broken — rollback replaces entire state with stale snapshot.** The rollback closure captures `previousClips` at delete-call time. If any other state mutation (e.g., a concurrent `updateClipTitle` or `reorderClips`) succeeds between the optimistic delete and the Dexie failure, the rollback restores the *stale* snapshot, silently undoing those other successful mutations. This is a data-loss bug. Fix: Instead of snapshot-based rollback, re-insert only the deleted clip at its original position, or re-fetch from Dexie on failure (`get().loadClips(...)`).

#### High Priority

- **[src/stores/useAudioClipStore.ts:82-93] (confidence: 85)**: **Optimistic `updateClipTitle` rollback has the same stale-snapshot problem.** If another mutation completes between the optimistic title update and the Dexie write failure, the rollback overwrites that other mutation's result. Fix: On failure, re-fetch from Dexie via `get().loadClips(...)` rather than restoring a potentially-stale snapshot.

- **[src/app/components/audiobook/ClipButton.tsx:48-56] (confidence: 92)**: **`startTime` can be stale when completing a clip — use of `ref` prevents re-render but also prevents reading fresh value.** The component stores `startTime` in a `ref` (to avoid re-renders during playback), then reads `ref.current` when the user taps to complete. However, if `currentTime` prop updates are batched or the ref isn't updated on every render (only set on first tap), there's a risk that `startTime` doesn't accurately reflect the captured time. More critically, there's no validation that `endTime > startTime` — if the audio was seeked backward between taps, a clip with `endTime < startTime` (negative duration) would be persisted. Fix: Add a guard `if (currentTime <= startTimeRef.current) { toast.error("End time must be after start time"); return; }` before calling `addClip`.

- **[src/app/components/audiobook/ClipListPanel.tsx:65-72] (confidence: 80)**: **`reorderClips(oldIndex, newIndex)` uses array indices that can desync from Dexie data.** The DnD handler passes `oldIndex`/`newIndex` from the sorted in-memory array, but `reorderClips` in the store does `arrayMove` on `state.clips` and writes new sortOrder values to Dexie. If `loadClips` hasn't been called yet (`isLoaded: false`) or clips were externally modified (another tab), the indices map to wrong items. Fix: Add a guard at the top of `reorderClips`: `if (!get().isLoaded) return;` and consider validating bounds.

#### Medium

- **[src/stores/useAudioClipStore.ts:106-122] (confidence: 75)**: **`reorderClips` writes every clip's sortOrder in a transaction even when only two positions change.** For a list of N clips, this issues N Dexie put operations. While not incorrect, for large clip collections this could be slow and hit IndexedDB transaction limits. Fix: Only update the two clips that actually changed sortOrder (the moved item and the displaced item), or use a bulk put with only modified items.

- **[src/db/schema.ts:87] (confidence: 70)**: **v47 migration only declares `audioClips` index — previous versions' tables must be re-declared in Dexie.** Dexie requires each `version(N).stores(...)` call to include *all* tables that exist up to that version, not just the new ones. If the v47 migration only lists `audioClips` without re-listing all prior tables (`books`, `audioBookmarks`, `readingQueue`, etc.), Dexie will interpret the missing tables as "drop these tables" on upgrade from v46 → v47. Fix: Ensure v47's `.stores()` includes all tables from v46 plus `audioClips`, following the same pattern as prior migrations in the file.

---
Issues found: 8 | Blockers: 3 | High: 3 | Medium: 2 | Nits: 0
