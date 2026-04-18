import { describe, it, expect } from 'vitest'
import {
  tableRegistry,
  getTableConfig,
  SKIP_SYNC_TABLES,
  type SyncTableConfig,
} from '../tableRegistry'

describe('tableRegistry', () => {
  // ─── Registry completeness ────────────────────────────────────────────────

  it('has 38 entries', () => {
    expect(Object.keys(tableRegistry)).toHaveLength(38)
  })

  it('all P0 tables exist in registry', () => {
    const p0Tables = ['contentProgress', 'studySessions', 'progress']
    for (const table of p0Tables) {
      expect(tableRegistry[table], `P0 table "${table}" should be in registry`).toBeDefined()
      expect(tableRegistry[table].priorityTier).toBe(0)
    }
  })

  it('every entry has all required fields', () => {
    for (const [name, config] of Object.entries(tableRegistry)) {
      expect(config.dexieTable, `${name}.dexieTable`).toBe(name)
      expect(config.supabaseTable, `${name}.supabaseTable`).toBeTruthy()
      expect(config.conflictStrategy, `${name}.conflictStrategy`).toBeTruthy()
      expect(typeof config.priorityTier, `${name}.priorityTier`).toBe('number')
      expect(config.fieldMap, `${name}.fieldMap`).toBeDefined()
      expect(Array.isArray(config.nonSerializableFields), `${name}.nonSerializableFields`).toBe(
        true
      )
    }
  })

  // ─── Conflict strategies ──────────────────────────────────────────────────

  it('insert-only tables: studySessions, aiUsageEvents, quizAttempts', () => {
    expect(tableRegistry.studySessions.conflictStrategy).toBe('insert-only')
    expect(tableRegistry.aiUsageEvents.conflictStrategy).toBe('insert-only')
    expect(tableRegistry.quizAttempts.conflictStrategy).toBe('insert-only')
  })

  it('monotonic tables: contentProgress, progress, vocabularyItems', () => {
    expect(tableRegistry.contentProgress.conflictStrategy).toBe('monotonic')
    expect(tableRegistry.progress.conflictStrategy).toBe('monotonic')
    expect(tableRegistry.vocabularyItems.conflictStrategy).toBe('monotonic')
  })

  // ─── Vault fields ─────────────────────────────────────────────────────────

  it('opdsCatalogs declares vaultFields: password', () => {
    expect(tableRegistry.opdsCatalogs.vaultFields).toContain('password')
  })

  it('audiobookshelfServers declares vaultFields: apiKey', () => {
    expect(tableRegistry.audiobookshelfServers.vaultFields).toContain('apiKey')
  })

  // ─── Compound PKs ─────────────────────────────────────────────────────────

  it('chapterMappings has correct compoundPkFields', () => {
    expect(tableRegistry.chapterMappings.compoundPkFields).toEqual(['epubBookId', 'audioBookId'])
  })

  it('contentProgress has compoundPkFields', () => {
    expect(tableRegistry.contentProgress.compoundPkFields).toEqual(['courseId', 'itemId'])
  })

  it('progress has compoundPkFields', () => {
    expect(tableRegistry.progress.compoundPkFields).toEqual(['courseId', 'videoId'])
  })

  // ─── Non-serializable fields ──────────────────────────────────────────────

  it('books has directoryHandle in nonSerializableFields', () => {
    expect(tableRegistry.books.nonSerializableFields).toContain('directoryHandle')
  })

  it('books has fileHandle in nonSerializableFields', () => {
    expect(tableRegistry.books.nonSerializableFields).toContain('fileHandle')
  })

  it('books has coverBlob in nonSerializableFields', () => {
    expect(tableRegistry.books.nonSerializableFields).toContain('coverBlob')
  })

  // ─── Supabase table names ─────────────────────────────────────────────────

  it('progress maps to video_progress (non-obvious mapping)', () => {
    expect(tableRegistry.progress.supabaseTable).toBe('video_progress')
  })

  it('bookHighlights maps to book_highlights', () => {
    expect(tableRegistry.bookHighlights.supabaseTable).toBe('book_highlights')
  })
})

describe('getTableConfig', () => {
  it('returns config for a known syncable table', () => {
    const config = getTableConfig('notes')
    expect(config).toBeDefined()
    expect((config as SyncTableConfig).supabaseTable).toBe('notes')
    expect((config as SyncTableConfig).conflictStrategy).toBe('lww')
  })

  it('returns config for a P0 table', () => {
    const config = getTableConfig('contentProgress')
    expect(config).toBeDefined()
    expect((config as SyncTableConfig).priorityTier).toBe(0)
  })

  it('returns undefined for tables in SKIP_SYNC_TABLES', () => {
    for (const table of SKIP_SYNC_TABLES) {
      expect(
        getTableConfig(table),
        `getTableConfig("${table}") should return undefined`
      ).toBeUndefined()
    }
  })

  it('returns undefined for unknown table names', () => {
    expect(getTableConfig('nonExistentTable')).toBeUndefined()
    expect(getTableConfig('')).toBeUndefined()
    expect(getTableConfig('syncQueue')).toBeUndefined() // infrastructure table, not synced
    expect(getTableConfig('syncMetadata')).toBeUndefined() // infrastructure table, not synced
  })
})

describe('SKIP_SYNC_TABLES', () => {
  it('is a Set', () => {
    expect(SKIP_SYNC_TABLES).toBeInstanceOf(Set)
  })

  it('contains all 10 expected skip-sync tables', () => {
    const expected = [
      'courseThumbnails',
      'screenshots',
      'entitlements',
      'youtubeVideoCache',
      'youtubeTranscripts',
      'youtubeChapters',
      'courseEmbeddings',
      'bookFiles',
      'transcriptEmbeddings',
      'videoCaptions',
    ]
    for (const table of expected) {
      expect(SKIP_SYNC_TABLES.has(table), `"${table}" should be in SKIP_SYNC_TABLES`).toBe(true)
    }
  })

  it('has exactly 10 entries', () => {
    expect(SKIP_SYNC_TABLES.size).toBe(10)
  })
})
