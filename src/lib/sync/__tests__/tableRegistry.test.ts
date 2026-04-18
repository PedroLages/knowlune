import { describe, it, expect } from 'vitest'
import { tableRegistry, getTableEntry, type TableRegistryEntry } from '../tableRegistry'
import { toSnakeCase, toCamelCase } from '../fieldMapper'

// ---------------------------------------------------------------------------
// AC2 / 3.12 — All 38 tables registered
// ---------------------------------------------------------------------------

describe('tableRegistry — completeness', () => {
  it('has exactly 38 entries', () => {
    expect(tableRegistry).toHaveLength(38)
  })

  it('does not include flashcard_reviews (Supabase-only table)', () => {
    const entry = tableRegistry.find((e) => e.dexieTable === 'flashcard_reviews')
    expect(entry).toBeUndefined()
    const entry2 = tableRegistry.find((e) => e.supabaseTable === 'flashcard_reviews')
    expect(entry2).toBeUndefined()
  })

  it('all entries have unique dexieTable names', () => {
    const names = tableRegistry.map((e) => e.dexieTable)
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

  it.each(p0Tables)('%s has priority 0', (table) => {
    expect(getTableEntry(table)?.priority).toBe(0)
  })

  it.each(p1Tables)('%s has priority 1', (table) => {
    expect(getTableEntry(table)?.priority).toBe(1)
  })

  it.each(p2Tables)('%s has priority 2', (table) => {
    expect(getTableEntry(table)?.priority).toBe(2)
  })

  it.each(p3Tables)('%s has priority 3', (table) => {
    expect(getTableEntry(table)?.priority).toBe(3)
  })

  it.each(p4Tables)('%s has priority 4', (table) => {
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

  it('notes fieldMap has three entries: deleted, conflictCopy, conflictSourceId (E93-S03)', () => {
    const entry = getTableEntry('notes')
    expect(entry?.fieldMap).toMatchObject({
      deleted: 'soft_deleted',
      conflictCopy: 'conflict_copy',
      conflictSourceId: 'conflict_source_id',
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
    const sample = { id: 'abc', courseId: '123', createdAt: 1700000000000, updatedAt: '2024-01-01T00:00:00Z' }
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
      coverImageHandle: { kind: 'file' },      // non-serializable mock
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
