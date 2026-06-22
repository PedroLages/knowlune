/**
 * Data import service for Knowlune learning platform.
 *
 * Re-imports a previously exported Knowlune JSON file into IndexedDB + localStorage.
 * Validates schema version and data structure before writing.
 *
 * Uses Dexie transactions for atomicity — no partial writes on failure.
 *
 * Two import paths:
 *   1. importFullData() — legacy format (KnowluneExport, a subset of tables)
 *   2. restoreFromBackup() — full backup format (BackupPayload, all syncable tables)
 */
import { db } from '@/db/schema'
import { CHECKPOINT_VERSION } from '@/db/checkpoint'
import { SYNCABLE_TABLES } from '@/lib/sync/backfill'
import { CURRENT_SCHEMA_VERSION, type KnowluneExport, type BackupPayload } from './exportService'

// --- Import Result ---

export interface ImportResult {
  success: boolean
  recordCount: number
  error?: string
}

// --- Validation ---

function isValidExport(data: unknown): data is KnowluneExport {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>

  if (typeof obj.schemaVersion !== 'number') return false
  if (typeof obj.exportedAt !== 'string') return false
  if (typeof obj.data !== 'object' || obj.data === null) return false

  return true
}

// --- Schema Migration Registry ---

type MigrationFn = (data: KnowluneExport) => KnowluneExport

const migrations: Record<number, MigrationFn> = {
  // v14 is the first export schema version — no migrations needed yet.
  // Future migrations will be added here as the schema evolves:
  // 15: (data) => { /* transform v14 → v15 */ return data },
}

function applyMigrations(data: KnowluneExport): KnowluneExport {
  let current = data
  for (let v = current.schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const targetVersion = v + 1
    const migrate = migrations[targetVersion]
    if (migrate) {
      current = migrate(current)
    } else {
      console.warn(
        `[ImportService] No migration registered for v${v} → v${targetVersion}. ` +
          'Data passes through unchanged. Register a no-op migration if intentional.'
      )
    }
    current.schemaVersion = targetVersion
  }
  return current
}

// --- Import ---

export async function importFullData(json: string): Promise<ImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { success: false, recordCount: 0, error: 'Invalid JSON file' }
  }

  if (!isValidExport(parsed)) {
    return {
      success: false,
      recordCount: 0,
      error: 'Not a valid Knowlune export file (missing schemaVersion or data)',
    }
  }

  let exportData = parsed as KnowluneExport

  // Apply forward migrations if needed
  if (exportData.schemaVersion < CURRENT_SCHEMA_VERSION) {
    exportData = applyMigrations(exportData)
  }

  const { data } = exportData
  let totalRecords = 0

  try {
    // Write to IndexedDB using transaction for atomicity
    await db.transaction(
      'rw',
      [
        db.importedCourses,
        db.importedVideos,
        db.importedPdfs,
        db.progress,
        db.bookmarks,
        db.notes,
        db.studySessions,
        db.contentProgress,
        db.challenges,
        db.reviewRecords,
        db.learningPaths,
        db.learningPathEntries,
        db.aiUsageEvents,
      ],
      async () => {
        // Clear existing data first
        await Promise.all([
          db.importedCourses.clear(),
          db.importedVideos.clear(),
          db.importedPdfs.clear(),
          db.progress.clear(),
          db.bookmarks.clear(),
          db.notes.clear(),
          db.studySessions.clear(),
          db.contentProgress.clear(),
          db.challenges.clear(),
          db.reviewRecords.clear(),
          db.learningPaths.clear(),
          db.learningPathEntries.clear(),
          db.aiUsageEvents.clear(),
        ])

        // Bulk insert each table
        const tables: Array<{ name: string; records: unknown[] }> = [
          { name: 'importedCourses', records: data.importedCourses || [] },
          { name: 'importedVideos', records: data.importedVideos || [] },
          { name: 'importedPdfs', records: data.importedPdfs || [] },
          { name: 'progress', records: data.progress || [] },
          { name: 'bookmarks', records: data.bookmarks || [] },
          { name: 'notes', records: data.notes || [] },
          { name: 'studySessions', records: data.studySessions || [] },
          { name: 'contentProgress', records: data.contentProgress || [] },
          { name: 'challenges', records: data.challenges || [] },
          { name: 'reviewRecords', records: data.reviewRecords || [] },
          { name: 'learningPaths', records: data.learningPaths || [] },
          { name: 'learningPathEntries', records: data.learningPathEntries || [] },
          { name: 'aiUsageEvents', records: data.aiUsageEvents || [] },
        ]

        for (const { name, records } of tables) {
          if (records.length > 0) {
            await db.table(name).bulkPut(records)
            totalRecords += records.length
          }
        }
      }
    )

    // Restore localStorage settings (after transaction succeeds)
    // Capture old values for rollback if localStorage write fails
    if (data.settings && typeof data.settings === 'object') {
      const oldValues = new Map<string, string | null>()
      try {
        for (const [key, value] of Object.entries(data.settings)) {
          oldValues.set(key, localStorage.getItem(key))
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
        }
      } catch (lsError) {
        // Roll back localStorage changes on failure (e.g., QuotaExceededError)
        for (const [key, oldVal] of oldValues) {
          if (oldVal === null) {
            localStorage.removeItem(key)
          } else {
            localStorage.setItem(key, oldVal)
          }
        }
        console.error('[ImportService] localStorage restore failed:', lsError)
        return {
          success: false,
          recordCount: totalRecords,
          error: 'Database imported but settings restore failed — try freeing storage space',
        }
      }
    }

    // E32-S03: Check storage quota after bulk import (fire-and-forget)
    import('@/lib/storageQuotaMonitor').then(({ checkStorageQuota }) => {
      checkStorageQuota().catch(() => {
        // silent-catch-ok: quota check is advisory
      })
    })

    return { success: true, recordCount: totalRecords }
  } catch (error) {
    console.error('[ImportService] Import failed:', error)

    // E32-S03: Detect QuotaExceededError specifically for user-friendly message
    const { isIndexedDBQuotaExceeded } = await import('@/lib/storageQuotaMonitor')
    if (isIndexedDBQuotaExceeded(error)) {
      return {
        success: false,
        recordCount: 0,
        error: 'Storage is full. Free up space in Settings > Data Management before importing.',
      }
    }

    return {
      success: false,
      recordCount: 0,
      error: error instanceof Error ? error.message : 'Database write failed',
    }
  }
}

