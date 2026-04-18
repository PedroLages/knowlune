import { db } from '@/db'

/**
 * Clears all sync queue entries and resets per-table incremental-download
 * cursors. Called on SIGNED_OUT (E92-S08) to ensure the next sign-in starts
 * with a clean slate.
 *
 * Intentional: local data (notes, books, courses, etc.) is NOT deleted.
 * It is preserved so the user can still use the app offline after sign-out.
 * On next sign-in the data will be re-linked to the account (backfillUserId)
 * or cleared by the user's choice in LinkDataDialog.
 *
 * @since E92-S08
 */
export async function clearSyncState(): Promise<void> {
  // Remove all upload queue entries (pending, uploading, dead-letter).
  // Pre-auth orphan entries (enqueued while unauthenticated) are also
  // discarded here — SyncQueueEntry has no userId field so they cannot
  // be tagged; discarding is the safe default.
  await db.syncQueue.clear()

  // Reset per-table download cursors. Using `undefined` (not `null`) to
  // match the optional field type in SyncMetadataEntry — Dexie's IndexedDB
  // layer treats missing and `undefined` values equivalently.
  // Intentional: local data preserved on sign-out — re-linked or cleared on next sign-in via LinkDataDialog.
  await db.syncMetadata.toCollection().modify((row) => {
    row.lastSyncTimestamp = undefined
    row.lastUploadedKey = undefined
  })
}
