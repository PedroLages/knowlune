import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'

const DB_NAME = 'MigrationV31Test'

beforeEach(async () => {
  await Dexie.delete(DB_NAME)
})

/**
 * Helper: create a Dexie instance at v30 (pre-FSRS) with SM-2 schema,
 * seed it with SM-2 data, then close and re-open with v31 migrations
 * to verify the upgrade callback transforms data correctly.
 */
async function seedV30Database(
  flashcards: Record<string, unknown>[] = [],
  reviewRecords: Record<string, unknown>[] = []
) {
  // Create DB at v30 schema (SM-2 indexes)
  const oldDb = new Dexie(DB_NAME)

  // Declare a minimal v30-like schema with SM-2 indexes
  oldDb.version(30).stores({
    flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    // Include other tables so they survive upgrade (Dexie deletes undeclared tables)
    importedCourses: 'id, name, importedAt, status, *tags, source',
    importedVideos: 'id, courseId, filename, youtubeVideoId',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    courseReminders: 'id, courseId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    authors: 'id, name, createdAt',
    careerPaths: 'id',
    pathEnrollments: 'id, pathId, status',
    entitlements: 'userId',
    learningPaths: 'id, createdAt',
    learningPathEntries: 'id, [pathId+courseId], pathId',
    youtubeVideoCache: 'videoId, expiresAt',
    youtubeTranscripts: '[courseId+videoId], courseId, videoId, status',
    youtubeChapters: 'id, courseId, order',
    notifications: 'id, type, createdAt, readAt, dismissedAt',
    notificationPreferences: 'id',
  })

  await oldDb.open()

  // Seed SM-2 data
  if (flashcards.length > 0) {
    await oldDb.table('flashcards').bulkAdd(flashcards)
  }
  if (reviewRecords.length > 0) {
    await oldDb.table('reviewRecords').bulkAdd(reviewRecords)
  }

  oldDb.close()
}

async function openWithV31Migrations(): Promise<Dexie> {
  const { declareLegacyMigrations } = await import('../schema')
  const newDb = new Dexie(DB_NAME)
  declareLegacyMigrations(newDb)
  await newDb.open()
  return newDb
}

