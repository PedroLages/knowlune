import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Dexie from 'dexie'
import { SYNCABLE_TABLES } from '@/lib/sync/backfill'

const DB_NAME = 'MigrationV52Test'

beforeEach(async () => {
  await Dexie.delete(DB_NAME)
})

afterEach(async () => {
  // Guarantee cleanup even if a test throws before explicit db.close().
  await Dexie.delete(DB_NAME)
})

/**
 * Seed a DB at v51-equivalent schema so the v52 upgrade callback has real data
 * to migrate. We declare only the subset of tables we'll seed (Dexie keeps
 * other tables intact on upgrade).
 */
async function seedV51Database(seed: {
  notes?: Array<Record<string, unknown>>
  bookmarks?: Array<Record<string, unknown>>
  contentProgress?: Array<Record<string, unknown>>
  flashcards?: Array<Record<string, unknown>>
  chatConversations?: Array<Record<string, unknown>>
  videoCaptions?: Array<Record<string, unknown>>
}): Promise<void> {
  const oldDb = new Dexie(DB_NAME)
  // Minimal v51 shape for the tables we seed.
  oldDb.version(51).stores({
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    flashcards: 'id, courseId, noteId, due, createdAt',
    chatConversations: 'id, [courseId+videoId], courseId, updatedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
  })
  await oldDb.open()

  if (seed.notes) await oldDb.table('notes').bulkAdd(seed.notes)
  if (seed.bookmarks) await oldDb.table('bookmarks').bulkAdd(seed.bookmarks)
  if (seed.contentProgress) await oldDb.table('contentProgress').bulkAdd(seed.contentProgress)
  if (seed.flashcards) await oldDb.table('flashcards').bulkAdd(seed.flashcards)
  if (seed.chatConversations) await oldDb.table('chatConversations').bulkAdd(seed.chatConversations)
  if (seed.videoCaptions) await oldDb.table('videoCaptions').bulkAdd(seed.videoCaptions)

  oldDb.close()
}

async function openWithFullMigrations(): Promise<Dexie> {
  const { declareLegacyMigrations } = await import('../schema')
  const newDb = new Dexie(DB_NAME)
  declareLegacyMigrations(newDb)
  await newDb.open()
  return newDb
}

/**
 * Collect a table's index `src` strings so we can assert index shape.
 * (Index src is the original declaration substring, e.g. "[userId+updatedAt]".)
 */
function tableIndexSrcs(db: Dexie, tableName: string): string[] {
  const table = db.table(tableName)
  return table.schema.indexes.map(idx => idx.src).sort()
}

describe('v52 sync migration — schema shape', () => {
  it('adds [userId+updatedAt] compound index to every syncable table', async () => {
    const db = await openWithFullMigrations()
    // Single source of truth — SYNCABLE_TABLES is the exported list in
    // src/lib/sync/backfill.ts. Mirrors (with a cross-ref comment) the
    // SYNCABLE_TABLES_V52 constant inside schema.ts's v52 upgrade callback.
    expect(SYNCABLE_TABLES.length).toBe(39)

    for (const tableName of SYNCABLE_TABLES) {
      const indexSrcs = tableIndexSrcs(db, tableName)
      expect(indexSrcs, `table "${tableName}" should have userId index`).toContain('userId')
      expect(
        indexSrcs,
        `table "${tableName}" should have [userId+updatedAt] compound index`
      ).toContain('[userId+updatedAt]')
    }

    db.close()
  })

  it('creates syncQueue table with expected indexes', async () => {
    const db = await openWithFullMigrations()
    const syncQueue = db.table('syncQueue')
    expect(syncQueue).toBeDefined()
    expect(syncQueue.schema.primKey.src).toBe('++id')
    const indexSrcs = tableIndexSrcs(db, 'syncQueue')
    expect(indexSrcs).toContain('status')
    expect(indexSrcs).toContain('[tableName+recordId]')
    expect(indexSrcs).toContain('createdAt')
    db.close()
  })

  it('creates syncMetadata table keyed by `table`', async () => {
    const db = await openWithFullMigrations()
    const syncMetadata = db.table('syncMetadata')
    expect(syncMetadata).toBeDefined()
    expect(syncMetadata.schema.primKey.src).toBe('table')
    db.close()
  })

  it('does NOT add sync fields to excluded tables', async () => {
    const db = await openWithFullMigrations()
    const excluded = [
      'videoCaptions',
      'courseThumbnails',
      'screenshots',
      'bookFiles',
      'transcriptEmbeddings',
      'courseEmbeddings',
      'youtubeVideoCache',
      'youtubeTranscripts',
      'youtubeChapters',
      'entitlements',
    ]
    for (const tableName of excluded) {
      const indexSrcs = tableIndexSrcs(db, tableName)
      expect(
        indexSrcs,
        `excluded table "${tableName}" should NOT have [userId+updatedAt]`
      ).not.toContain('[userId+updatedAt]')
    }
    db.close()
  })
})

