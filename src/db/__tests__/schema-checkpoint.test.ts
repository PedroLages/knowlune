import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { CHECKPOINT_VERSION, CHECKPOINT_SCHEMA } from '../checkpoint'

// Unique DB names to avoid conflicts between tests
const MIGRATION_DB_NAME = 'CheckpointTest_Migration'
const CHECKPOINT_DB_NAME = 'CheckpointTest_Checkpoint'

beforeEach(async () => {
  await Dexie.delete(MIGRATION_DB_NAME)
  await Dexie.delete(CHECKPOINT_DB_NAME)
})

/**
 * Helper: extract a normalized schema map from a Dexie instance.
 * Returns { tableName: "primaryKey, index1, index2, ..." } for each table,
 * with indexes sorted alphabetically for deterministic comparison.
 */
function extractSchema(db: Dexie): Record<string, string> {
  const schema: Record<string, string> = {}
  for (const table of db.tables) {
    const primKey = table.schema.primKey.src
    const indexes = table.schema.indexes.map(idx => idx.src).sort()
    schema[table.name] = [primKey, ...indexes].join(', ')
  }
  return schema
}

describe('Dexie migration checkpoint', () => {
  it('CHECKPOINT_VERSION should be 45', () => {
    expect(CHECKPOINT_VERSION).toBe(45)
  })

  it('CHECKPOINT_SCHEMA should define all expected tables', () => {
    // courses table dropped in v30 (E89-S01)
    // courseEmbeddings added in v35 (E52-S01)
    // audioBookmarks added in v38 (E87-S01)
    // opdsCatalogs added in v39 (E88-S01)
    // audiobookshelfServers added in v40 (E101-S01)
    // chapterMappings added in v41 (E103-S01)
    // shelves, bookShelves added in v44 (E110-S01)
    // series index on books added in v45 (E110-S02)
    const expectedTables = [
      'aiUsageEvents',
      'audioBookmarks',
      'audiobookshelfServers',
      'authors',
      'bookFiles',
      'bookHighlights',
      'bookShelves',
      'bookmarks',
      'books',
      'careerPaths',
      'challenges',
      'chapterMappings',
      'contentProgress',
      'courseEmbeddings',
      'courseReminders',
      'courseThumbnails',
      'embeddings',
      'entitlements',
      'flashcards',
      'importedCourses',
      'importedPdfs',
      'importedVideos',
      'learningPathEntries',
      'learningPaths',
      'notes',
      'notificationPreferences',
      'notifications',
      'opdsCatalogs',
      'pathEnrollments',
      'progress',
      'quizAttempts',
      'quizzes',
      'reviewRecords',
      'screenshots',
      'shelves',
      'studySchedules',
      'studySessions',
      'videoCaptions',
      'vocabularyItems',
      'youtubeChapters',
      'youtubeTranscripts',
      'youtubeVideoCache',
    ]
    expect(Object.keys(CHECKPOINT_SCHEMA).sort()).toEqual(expectedTables)
  })

  it('checkpoint-created DB should have identical schema to migration-created DB', async () => {
    // 1. Create DB via full migration chain (all 27 versions)
    const { declareLegacyMigrations } = await import('../schema')

    const migrationDb = new Dexie(MIGRATION_DB_NAME)
    declareLegacyMigrations(migrationDb)
    await migrationDb.open()
    const migrationSchema = extractSchema(migrationDb)
    const migrationVersion = migrationDb.verno
    migrationDb.close()

    // 2. Create DB via checkpoint (single version declaration)
    const { createCheckpointDb } = await import('../schema')
    const checkpointDb = createCheckpointDb(CHECKPOINT_DB_NAME)
    await checkpointDb.open()
    const checkpointSchema = extractSchema(checkpointDb)
    const checkpointVersion = checkpointDb.verno
    checkpointDb.close()

    // 3. Both should produce identical table names
    expect(Object.keys(checkpointSchema).sort()).toEqual(Object.keys(migrationSchema).sort())

    // 4. Both should produce identical indexes per table
    for (const tableName of Object.keys(migrationSchema).sort()) {
      expect(checkpointSchema[tableName], `Schema mismatch for table "${tableName}"`).toBe(
        migrationSchema[tableName]
      )
    }

    // 5. Migration version may be higher than checkpoint (data-only migrations above checkpoint)
    // but schemas must still be identical
    expect(migrationVersion).toBeGreaterThanOrEqual(checkpointVersion)
    expect(checkpointVersion).toBe(CHECKPOINT_VERSION)

    // Cleanup
    await Dexie.delete(MIGRATION_DB_NAME)
    await Dexie.delete(CHECKPOINT_DB_NAME)
  })

  it('checkpoint schema constant should match the schema Dexie produces', async () => {
    // Verify that the hardcoded CHECKPOINT_SCHEMA constant matches
    // what Dexie actually creates from it (catches typos, missing commas, etc.)
    const { createCheckpointDb } = await import('../schema')
    const checkpointDb = createCheckpointDb(CHECKPOINT_DB_NAME)
    await checkpointDb.open()

    // Check every table in CHECKPOINT_SCHEMA exists in the created DB
    for (const tableName of Object.keys(CHECKPOINT_SCHEMA)) {
      const table = checkpointDb.table(tableName)
      expect(table, `Table "${tableName}" should exist`).toBeDefined()
    }

    // Check no extra tables exist beyond what CHECKPOINT_SCHEMA defines
    const createdTableNames = checkpointDb.tables.map(t => t.name).sort()
    const checkpointTableNames = Object.keys(CHECKPOINT_SCHEMA).sort()
    expect(createdTableNames).toEqual(checkpointTableNames)

    checkpointDb.close()
    await Dexie.delete(CHECKPOINT_DB_NAME)
  })
})