describe('v31 FSRS migration — flashcards', () => {
  it('should transform SM-2 flashcard fields to FSRS fields', async () => {
    const cardId = crypto.randomUUID()
    await seedV30Database([
      {
        id: cardId,
        courseId: 'course-1',
        front: 'What is spaced repetition?',
        back: 'A technique for efficient review.',
        interval: 7,
        easeFactor: 2.1,
        reviewCount: 5,
        nextReviewAt: '2026-04-01T10:00:00.000Z',
        reviewedAt: '2026-03-25T10:00:00.000Z',
        lastRating: 'good',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-25T10:00:00.000Z',
      },
    ])

    const newDb = await openWithV31Migrations()
    const card = await newDb.table('flashcards').get(cardId)

    // FSRS fields should exist
    expect(card.stability).toBe(7) // interval → stability
    expect(card.difficulty).toBeCloseTo(3.33, 1) // (2.5-2.1)/(2.5-1.3)*10 ≈ 3.33
    expect(card.reps).toBe(5) // reviewCount → reps
    expect(card.lapses).toBe(0) // SM-2 doesn't track lapses
    expect(card.state).toBe(2) // Review (reviewCount>0, interval>=1)
    expect(card.scheduled_days).toBe(7) // interval → scheduled_days
    expect(card.due).toBe('2026-04-01T10:00:00.000Z') // nextReviewAt → due
    expect(card.last_review).toBe('2026-03-25T10:00:00.000Z') // reviewedAt → last_review
    expect(card.elapsed_days).toBeGreaterThanOrEqual(0) // computed from reviewedAt

    // SM-2 fields should be removed
    expect(card.easeFactor).toBeUndefined()
    expect(card.interval).toBeUndefined()
    expect(card.reviewCount).toBeUndefined()
    expect(card.nextReviewAt).toBeUndefined()
    expect(card.reviewedAt).toBeUndefined()

    // Non-migrated fields should survive
    expect(card.front).toBe('What is spaced repetition?')
    expect(card.back).toBe('A technique for efficient review.')
    expect(card.courseId).toBe('course-1')
    expect(card.lastRating).toBe('good')
    expect(card.createdAt).toBe('2026-03-01T10:00:00.000Z')

    newDb.close()
  })

  it('should handle new/never-reviewed flashcards (state=New)', async () => {
    const cardId = crypto.randomUUID()
    await seedV30Database([
      {
        id: cardId,
        courseId: 'course-1',
        front: 'New card',
        back: 'Never reviewed',
        interval: 0,
        easeFactor: 2.5,
        reviewCount: 0,
        createdAt: '2026-03-29T10:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z',
      },
    ])

    const newDb = await openWithV31Migrations()
    const card = await newDb.table('flashcards').get(cardId)

    expect(card.stability).toBe(0)
    expect(card.difficulty).toBeCloseTo(0, 1) // easeFactor 2.5 → difficulty 0
    expect(card.reps).toBe(0)
    expect(card.state).toBe(0) // New
    expect(card.due).toBe('2026-03-29T10:00:00.000Z') // falls back to createdAt
    expect(card.last_review).toBeUndefined() // never reviewed

    newDb.close()
  })

  it('should handle learning-phase flashcards (interval < 1, state=Learning)', async () => {
    const cardId = crypto.randomUUID()
    await seedV30Database([
      {
        id: cardId,
        courseId: 'course-1',
        front: 'Learning card',
        back: 'Just started',
        interval: 0.5,
        easeFactor: 2.3,
        reviewCount: 1,
        nextReviewAt: '2026-03-29T22:00:00.000Z',
        reviewedAt: '2026-03-29T10:00:00.000Z',
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z',
      },
    ])

    const newDb = await openWithV31Migrations()
    const card = await newDb.table('flashcards').get(cardId)

    expect(card.state).toBe(1) // Learning (interval < 1)
    expect(card.stability).toBe(0.5)
    expect(card.reps).toBe(1)

    newDb.close()
  })

  it('should use due index after migration', async () => {
    const pastDue = '2026-01-01T00:00:00.000Z'
    const futureDue = '2030-01-01T00:00:00.000Z'
    await seedV30Database([
      {
        id: crypto.randomUUID(),
        courseId: 'c1',
        front: 'Past',
        back: 'Due',
        interval: 3,
        easeFactor: 2.5,
        reviewCount: 1,
        nextReviewAt: pastDue,
        reviewedAt: '2025-12-29T00:00:00.000Z',
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2025-12-29T00:00:00.000Z',
      },
      {
        id: crypto.randomUUID(),
        courseId: 'c1',
        front: 'Future',
        back: 'Not due',
        interval: 30,
        easeFactor: 2.5,
        reviewCount: 5,
        nextReviewAt: futureDue,
        reviewedAt: '2029-12-02T00:00:00.000Z',
        createdAt: '2029-01-01T00:00:00.000Z',
        updatedAt: '2029-12-02T00:00:00.000Z',
      },
    ])

    const newDb = await openWithV31Migrations()
    const now = '2026-03-29T12:00:00.000Z'
    const dueCards = await newDb.table('flashcards').where('due').belowOrEqual(now).toArray()
    expect(dueCards).toHaveLength(1)
    expect(dueCards[0].front).toBe('Past')

    newDb.close()
  })
})

describe('v31 FSRS migration — reviewRecords', () => {
  it('should transform SM-2 review record fields to FSRS fields', async () => {
    const recordId = crypto.randomUUID()
    await seedV30Database(
      [],
      [
        {
          id: recordId,
          noteId: 'note-1',
          rating: 'good',
          interval: 14,
          easeFactor: 2.0,
          reviewCount: 8,
          nextReviewAt: '2026-04-10T10:00:00.000Z',
          reviewedAt: '2026-03-27T10:00:00.000Z',
        },
      ]
    )

    const newDb = await openWithV31Migrations()
    const record = await newDb.table('reviewRecords').get(recordId)

    // FSRS fields
    expect(record.stability).toBe(14) // interval → stability
    expect(record.difficulty).toBeCloseTo(4.17, 1) // (2.5-2.0)/(2.5-1.3)*10 ≈ 4.17
    expect(record.reps).toBe(8)
    expect(record.lapses).toBe(0)
    expect(record.state).toBe(2) // Review
    expect(record.scheduled_days).toBe(14)
    expect(record.due).toBe('2026-04-10T10:00:00.000Z')
    expect(record.last_review).toBe('2026-03-27T10:00:00.000Z')

    // SM-2 fields removed
    expect(record.easeFactor).toBeUndefined()
    expect(record.interval).toBeUndefined()
    expect(record.reviewCount).toBeUndefined()
    expect(record.nextReviewAt).toBeUndefined()
    expect(record.reviewedAt).toBeUndefined()

    // Preserved fields
    expect(record.noteId).toBe('note-1')
    expect(record.rating).toBe('good')

    newDb.close()
  })

  it('should use due and last_review indexes after migration', async () => {
    await seedV30Database(
      [],
      [
        {
          id: crypto.randomUUID(),
          noteId: 'note-1',
          rating: 'good',
          interval: 3,
          easeFactor: 2.5,
          reviewCount: 2,
          nextReviewAt: '2026-01-05T00:00:00.000Z',
          reviewedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: crypto.randomUUID(),
          noteId: 'note-2',
          rating: 'easy',
          interval: 30,
          easeFactor: 2.7,
          reviewCount: 10,
          nextReviewAt: '2030-01-01T00:00:00.000Z',
          reviewedAt: '2029-12-02T00:00:00.000Z',
        },
      ]
    )

    const newDb = await openWithV31Migrations()

    // Query by due index
    const dueRecords = await newDb
      .table('reviewRecords')
      .where('due')
      .belowOrEqual('2026-03-29T12:00:00.000Z')
      .toArray()
    expect(dueRecords).toHaveLength(1)
    expect(dueRecords[0].noteId).toBe('note-1')

    // Query by last_review index
    const recentlyReviewed = await newDb
      .table('reviewRecords')
      .where('last_review')
      .above('2029-01-01T00:00:00.000Z')
      .toArray()
    expect(recentlyReviewed).toHaveLength(1)
    expect(recentlyReviewed[0].noteId).toBe('note-2')

    newDb.close()
  })

  it('should handle review records with missing optional fields', async () => {
    const recordId = crypto.randomUUID()
    await seedV30Database(
      [],
      [
        {
          id: recordId,
          noteId: 'note-1',
          rating: 'hard',
          // Missing easeFactor, interval, reviewCount — should use defaults
        },
      ]
    )

    const newDb = await openWithV31Migrations()
    const record = await newDb.table('reviewRecords').get(recordId)

    expect(record.stability).toBe(0) // default interval=0
    expect(record.difficulty).toBeCloseTo(0, 1) // default easeFactor=2.5 → difficulty 0
    expect(record.reps).toBe(0) // default reviewCount=0
    expect(record.state).toBe(0) // New (reviewCount=0)
    expect(record.due).toBeDefined() // falls back to current time

    newDb.close()
  })
})

