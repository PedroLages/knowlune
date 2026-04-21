import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tableRegistry, getTableEntry, type TableRegistryEntry } from '../tableRegistry'
import { toSnakeCase, toCamelCase } from '../fieldMapper'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ---------------------------------------------------------------------------
// AC2 / 3.12 — All 38 tables registered
// ---------------------------------------------------------------------------

describe('tableRegistry — completeness', () => {
  it('has exactly 38 entries', () => {
    expect(tableRegistry).toHaveLength(38)
  })

  it('does not include flashcard_reviews (Supabase-only table)', () => {
    const entry = tableRegistry.find(e => e.dexieTable === 'flashcard_reviews')
    expect(entry).toBeUndefined()
    const entry2 = tableRegistry.find(e => e.supabaseTable === 'flashcard_reviews')
    expect(entry2).toBeUndefined()
  })

  it('all entries have unique dexieTable names', () => {
    const names = tableRegistry.map(e => e.dexieTable)
    const unique = new Set(names)
    expect(unique.size).toBe(tableRegistry.length)
  })
})

// ---------------------------------------------------------------------------
// AC2 / 3.1 — P0 priority check
// ---------------------------------------------------------------------------

describe('tableRegistry — priority tiers', () => {
  const p0Tables = ['contentProgress', 'studySessions', 'progress']
  const p1Tables = [
    'notes',
    'bookmarks',
    'flashcards',
    'reviewRecords',
    'embeddings',
    'bookHighlights',
    'vocabularyItems',
    'audioBookmarks',
    'audioClips',
    'chatConversations',
    'learnerModels',
  ]
  const p2Tables = [
    'importedCourses',
    'importedVideos',
    'importedPdfs',
    'authors',
    'books',
    'bookReviews',
    'shelves',
    'bookShelves',
    'readingQueue',
    'chapterMappings',
  ]
  const p3Tables = [
    'learningPaths',
    'learningPathEntries',
    'challenges',
    'courseReminders',
    'notifications',
    'careerPaths',
    'pathEnrollments',
    'studySchedules',
    'opdsCatalogs',
    'audiobookshelfServers',
    'notificationPreferences',
  ]
  const p4Tables = ['quizzes', 'quizAttempts', 'aiUsageEvents']

  it.each(p0Tables)('%s has priority 0', table => {
    expect(getTableEntry(table)?.priority).toBe(0)
  })

  it.each(p1Tables)('%s has priority 1', table => {
    expect(getTableEntry(table)?.priority).toBe(1)
  })

  it.each(p2Tables)('%s has priority 2', table => {
    expect(getTableEntry(table)?.priority).toBe(2)
  })

  it.each(p3Tables)('%s has priority 3', table => {
    expect(getTableEntry(table)?.priority).toBe(3)
  })

  it.each(p4Tables)('%s has priority 4', table => {
    expect(getTableEntry(table)?.priority).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// AC8 / 3.2 — Conflict strategies
// ---------------------------------------------------------------------------

describe('tableRegistry — conflict strategies', () => {
  it('aiUsageEvents has insert-only strategy', () => {
    expect(getTableEntry('aiUsageEvents')?.conflictStrategy).toBe('insert-only')
  })

  it('quizAttempts has insert-only strategy', () => {
    expect(getTableEntry('quizAttempts')?.conflictStrategy).toBe('insert-only')
  })

  it('contentProgress has monotonic strategy', () => {
    expect(getTableEntry('contentProgress')?.conflictStrategy).toBe('monotonic')
  })

  it('progress has monotonic strategy', () => {
    expect(getTableEntry('progress')?.conflictStrategy).toBe('monotonic')
  })

  it('books has monotonic strategy', () => {
    expect(getTableEntry('books')?.conflictStrategy).toBe('monotonic')
  })

  it('vocabularyItems has monotonic strategy', () => {
    expect(getTableEntry('vocabularyItems')?.conflictStrategy).toBe('monotonic')
  })

  it('challenges has monotonic strategy', () => {
    expect(getTableEntry('challenges')?.conflictStrategy).toBe('monotonic')
  })

  it('notes has conflict-copy strategy (E93-S03)', () => {
    expect(getTableEntry('notes')?.conflictStrategy).toBe('conflict-copy')
  })

  it('notes fieldMap has three entries: deleted, conflictCopy, conflictNoteId (E93-S03)', () => {
    const entry = getTableEntry('notes')
    expect(entry?.fieldMap).toMatchObject({
      deleted: 'soft_deleted',
      conflictCopy: 'conflict_copy',
      conflictNoteId: 'conflict_source_id',
    })
  })

  it('flashcards has lww strategy', () => {
    expect(getTableEntry('flashcards')?.conflictStrategy).toBe('lww')
  })
})

// ---------------------------------------------------------------------------
// 3.3 — progress maps to video_progress Supabase table
// ---------------------------------------------------------------------------

describe('tableRegistry — Supabase table name mapping', () => {
  it('progress Dexie table maps to video_progress Supabase table', () => {
    const entry = getTableEntry('progress')
    expect(entry?.supabaseTable).toBe('video_progress')
  })
})

// ---------------------------------------------------------------------------
// AC9 / 3.4 — Compound PK fields
// ---------------------------------------------------------------------------

describe('tableRegistry — compound PK fields', () => {
  it('chapterMappings has compoundPkFields [epubBookId, audioBookId]', () => {
    const entry = getTableEntry('chapterMappings')
    expect(entry?.compoundPkFields).toEqual(['epubBookId', 'audioBookId'])
  })

  it('contentProgress has compoundPkFields [courseId, itemId]', () => {
    const entry = getTableEntry('contentProgress')
    expect(entry?.compoundPkFields).toEqual(['courseId', 'itemId'])
  })
})

// ---------------------------------------------------------------------------
// AC6 / 3.5-3.6 — Vault fields
// ---------------------------------------------------------------------------

describe('tableRegistry — vault fields', () => {
  it('opdsCatalogs.vaultFields contains password', () => {
    const entry = getTableEntry('opdsCatalogs')
    expect(entry?.vaultFields).toContain('password')
  })

  it('audiobookshelfServers.vaultFields contains apiKey', () => {
    const entry = getTableEntry('audiobookshelfServers')
    expect(entry?.vaultFields).toContain('apiKey')
  })
})

// ---------------------------------------------------------------------------
// AC5 / 3.7 — Strip fields (non-serializable handles)
// ---------------------------------------------------------------------------

describe('tableRegistry — stripFields', () => {
  it('importedCourses.stripFields contains directoryHandle', () => {
    const entry = getTableEntry('importedCourses')
    expect(entry?.stripFields).toContain('directoryHandle')
  })

  it('importedCourses.stripFields contains coverImageHandle', () => {
    const entry = getTableEntry('importedCourses')
    expect(entry?.stripFields).toContain('coverImageHandle')
  })

  it('importedVideos.stripFields contains fileHandle', () => {
    const entry = getTableEntry('importedVideos')
    expect(entry?.stripFields).toContain('fileHandle')
  })

  it('importedPdfs.stripFields contains fileHandle', () => {
    const entry = getTableEntry('importedPdfs')
    expect(entry?.stripFields).toContain('fileHandle')
  })

  it('authors.stripFields contains photoHandle', () => {
    const entry = getTableEntry('authors')
    expect(entry?.stripFields).toContain('photoHandle')
  })
})

// ---------------------------------------------------------------------------
// AC7 / 3.8 — Monotonic fields
// ---------------------------------------------------------------------------

describe('tableRegistry — monotonic fields', () => {
  it('vocabularyItems.monotonicFields contains masteryLevel', () => {
    const entry = getTableEntry('vocabularyItems')
    expect(entry?.monotonicFields).toContain('masteryLevel')
  })

  it('progress.monotonicFields contains watchedSeconds', () => {
    const entry = getTableEntry('progress')
    expect(entry?.monotonicFields).toContain('watchedSeconds')
  })

  it('books.monotonicFields contains progress', () => {
    const entry = getTableEntry('books')
    expect(entry?.monotonicFields).toContain('progress')
  })

  it('challenges.monotonicFields contains currentProgress', () => {
    const entry = getTableEntry('challenges')
    expect(entry?.monotonicFields).toContain('currentProgress')
  })
})

// ---------------------------------------------------------------------------
// E93-S07 — audioBookmarks append-only invariants
// ---------------------------------------------------------------------------

describe('tableRegistry — audioBookmarks append-only (E93-S07)', () => {
  it('audioBookmarks has conflictStrategy: insert-only', () => {
    expect(getTableEntry('audioBookmarks')?.conflictStrategy).toBe('insert-only')
  })

  it('audioBookmarks has insertOnly: true', () => {
    expect(getTableEntry('audioBookmarks')?.insertOnly).toBe(true)
  })

  it('audioBookmarks has cursorField: created_at', () => {
    expect(getTableEntry('audioBookmarks')?.cursorField).toBe('created_at')
  })

  it('audioBookmarks.stripFields contains updatedAt', () => {
    expect(getTableEntry('audioBookmarks')?.stripFields).toContain('updatedAt')
  })

  it('audioClips remains lww with no cursorField override', () => {
    const entry = getTableEntry('audioClips')
    expect(entry?.conflictStrategy).toBe('lww')
    expect(entry?.cursorField).toBeUndefined()
  })

  it('audioBookmarks toSnakeCase does not include updated_at in payload', () => {
    const entry = getTableEntry('audioBookmarks')!
    const sample = {
      id: 'bm-1',
      bookId: 'book-1',
      chapterIndex: 0,
      timestamp: 42,
      createdAt: '2026-04-18T10:00:00Z',
      updatedAt: '2026-04-18T10:00:00Z', // spurious stamp from syncableWrite
    }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).not.toHaveProperty('updated_at')
    expect(snaked).toHaveProperty('created_at', '2026-04-18T10:00:00Z')
  })
})

// ---------------------------------------------------------------------------
// AC10 / 3.13 — skipSync field exists on interface (TypeScript assignability)
// ---------------------------------------------------------------------------

describe('tableRegistry — skipSync field', () => {
  it('skipSync is optional and can be assigned to a TableRegistryEntry', () => {
    const entry: TableRegistryEntry = {
      dexieTable: 'test',
      supabaseTable: 'test',
      conflictStrategy: 'lww',
      priority: 0,
      fieldMap: {},
      skipSync: true,
    }
    expect(entry.skipSync).toBe(true)
  })

  it('skipSync defaults to undefined (falsy) in real registry entries', () => {
    // Spot-check a few entries — none should have skipSync set to true
    expect(getTableEntry('notes')?.skipSync).toBeFalsy()
    expect(getTableEntry('books')?.skipSync).toBeFalsy()
    expect(getTableEntry('aiUsageEvents')?.skipSync).toBeFalsy()
  })
})

// ---------------------------------------------------------------------------
// E93-S05 — embeddings uploadOnly flag and fieldMap
// ---------------------------------------------------------------------------

describe('tableRegistry — embeddings upload-only (E93-S05)', () => {
  it('embeddings entry has uploadOnly: true', () => {
    expect(getTableEntry('embeddings')?.uploadOnly).toBe(true)
  })

  it('embeddings fieldMap maps noteId to note_id', () => {
    expect(getTableEntry('embeddings')?.fieldMap).toMatchObject({
      noteId: 'note_id',
    })
  })

  it('embeddings fieldMap maps embedding to vector', () => {
    expect(getTableEntry('embeddings')?.fieldMap).toMatchObject({
      embedding: 'vector',
    })
  })

  it('uploadOnly is absent (falsy) on non-embeddings entries', () => {
    expect(getTableEntry('notes')?.uploadOnly).toBeFalsy()
    expect(getTableEntry('flashcards')?.uploadOnly).toBeFalsy()
    expect(getTableEntry('bookmarks')?.uploadOnly).toBeFalsy()
  })

  it('uploadOnly is optional and can be assigned to a TableRegistryEntry', () => {
    const entry: TableRegistryEntry = {
      dexieTable: 'test-upload-only',
      supabaseTable: 'test_upload_only',
      conflictStrategy: 'lww',
      priority: 1,
      fieldMap: {},
      uploadOnly: true,
    }
    expect(entry.uploadOnly).toBe(true)
  })

  it('embeddings toSnakeCase produces note_id and vector keys', () => {
    const entry = getTableEntry('embeddings')!
    const sample = {
      id: 'uuid-1',
      noteId: 'note-abc',
      embedding: [0.1, 0.2, 0.3],
      createdAt: '2026-04-18T00:00:00Z',
    }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).toHaveProperty('note_id', 'note-abc')
    expect(snaked).toHaveProperty('vector', [0.1, 0.2, 0.3])
    expect(snaked).not.toHaveProperty('noteId')
    expect(snaked).not.toHaveProperty('embedding')
    expect(snaked).toHaveProperty('created_at', '2026-04-18T00:00:00Z')
  })
})

// ---------------------------------------------------------------------------
// AC3/AC4 / 3.9 — Round-trip field mapping
// ---------------------------------------------------------------------------

describe('fieldMapper — round-trip conversion', () => {
  it('chatConversations: createdAt maps to created_at_epoch (explicit fieldMap)', () => {
    const entry = getTableEntry('chatConversations')!
    const sample = { id: 'abc', courseId: '123', createdAt: 1700000000000 }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).toHaveProperty('created_at_epoch', 1700000000000)
    expect(snaked).not.toHaveProperty('createdAt')
    expect(snaked).toHaveProperty('course_id', '123')
  })

  it('chatConversations: round-trip restores original record', () => {
    const entry = getTableEntry('chatConversations')!
    const sample = {
      id: 'abc',
      courseId: '123',
      createdAt: 1700000000000,
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const snaked = toSnakeCase(entry, sample)
    const camelized = toCamelCase(entry, snaked)

    expect(camelized).toEqual(sample)
  })

  it('notes: deleted maps to soft_deleted (explicit fieldMap)', () => {
    const entry = getTableEntry('notes')!
    const sample = { id: 'n1', deleted: false, content: 'hello' }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).toHaveProperty('soft_deleted', false)
    expect(snaked).not.toHaveProperty('deleted')
  })

  it('notes: round-trip restores original record', () => {
    const entry = getTableEntry('notes')!
    const sample = { id: 'n1', deleted: false, content: 'hello', userId: 'u1' }
    const snaked = toSnakeCase(entry, sample)
    const camelized = toCamelCase(entry, snaked)

    expect(camelized).toEqual(sample)
  })

  it('bookmarks: auto camelCase → snake_case for all fields', () => {
    const entry = getTableEntry('bookmarks')!
    const sample = { id: 'bm1', courseId: 'c1', lessonId: 'l1', updatedAt: '2024-01-01T00:00:00Z' }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).toEqual({
      id: 'bm1',
      course_id: 'c1',
      lesson_id: 'l1',
      updated_at: '2024-01-01T00:00:00Z',
    })
  })

  it('bookmarks: round-trip restores original record', () => {
    const entry = getTableEntry('bookmarks')!
    const sample = { id: 'bm1', courseId: 'c1', lessonId: 'l1', updatedAt: '2024-01-01T00:00:00Z' }
    const snaked = toSnakeCase(entry, sample)
    const camelized = toCamelCase(entry, snaked)

    expect(camelized).toEqual(sample)
  })
})