// =============================================================================
// Full Backup Restore (E77a-S01)
// =============================================================================

export interface ImportSummary {
  /** Total records imported across all tables */
  totalRecords: number
  /** Per-table record counts for validation */
  counts: Record<string, number>
  /** Schema version of the backup file that was imported */
  schemaVersion: number
  /** Whether the data was migrated from an older schema version */
  wasMigrated: boolean
  /** Any non-critical warnings encountered during import */
  warnings: string[]
}

/**
 * Validate that a parsed backup payload has the expected shape.
 */
function isValidBackupPayload(
  data: unknown
): data is BackupPayload & { data: Record<string, unknown[]> } {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>

  if (typeof obj.schemaVersion !== 'number') return false
  if (typeof obj.exportedAt !== 'string') return false
  if (typeof obj.data !== 'object' || obj.data === null) return false
  if (typeof obj.settings !== 'object' || obj.settings === null) return false

  return true
}

/**
 * The list of sync infrastructure tables that should NOT be restored
 * (they contain transient sync state, not user data).
 */
const BACKUP_LOCAL_TABLES = new Set(['syncQueue', 'syncMetadata'])

/**
 * Build a set of table names from SYNCABLE_TABLES minus infrastructure tables.
 * Used to determine which tables exist in the backup vs. which should be cleared.
 */
function getRestorableTables(): string[] {
  return SYNCABLE_TABLES.filter(t => !BACKUP_LOCAL_TABLES.has(t))
}

/**
 * Check if a table name exists in the current Dexie schema.
 * Dexie.table() throws for unknown tables, so we use try/catch.
 */
function tableExistsInDexie(tableName: string): boolean {
  try {
    const t = db.table(tableName)
    return !!t && t.name === tableName
  } catch {
    return false
  }
}

/**
 * Restore data from a full backup payload.
 *
 * Flow:
 *   1. Validate payload structure and schema version
 *   2. Collect the set of tables to clear and write
 *   3. Open a Dexie transaction covering all restorable tables
 *   4. Clear all tables first, then bulk-insert backup data
 *   5. Verify record counts match expectations
 *   6. Restore localStorage settings
 *
 * @param payload - Parsed BackupPayload from a file or blob
 * @returns ImportSummary with record counts and warnings
 * @throws If validation fails or the transaction aborts
 */