describe('v52 sync migration — data preservation and updatedAt backfill', () => {
  it('preserves existing records when migrating from v51 to v52', async () => {
    await seedV51Database({
      notes: [
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          tags: ['foo'],
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        },
        {
          id: 'n2',
          courseId: 'c1',
          videoId: 'v2',
          tags: ['bar'],
          createdAt: '2025-01-03T00:00:00Z',
          updatedAt: '2025-01-04T00:00:00Z',
        },
      ],
      bookmarks: [{ id: 'b1', courseId: 'c1', lessonId: 'l1', createdAt: '2025-01-05T00:00:00Z' }],
    })
    const db = await openWithFullMigrations()

    const notes = await db.table('notes').toArray()
    expect(notes).toHaveLength(2)
    expect(notes.map(n => n.id).sort()).toEqual(['n1', 'n2'])

    const bookmarks = await db.table('bookmarks').toArray()
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0].id).toBe('b1')

    db.close()
  })

  it('preserves pre-existing updatedAt values (does not overwrite)', async () => {
    await seedV51Database({
      notes: [
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-06-15T12:00:00Z',
        },
      ],
      chatConversations: [
        { id: 'cc1', courseId: 'c1', videoId: 'v1', updatedAt: '2025-07-01T00:00:00Z' },
      ],
    })
    const db = await openWithFullMigrations()

    const note = await db.table('notes').get('n1')
    expect(note.updatedAt).toBe('2025-06-15T12:00:00Z')

    const conv = await db.table('chatConversations').get('cc1')
    expect(conv.updatedAt).toBe('2025-07-01T00:00:00Z')

    db.close()
  })

  it('stamps migrationNow on updatedAt when missing', async () => {
    await seedV51Database({
      bookmarks: [{ id: 'b1', courseId: 'c1', lessonId: 'l1', createdAt: '2025-01-05T00:00:00Z' }],
      contentProgress: [{ courseId: 'c1', itemId: 'i1', status: 'in_progress' }],
      flashcards: [
        {
          id: 'f1',
          courseId: 'c1',
          noteId: 'n1',
          due: '2025-02-01T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
    })
    const beforeMigration = Date.now()
    const db = await openWithFullMigrations()

    const bookmark = await db.table('bookmarks').get('b1')
    expect(bookmark.updatedAt).toBeTypeOf('string')
    expect(new Date(bookmark.updatedAt).getTime()).toBeGreaterThanOrEqual(beforeMigration - 1000)

    const progress = await db.table('contentProgress').get(['c1', 'i1'])
    expect(progress.updatedAt).toBeTypeOf('string')

    const flashcard = await db.table('flashcards').get('f1')
    expect(flashcard.updatedAt).toBeTypeOf('string')

    db.close()
  })

  it('does NOT stamp userId during migration (deferred to backfillUserId)', async () => {
    await seedV51Database({
      notes: [
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        },
      ],
    })
    const db = await openWithFullMigrations()
    const note = await db.table('notes').get('n1')
    expect(note.userId).toBeUndefined()
    db.close()
  })

  it('does not touch excluded tables during upgrade (videoCaptions unchanged)', async () => {
    await seedV51Database({
      videoCaptions: [{ courseId: 'c1', videoId: 'v1', captions: [] }],
    })
    const db = await openWithFullMigrations()
    const cap = await db.table('videoCaptions').get(['c1', 'v1'])
    expect(cap).toBeDefined()
    // No userId, no updatedAt — excluded from the sync registry.
    expect(cap.userId).toBeUndefined()
    expect(cap.updatedAt).toBeUndefined()
    db.close()
  })

  it('is idempotent — re-opening the DB does not clobber the stamped updatedAt', async () => {
    await seedV51Database({
      bookmarks: [{ id: 'b1', courseId: 'c1', lessonId: 'l1', createdAt: '2025-01-05T00:00:00Z' }],
    })
    const db1 = await openWithFullMigrations()
    const firstStamp = (await db1.table('bookmarks').get('b1')).updatedAt as string
    expect(firstStamp).toBeTypeOf('string')
    db1.close()

    // Small delay so a second migration would produce a different timestamp if
    // the upgrade callback re-ran unexpectedly.
    await new Promise(resolve => setTimeout(resolve, 20))

    const { declareLegacyMigrations } = await import('../schema')
    const db2 = new Dexie(DB_NAME)
    declareLegacyMigrations(db2)
    await db2.open()
    const secondStamp = (await db2.table('bookmarks').get('b1')).updatedAt as string
    expect(secondStamp).toBe(firstStamp)
    db2.close()
  })
})