describe('v31 FSRS migration — edge cases', () => {
  it('should handle empty tables without error', async () => {
    await seedV30Database([], [])

    const newDb = await openWithV31Migrations()
    const flashcards = await newDb.table('flashcards').toArray()
    const reviews = await newDb.table('reviewRecords').toArray()

    expect(flashcards).toHaveLength(0)
    expect(reviews).toHaveLength(0)

    newDb.close()
  })

  it('should clamp extreme easeFactor values', async () => {
    const cardId = crypto.randomUUID()
    await seedV30Database([
      {
        id: cardId,
        courseId: 'c1',
        front: 'Extreme',
        back: 'Values',
        interval: 1,
        easeFactor: 0.5, // Below SM-2 minimum of 1.3
        reviewCount: 3,
        nextReviewAt: '2026-04-01T00:00:00.000Z',
        reviewedAt: '2026-03-31T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
      },
    ])

    const newDb = await openWithV31Migrations()
    const card = await newDb.table('flashcards').get(cardId)

    // easeFactor 0.5 clamped to 1.3 → difficulty = 10
    expect(card.difficulty).toBe(10)

    newDb.close()
  })

  it('should preserve other tables during migration', async () => {
    // Seed an importedCourse alongside flashcard data
    const oldDb = new Dexie(DB_NAME)
    oldDb.version(30).stores({
      flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
      reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
      importedCourses: 'id, name, importedAt, status, *tags, source',
      importedVideos: 'id, courseId, filename, youtubeVideoId',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
      screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
      contentProgress: '[courseId+itemId], courseId, itemId, status',
      challenges: 'id, type, deadline, createdAt',
      embeddings: 'noteId, createdAt',
      courseThumbnails: 'courseId',
      aiUsageEvents: 'id, featureType, timestamp, courseId',
      courseReminders: 'id, courseId',
      quizzes: 'id, lessonId, createdAt',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
      videoCaptions: '[courseId+videoId], courseId, videoId',
      authors: 'id, name, createdAt',
      careerPaths: 'id',
      pathEnrollments: 'id, pathId, status',
      entitlements: 'userId',
      learningPaths: 'id, createdAt',
      learningPathEntries: 'id, [pathId+courseId], pathId',
      youtubeVideoCache: 'videoId, expiresAt',
      youtubeTranscripts: '[courseId+videoId], courseId, videoId, status',
      youtubeChapters: 'id, courseId, order',
      notifications: 'id, type, createdAt, readAt, dismissedAt',
      notificationPreferences: 'id',
    })
    await oldDb.open()

    const courseId = crypto.randomUUID()
    await oldDb.table('importedCourses').add({
      id: courseId,
      name: 'My Course',
      importedAt: '2026-03-01T00:00:00.000Z',
      status: 'active',
      tags: ['test'],
      videoCount: 5,
      pdfCount: 0,
    })

    oldDb.close()

    // Re-open with v31 migrations
    const newDb = await openWithV31Migrations()
    const course = await newDb.table('importedCourses').get(courseId)
    expect(course).toBeDefined()
    expect(course.name).toBe('My Course')

    newDb.close()
  })
})