// ---------------------------------------------------------------------------
// 3.10 — stripFields absent from toSnakeCase output
// ---------------------------------------------------------------------------

describe('fieldMapper — stripFields are removed', () => {
  it('importedCourses: directoryHandle and coverImageHandle are stripped', () => {
    const entry = getTableEntry('importedCourses')!
    const sample = {
      id: 'ic1',
      title: 'My Course',
      directoryHandle: { kind: 'directory' }, // non-serializable mock
      coverImageHandle: { kind: 'file' }, // non-serializable mock
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).not.toHaveProperty('directoryHandle')
    expect(snaked).not.toHaveProperty('directory_handle')
    expect(snaked).not.toHaveProperty('coverImageHandle')
    expect(snaked).not.toHaveProperty('cover_image_handle')
    expect(snaked).toHaveProperty('title', 'My Course')
  })

  it('importedVideos: fileHandle is stripped', () => {
    const entry = getTableEntry('importedVideos')!
    const sample = { id: 'iv1', fileHandle: { kind: 'file' }, title: 'video.mp4' }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).not.toHaveProperty('fileHandle')
    expect(snaked).not.toHaveProperty('file_handle')
    expect(snaked).toHaveProperty('title', 'video.mp4')
  })
})

// ---------------------------------------------------------------------------
// 3.11 — vaultFields absent from toSnakeCase output
// ---------------------------------------------------------------------------