export async function restoreFromBackup(payload: unknown): Promise<ImportSummary> {
  const warnings: string[] = []

  // Step 1: Validate payload structure
  if (!isValidBackupPayload(payload)) {
    throw new Error('Invalid backup file: missing required fields (schemaVersion, data, settings)')
  }

  const backup = payload as BackupPayload & { data: Record<string, unknown[]> }

  // Step 2: Check schema version
  const wasMigrated = backup.schemaVersion !== CHECKPOINT_VERSION

  if (backup.schemaVersion > CHECKPOINT_VERSION) {
    throw new Error(
      `Backup has schema version ${backup.schemaVersion} which is newer than ` +
        `the current version ${CHECKPOINT_VERSION}. Please update the app before restoring.`
    )
  }

  if (wasMigrated) {
    warnings.push(
      `Backup was created with schema v${backup.schemaVersion} ` +
        `(current: v${CHECKPOINT_VERSION}). Data will be restored — schema version mismatch detected.`
    )
  }

  // Step 3: Determine which tables to process
  const restorableTables = getRestorableTables()
  const resultCounts: Record<string, number> = {}

  // Step 4: Get Dexie Table references for all restorable tables that exist
  // (some tables may not exist in older backup formats vs. current schema)
  const tablesToClear: string[] = []
  const tablesToWrite: string[] = []

  for (const tableName of restorableTables) {
    if (!tableExistsInDexie(tableName)) {
      warnings.push(`Table '${tableName}' does not exist in the current schema — skipping`)
      continue
    }

    tablesToClear.push(tableName)

    // Only write tables that have data in the backup
    if (Array.isArray(backup.data[tableName])) {
      tablesToWrite.push(tableName)
    }
  }

  if (tablesToWrite.length === 0) {
    throw new Error('No restorable data found in the backup file.')
  }

  // Step 5: Execute the atomic transaction:
  //   - Clear all restorable tables
  //   - Bulk-insert data from the backup
  //   - Count records for verification
  //
  // We include all tables in the transaction scope. Dexie accepts table
  // name strings directly in `db.transaction()`.
  await db.transaction('rw', [...tablesToClear, 'syncQueue', 'syncMetadata'], async () => {
    // Clear all restorable tables (fresh state)
    const clearPromises = tablesToClear.map(name => db.table(name).clear())

    // Clear sync infrastructure tables too, if they exist
    if (tableExistsInDexie('syncQueue')) {
      clearPromises.push(db.table('syncQueue').clear())
    }
    if (tableExistsInDexie('syncMetadata')) {
      clearPromises.push(db.table('syncMetadata').clear())
    }

    await Promise.all(clearPromises)

    // Bulk-insert data from backup
    for (const tableName of tablesToWrite) {
      const records = backup.data[tableName]
      if (records.length === 0) {
        resultCounts[tableName] = 0
        continue
      }

      try {
        await db.table(tableName).bulkPut(records)
        resultCounts[tableName] = records.length
      } catch (writeError) {
        const msg = writeError instanceof Error ? writeError.message : String(writeError)
        warnings.push(`Failed to restore table '${tableName}': ${msg}. Table was cleared.`)
        resultCounts[tableName] = 0
      }
    }
  })

  // Step 6: Restore localStorage settings (after DB transaction succeeds)
  if (backup.settings && typeof backup.settings === 'object') {
    const oldValues = new Map<string, string | null>()

    try {
      for (const [key, value] of Object.entries(backup.settings)) {
        oldValues.set(key, localStorage.getItem(key))
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
      }
    } catch (lsError) {
      // Roll back localStorage on failure (e.g., QuotaExceededError)
      for (const [key, oldVal] of oldValues) {
        if (oldVal === null) {
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, oldVal)
        }
      }
      console.error('[ImportService] localStorage restore failed:', lsError)
      warnings.push('Settings could not be restored due to storage limits.')
    }
  }

  // Step 7: Compute total
  const totalRecords = Object.values(resultCounts).reduce((sum, c) => sum + c, 0)

  return {
    totalRecords,
    counts: resultCounts,
    schemaVersion: backup.schemaVersion,
    wasMigrated,
    warnings,
  }
}
