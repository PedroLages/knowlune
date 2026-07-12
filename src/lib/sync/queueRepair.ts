/**
 * queueRepair — E92 bugfix: repair syncQueue entries with missing user_id/updated_at
 *
 * One-time repair that scans all syncQueue entries for payloads lacking `user_id`
 * or `updated_at` (caused by syncableWrite building the queue payload from the
 * caller's un-stamped `record` instead of `stampedRecord`). For each malformed
 * entry, the repair:
 *
 *   1. Loads the source record from the corresponding Dexie table.
 *   2. Rebuilds the payload via `toSnakeCase` on the stamped source record.
 *   3. Resets status to 'pending' and attempts to 0.
 *   4. If the source record no longer exists, dead-letters the queue entry.
 *
 * Runs at most once per device, gated by a localStorage marker.
 * Intended to be called from `syncEngine.start()` after authentication.
 *
 * Pure module (besides `@/db`, `tableRegistry`, `fieldMapper`, `syncableWrite`) —
 * no React imports, no direct Supabase calls.
 */

import { db } from '@/db'
import { getTableEntry } from './tableRegistry'
import { toSnakeCase } from './fieldMapper'
import { synthesizeRecordId } from './syncableWrite'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPAIR_MARKER_KEY = 'sync-queue-userid-payload-repair-v1'