describe('fieldMapper — vaultFields are removed', () => {
  it('opdsCatalogs: password is stripped', () => {
    const entry = getTableEntry('opdsCatalogs')!
    const sample = { id: 'opds1', url: 'https://example.com', password: 's3cr3t' }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).not.toHaveProperty('password')
    expect(snaked).toHaveProperty('url', 'https://example.com')
  })

  it('audiobookshelfServers: apiKey is stripped', () => {
    const entry = getTableEntry('audiobookshelfServers')!
    const sample = { id: 'abs1', url: 'https://abs.example.com', apiKey: 'tok_secret' }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).not.toHaveProperty('apiKey')
    expect(snaked).not.toHaveProperty('api_key')
    expect(snaked).toHaveProperty('url', 'https://abs.example.com')
  })
})

// ---------------------------------------------------------------------------
// E94-S07 — books.fileUrl stripFields + fieldMap
// ---------------------------------------------------------------------------

describe('tableRegistry — books fileUrl (E94-S07)', () => {
  it('books.stripFields contains fileUrl', () => {
    const entry = getTableEntry('books')
    expect(entry?.stripFields).toContain('fileUrl')
  })

  it('books.stripFields still contains source', () => {
    const entry = getTableEntry('books')
    expect(entry?.stripFields).toContain('source')
  })

  it('books.fieldMap maps fileUrl to file_url', () => {
    const entry = getTableEntry('books')
    expect(entry?.fieldMap).toMatchObject({ fileUrl: 'file_url' })
  })
})

