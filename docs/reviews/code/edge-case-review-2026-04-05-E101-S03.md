# Edge Case Review — E101-S03: Library Browsing & Catalog Sync

**Date:** 2026-04-05

## Unhandled Edge Cases

**[useAudiobookshelfSync.ts:62]** — `authorNames` empty string fallback
> Trigger: ABS item with empty `authors` array
> Consequence: Book displays "Unknown Author" — acceptable fallback
> Guard: Already handled with `|| 'Unknown Author'`

**[useAudiobookshelfSync.ts:109-116]** — `Promise.all` for parallel library fetch
> Trigger: One library fetch fails while others succeed
> Consequence: `failedResult` check on line 119 will find the failed result and treat the entire sync as failed, discarding successful results from other libraries
> Guard: Consider `Promise.allSettled` to process successful results even when one library fails

**[useBookStore.ts:219-220]** — `upsertAbsBook` finds existing by `absServerId + absItemId`
> Trigger: Two different ABS servers with items that happen to have the same `absItemId`
> Consequence: No conflict — the find also checks `absServerId`, so different servers are correctly distinguished
> Guard: Already handled

**[Library.tsx:88-92]** — `hasSynced` ref prevents re-sync on re-render
> Trigger: User navigates away from Library and back
> Consequence: Catalog never re-syncs during the component lifecycle after the first sync. This is intentional (background sync on mount only), but means stale data if the user returns to Library after adding books on the ABS server.
> Guard: Not guarded — acceptable for MVP, could add a manual "refresh" button later

**[LibrarySourceTabs.tsx:48]** — `setFilter('source', 'all')` when clicking "All" tab
> Trigger: User clicks "All" tab
> Consequence: `setFilter` converts 'all' to `undefined` — works correctly but 'all' is never stored in state
> Guard: Already handled in `setFilter` logic

---
**Total:** 2 unhandled edge cases found (Promise.all partial failure, no re-sync on re-mount). Neither is a blocker.