/** Dead-letter lastError substrings that indicate a 403/RLS/ownership failure. */
const RLS_ERROR_PATTERNS = [
  'forbidden',
  '403',
  'row-level security',
  'permission denied',
  'missing user_id',
  'null value in column',
]

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface QueueRepairResult {
  entriesFixed: number
  entriesDeadLettered: number
  skipped: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a dead-letter entry's lastError indicates an RLS / ownership
 * failure that could be repaired by rebuilding the payload with user_id.
 */
function _looksLikeRlsError(lastError: string | undefined): boolean {
  if (!lastError) return false
  const lower = lastError.toLowerCase()
  return RLS_ERROR_PATTERNS.some(pattern => lower.includes(pattern))
}

/**
 * Load the source record for a queue entry from the corresponding Dexie table.
 * Handles both simple-PK and compound-PK tables.
 */
async function _loadSourceRecord(
  tableName: string,
  recordId: string,
  compoundPkFields: string[] | undefined
): Promise<Record<string, unknown> | undefined> {
  if (compoundPkFields && compoundPkFields.length > 0) {
    // Compound PK: the recordId is the join of compound key values with the
    // ASCII Unit Separator (U+001F). Filter by matching on those fields.
    // This is O(n) but acceptable for a one-time repair.
    const table = db.table(tableName)
    const all = await table.toArray()
    const found = all.find((record: Record<string, unknown>) => {
      const parts = compoundPkFields.map(field => String(record[field] ?? ''))
      return parts.join('') === recordId
    })
    return found as Record<string, unknown> | undefined
  }

  // Simple PK: direct lookup by id / recordId.
  return (await db.table(tableName).get(recordId)) as
    | Record<string, unknown>
    | undefined
}

// ---------------------------------------------------------------------------
// Main repair function
// ---------------------------------------------------------------------------

/**
 * One-time repair for syncQueue entries whose payload lacks `user_id` or
 * `updated_at`. Rebuilds payloads from local Dexie records and resets status
 * so the upload engine can retry them.
 *
 * @param userId The current authenticated Supabase user id. If falsy, the
 *               repair is skipped (no user context to stamp with).
 */
export async function repairMalformedQueueEntries(
  userId: string | null
): Promise<QueueRepairResult> {
  // No authenticated user — can't stamp records. Skip.
  if (!userId) {
    return { entriesFixed: 0, entriesDeadLettered: 0, skipped: true }
  }

  // Already ran on this device — skip.
  if (typeof localStorage !== 'undefined' && localStorage.getItem(REPAIR_MARKER_KEY) !== null) {
    return { entriesFixed: 0, entriesDeadLettered: 0, skipped: true }
  }

  const now = new Date().toISOString()
  let entriesFixed = 0
  let entriesDeadLettered = 0

  // Scan all syncQueue entries — both pending (pre-upload) and dead-letter
  // (already failed). Skip entries currently being uploaded (concurrent access).
  const allEntries = await db.syncQueue.toArray()

  for (const queueEntry of allEntries) {
    // Skip entries that are currently uploading — concurrent access risk.
    if (queueEntry.status === 'uploading') continue

    // Skip delete operations — their payload is just { id } and RLS is
    // evaluated against the row being deleted.
    if (queueEntry.operation === 'delete') continue

    const payload = queueEntry.payload as Record<string, unknown> | undefined

    // Check if payload already has a valid user_id — if so, this entry is
    // already healthy (or was enqueued after the bug was fixed).
    if (payload && typeof payload.user_id === 'string' && payload.user_id.length > 0) {
      continue
    }

    // For dead-letter entries, only repair those whose lastError indicates
    // an RLS / ownership failure. Don't revive unrelated dead-letter entries.
    if (queueEntry.status === 'dead-letter' && !_looksLikeRlsError(queueEntry.lastError)) {
      continue
    }

    // Look up the registry entry for this table.
    const tableEntry = getTableEntry(queueEntry.tableName)
    if (!tableEntry) {
      // Unknown table — dead-letter.
      await db.syncQueue.update(queueEntry.id!, {
        status: 'dead-letter',
        lastError: 'Queue repair: unknown table in registry',
        updatedAt: now,
      })
      entriesDeadLettered++
      continue
    }

    try {
      // Load the source record from Dexie.
      const sourceRecord = await _loadSourceRecord(
        queueEntry.tableName,
        queueEntry.recordId,
        tableEntry.compoundPkFields
      )

      if (!sourceRecord) {
        // Source record gone — dead-letter or remove.
        await db.syncQueue.update(queueEntry.id!, {
          status: 'dead-letter',
          lastError: 'Queue repair: source record not found in Dexie',
          updatedAt: now,
        })
        entriesDeadLettered++
        continue
      }

      // Ownership check: never reassign a record whose non-null userId belongs
      // to a different user.
      const existingUserId = sourceRecord.userId as string | null | undefined
      if (
        existingUserId !== null &&
        existingUserId !== undefined &&
        existingUserId !== '' &&
        existingUserId !== userId
      ) {
        // Record belongs to another user — dead-letter, don't hijack.
        await db.syncQueue.update(queueEntry.id!, {
          status: 'dead-letter',
          lastError: `Queue repair: record owned by different user (${existingUserId})`,
          updatedAt: now,
        })
        entriesDeadLettered++
        continue
      }

      // Stamp the source record with current userId and updatedAt.
      const stampedRecord: Record<string, unknown> = {
        ...sourceRecord,
        userId,
        updatedAt: sourceRecord.updatedAt ?? now,
      }

      // Rebuild the payload and recordId from the stamped record.
      const newPayload = toSnakeCase(tableEntry, stampedRecord)
      const newRecordId = synthesizeRecordId(
        stampedRecord as { id?: string; [key: string]: unknown },
        tableEntry
      )

      // Update the queue entry: repaired payload, reset to pending.
      await db.syncQueue.update(queueEntry.id!, {
        payload: newPayload,
        recordId: newRecordId,
        status: 'pending',
        attempts: 0,
        lastError: undefined,
        updatedAt: now,
      })
      entriesFixed++
    } catch (err) {
      console.error('[queueRepair] Failed to repair entry:', {
        id: queueEntry.id,
        tableName: queueEntry.tableName,
        recordId: queueEntry.recordId,
        error: err instanceof Error ? err.message : String(err),
      })
      // Dead-letter on unexpected error.
      try {
        await db.syncQueue.update(queueEntry.id!, {
          status: 'dead-letter',
          lastError: `Queue repair failed: ${err instanceof Error ? err.message : String(err)}`,
          updatedAt: now,
        })
        entriesDeadLettered++
      } catch {
        /* ignore double-failure */
      }
    }
  }

  // Persist migration marker — only after the repair completes successfully.
  try {
    localStorage.setItem(REPAIR_MARKER_KEY, now)
  } catch {
    /* localStorage may be unavailable */
  }

  if (entriesFixed > 0 || entriesDeadLettered > 0) {
    console.info('[queueRepair] Completed:', { entriesFixed, entriesDeadLettered })
  }

  return { entriesFixed, entriesDeadLettered, skipped: false }
}

/**
 * Check whether the one-time queue repair has already run on this device.
 * Useful for tests and diagnostics.
 */
export function hasQueueRepairRun(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(REPAIR_MARKER_KEY) !== null
}

/**
 * Clear the queue repair marker (primarily for tests).
 */
export function clearQueueRepairMarker(): void {
  try {
    localStorage.removeItem(REPAIR_MARKER_KEY)
  } catch {
    /* localStorage may be unavailable */
  }
}