// ---------------------------------------------------------------------------
// E95-S06 — notificationPreferences singleton PK translation
// ---------------------------------------------------------------------------

describe('tableRegistry — notificationPreferences (E95-S06)', () => {
  it('fieldMap maps id → user_id (singleton → Supabase PK)', () => {
    const entry = getTableEntry('notificationPreferences')
    expect(entry?.fieldMap).toMatchObject({ id: 'user_id' })
  })

  it('upsertConflictColumns targets user_id', () => {
    const entry = getTableEntry('notificationPreferences')
    expect(entry?.upsertConflictColumns).toBe('user_id')
  })

  it('toSnakeCase produces user_id (not id) in payload', () => {
    const entry = getTableEntry('notificationPreferences')!
    const sample = {
      id: 'singleton',
      courseComplete: true,
      streakMilestone: false,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      updatedAt: '2026-04-19T00:00:00.000Z',
    }
    const snaked = toSnakeCase(entry, sample)

    expect(snaked).toHaveProperty('user_id', 'singleton')
    expect(snaked).not.toHaveProperty('id')
    expect(snaked).toHaveProperty('course_complete', true)
    expect(snaked).toHaveProperty('streak_milestone', false)
    expect(snaked).toHaveProperty('quiet_hours_enabled', true)
    expect(snaked).toHaveProperty('quiet_hours_start', '22:00')
    expect(snaked).toHaveProperty('quiet_hours_end', '07:00')
  })
})

