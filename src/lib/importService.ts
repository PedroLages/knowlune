/**
 * Data import service for LevelUp learning platform.
 *
 * Re-imports a previously exported LevelUp JSON file into IndexedDB + localStorage.
 * Validates schema version and data structure before writing.
 *
 * Uses Dexie transactions for atomicity — no partial writes on failure.
 */
import { db } from '@/db/schema'
import { CURRENT_SCHEMA_VERSION, type LevelUpExport } from './exportService'

// --- Import Result ---

export interface ImportResult {
  success: boolean
  recordCount: number
  error?: string
}

// --- Validation ---

function isValidExport(data: unknown): data is LevelUpExport {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>

  if (typeof obj.schemaVersion !== 'number') return false
  if (typeof obj.exportedAt !== 'string') return false
  if (typeof obj.data !== 'object' || obj.data === null) return false

  return true
}

// --- Schema Migration Registry ---

type MigrationFn = (data: LevelUpExport) => LevelUpExport

const migrations: Record<number, MigrationFn> = {
  // v14 is the first export schema version — no migrations needed yet.
  // Future migrations will be added here as the schema evolves:
  // 15: (data) => { /* transform v14 → v15 */ return data },
}

function applyMigrations(data: LevelUpExport): LevelUpExport {
  let current = data
  for (let v = current.schemaVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = migrations[v + 1]
    if (migrate) {
      current = migrate(current)
      current.schemaVersion = v + 1
    }
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
      error: 'Not a valid LevelUp export file (missing schemaVersion or data)',
    }
  }

  let exportData = parsed as LevelUpExport

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
        db.learningPath,
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
          db.learningPath.clear(),
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
          { name: 'learningPath', records: data.learningPath || [] },
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

    // Restore localStorage settings
    if (data.settings && typeof data.settings === 'object') {
      for (const [key, value] of Object.entries(data.settings)) {
        localStorage.setItem(
          key,
          typeof value === 'string' ? value : JSON.stringify(value)
        )
      }
    }

    return { success: true, recordCount: totalRecords }
  } catch (error) {
    console.error('[ImportService] Import failed:', error)
    return {
      success: false,
      recordCount: 0,
      error: error instanceof Error ? error.message : 'Database write failed',
    }
  }
}