// ---------------------------------------------------------------------------
// E97-S04 R2 — F2: user-scoped column invariant
// Every non-skipSync, non-uploadOnly table must use 'user_id' as its effective
// user FK column (either by default or via fieldMap.userId). This assertion
// catches future schema drift where a new table introduces a non-standard user
// FK column without updating resolveUserColumn / fieldMap.
// ---------------------------------------------------------------------------

describe('tableRegistry — user-scoped column invariant (E97-S04 R2)', () => {
  it('every !skipSync && !uploadOnly table resolves to user_id as its user FK column', () => {
    const syncable = tableRegistry.filter(e => !e.skipSync && !e.uploadOnly)
    const violations: string[] = []
    for (const entry of syncable) {
      // resolveUserColumn logic: fieldMap['userId'] ?? 'user_id'
      const resolvedUserCol = entry.fieldMap['userId'] ?? 'user_id'
      if (resolvedUserCol !== 'user_id') {
        violations.push(
          `${entry.dexieTable}: fieldMap.userId resolves to '${resolvedUserCol}' instead of 'user_id'`
        )
      }
    }
    // Report all violations at once for actionable output.
    expect(violations).toEqual([])
  })

  it('only notificationPreferences uses fieldMap.id → user_id (singleton pattern)', () => {
    const singletons = tableRegistry.filter(e => e.fieldMap['id'] === 'user_id')
    const singletonNames = singletons.map(e => e.dexieTable)
    expect(singletonNames).toEqual(['notificationPreferences'])
  })
})

// ---------------------------------------------------------------------------
// getTableEntry helper
// ---------------------------------------------------------------------------

describe('getTableEntry', () => {
  it('returns the entry for a known table', () => {
    const entry = getTableEntry('notes')
    expect(entry?.dexieTable).toBe('notes')
  })

  it('returns undefined for an unknown table', () => {
    expect(getTableEntry('flashcard_reviews')).toBeUndefined()
    expect(getTableEntry('nonExistentTable')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// E96-S01 — P3/P4 Supabase migration coverage guardrail
// ---------------------------------------------------------------------------

describe('tableRegistry — P3/P4 Supabase migrations (E96-S01)', () => {
  it('P3/P4 sync tables have corresponding Supabase migrations', () => {
    // The 11 Dexie tables whose Postgres counterparts land in E96-S01.
    const p3p4DexieTables = [
      'learningPaths',
      'learningPathEntries',
      'challenges',
      'courseReminders',
      'notifications',
      'careerPaths',
      'pathEnrollments',
      'studySchedules',
      'quizzes',
      'quizAttempts',
      'aiUsageEvents',
    ]

    // Guardrail 1: each dexieTable has a registry entry with a supabaseTable.
    // If someone removes one of these from the registry, this fails with a
    // clear message naming the missing table.
    const missingFromRegistry = p3p4DexieTables.filter(t => !getTableEntry(t)?.supabaseTable)
    expect(missingFromRegistry).toEqual([])

    // Guardrail 2: concatenate both migration files and assert every
    // supabaseTable is present as `CREATE TABLE IF NOT EXISTS public.<name>`.
    // If a registry rename lands without the matching migration edit, this
    // fails with the offending supabaseTable name.
    const migrationsDir = join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations')
    const p3Sql = readFileSync(join(migrationsDir, '20260427000001_p3_sync.sql'), 'utf-8')
    const p4Sql = readFileSync(join(migrationsDir, '20260427000002_p4_sync.sql'), 'utf-8')
    const combined = p3Sql + '\n' + p4Sql

    const missingTables = p3p4DexieTables
      .map(dexieTable => ({
        dexieTable,
        supabaseTable: getTableEntry(dexieTable)!.supabaseTable,
      }))
      .filter(
        ({ supabaseTable }) =>
          !combined.includes(`CREATE TABLE IF NOT EXISTS public.${supabaseTable}`)
      )

    expect(missingTables).toEqual([])
  })
})
