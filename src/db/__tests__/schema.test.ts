import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie, { type Table } from 'dexie'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { createChallenge } from '../../../tests/support/fixtures/factories/challenge-factory'

// Must import after fake-indexeddb/auto polyfill is active
let db: Awaited<typeof import('@/db/schema')>['db']

beforeEach(async () => {
  // Delete any existing database before each test
  await Dexie.delete('ElearningDB')
  // Re-import fresh db instance
  const module = await import('@/db/schema')
  db = module.db
})

function makeCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Test Course',
    importedAt: new Date().toISOString(),
    category: '',
    tags: [] as string[],
    status: 'active' as const,
    videoCount: 0,
    pdfCount: 0,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

function makeVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    courseId: crypto.randomUUID(),
    filename: 'lesson-01.mp4',
    path: '/course/lesson-01.mp4',
    duration: 120,
    format: 'mp4' as const,
    order: 1,
    fileHandle: {} as FileSystemFileHandle,
    ...overrides,
  }
}

describe('ElearningDB schema', () => {
  it('should create the database with correct tables including notes', async () => {
    expect(db.name).toBe('ElearningDB')
    // courses table dropped in v30 (E89-S01)
    expect(db.tables.map(t => t.name).sort()).toEqual([
      'aiUsageEvents',
      'audioBookmarks',
      'audioClips',
      'audiobookshelfServers',
      'authors',
      'bookFiles',
      'bookHighlights',
      'bookReviews',
      'bookShelves',
      'bookmarks',
      'books',
      'careerPaths',
      'challenges',
      'chapterMappings',
      'chatConversations',
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
      'readingQueue',
      'reviewRecords',
      'screenshots',
      'shelves',
      'studySchedules',
      'studySessions',
      'transcriptEmbeddings',
      'videoCaptions',
      'vocabularyItems',
      'youtubeChapters',
      'youtubeTranscripts',
      'youtubeVideoCache',
    ])
  })

  it('should be at version 50', () => {
    expect(db.verno).toBe(50)
  })

  it('should have entitlements table with userId as primary key', () => {
    expect(db.entitlements.schema.primKey.name).toBe('userId')
  })

  it('should have series index on books table (v45)', () => {
    const booksIndexNames = db.books.schema.indexes.map(i => i.name)
    expect(booksIndexNames).toContain('series')
  })

  it('should preserve key indexes on existing v16 tables in v17 migration', async () => {
    // Dexie uses i.name for the index identifier (e.g. '[courseId+lessonId]', '*tags')
    const bookmarkIndexNames = db.bookmarks.schema.indexes.map(i => i.name)
    expect(bookmarkIndexNames).toContain('[courseId+lessonId]')

    const contentProgressPrimKey = db.contentProgress.schema.primKey.name
    expect(contentProgressPrimKey).toBe('[courseId+itemId]')

    const notesIndexNames = db.notes.schema.indexes.map(i => i.name)
    expect(notesIndexNames).toContain('[courseId+videoId]')
    expect(notesIndexNames).toContain('tags') // Dexie stores multi-entry index name without the '*' prefix
  })
})

describe('importedCourses table', () => {
  it('should add and retrieve a course', async () => {
    const course = makeCourse({
      name: 'React Patterns',
      tags: ['react', 'patterns'],
      videoCount: 10,
      pdfCount: 2,
    })

    await db.importedCourses.add(course)
    const retrieved = await db.importedCourses.get(course.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('React Patterns')
    expect(retrieved!.videoCount).toBe(10)
    expect(retrieved!.pdfCount).toBe(2)
  })

  it('should query courses by name index', async () => {
    const course = makeCourse({ name: 'TypeScript Deep Dive', videoCount: 5 })

    await db.importedCourses.add(course)
    const results = await db.importedCourses.where('name').equals('TypeScript Deep Dive').toArray()
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(course.id)
  })

  it('should query courses by tags multi-entry index', async () => {
    const course1 = makeCourse({ name: 'Course A', tags: ['react', 'frontend'], videoCount: 5 })
    const course2 = makeCourse({
      name: 'Course B',
      tags: ['backend', 'node'],
      videoCount: 3,
      pdfCount: 1,
    })

    await db.importedCourses.bulkAdd([course1, course2])
    const reactCourses = await db.importedCourses.where('tags').equals('react').toArray()
    expect(reactCourses).toHaveLength(1)
    expect(reactCourses[0].name).toBe('Course A')
  })

  it('should delete a course by id', async () => {
    const course = makeCourse({ name: 'To Delete' })
    await db.importedCourses.add(course)

    await db.importedCourses.delete(course.id)
    const result = await db.importedCourses.get(course.id)
    expect(result).toBeUndefined()
  })

  it('should update a course', async () => {
    const course = makeCourse({ name: 'Original Name' })
    await db.importedCourses.add(course)

    await db.importedCourses.update(course.id, { name: 'Updated Name' })
    const updated = await db.importedCourses.get(course.id)
    expect(updated!.name).toBe('Updated Name')
  })
})

describe('importedVideos table', () => {
  it('should add and retrieve videos by courseId', async () => {
    const courseId = crypto.randomUUID()
    const videos = [
      makeVideo({ courseId, filename: 'lesson-01.mp4', path: '/course/lesson-01.mp4', order: 1 }),
      makeVideo({
        courseId,
        filename: 'lesson-02.mp4',
        path: '/course/lesson-02.mp4',
        duration: 240,
        order: 2,
      }),
    ]

    await db.importedVideos.bulkAdd(videos)
    const results = await db.importedVideos.where('courseId').equals(courseId).toArray()
    expect(results).toHaveLength(2)
    expect(results.map(v => v.filename).sort()).toEqual(['lesson-01.mp4', 'lesson-02.mp4'])
  })

  it('should query videos by filename', async () => {
    const video = makeVideo({
      filename: 'unique-video.webm',
      path: '/course/unique-video.webm',
      format: 'webm',
      duration: 60,
    })

    await db.importedVideos.add(video)
    const results = await db.importedVideos.where('filename').equals('unique-video.webm').toArray()
    expect(results).toHaveLength(1)
  })
})

describe('importedPdfs table', () => {
  it('should add and retrieve PDFs by courseId', async () => {
    const courseId = crypto.randomUUID()
    const pdfs = [
      {
        id: crypto.randomUUID(),
        courseId,
        filename: 'workbook.pdf',
        path: '/course/workbook.pdf',
        pageCount: 25,
        fileHandle: {} as FileSystemFileHandle,
      },
    ]

    await db.importedPdfs.bulkAdd(pdfs)
    const results = await db.importedPdfs.where('courseId').equals(courseId).toArray()
    expect(results).toHaveLength(1)
    expect(results[0].pageCount).toBe(25)
  })
})

describe('bulk operations', () => {
  it('should handle bulkAdd for batch imports', async () => {
    const courseId = crypto.randomUUID()
    const videos = Array.from({ length: 50 }, (_, i) =>
      makeVideo({
        courseId,
        filename: `lesson-${String(i + 1).padStart(2, '0')}.mp4`,
        path: `/course/lesson-${String(i + 1).padStart(2, '0')}.mp4`,
        duration: 120 + i * 10,
        order: i + 1,
      })
    )

    await db.importedVideos.bulkAdd(videos)
    const count = await db.importedVideos.where('courseId').equals(courseId).count()
    expect(count).toBe(50)
  })
})

describe('challenges table (v8)', () => {
  it('should add and retrieve a challenge', async () => {
    const challenge = createChallenge({ name: 'Watch 5 videos' })
    await db.challenges.add(challenge)

    const retrieved = await db.challenges.get(challenge.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('Watch 5 videos')
    expect(retrieved!.currentProgress).toBe(0)
  })

  it('should query challenges by type index', async () => {
    await db.challenges.bulkAdd([
      createChallenge({ type: 'completion' }),
      createChallenge({ type: 'time' }),
      createChallenge({ type: 'completion' }),
    ])

    const completionChallenges = await db.challenges.where('type').equals('completion').toArray()
    expect(completionChallenges).toHaveLength(2)
  })

  it('should query challenges by deadline index', async () => {
    await db.challenges.bulkAdd([
      createChallenge({ deadline: '2030-06-01' }),
      createChallenge({ deadline: '2030-12-31' }),
    ])

    const results = await db.challenges.where('deadline').equals('2030-06-01').toArray()
    expect(results).toHaveLength(1)
    expect(results[0].deadline).toBe('2030-06-01')
  })

  it('should query challenges by createdAt index', async () => {
    const ts1 = '2026-01-01T00:00:00.000Z'
    const ts2 = '2026-06-01T00:00:00.000Z'
    await db.challenges.bulkAdd([
      createChallenge({ createdAt: ts1 }),
      createChallenge({ createdAt: ts2 }),
    ])

    const results = await db.challenges.where('createdAt').above(ts1).toArray()
    expect(results).toHaveLength(1)
    expect(results[0].createdAt).toBe(ts2)
  })

  it('should delete a challenge by id', async () => {
    const challenge = createChallenge()
    await db.challenges.add(challenge)

    await db.challenges.delete(challenge.id)
    const result = await db.challenges.get(challenge.id)
    expect(result).toBeUndefined()
  })
})

describe('notes table (v4)', () => {
  function makeNote(overrides: Record<string, unknown> = {}) {
    return {
      id: crypto.randomUUID(),
      courseId: 'course-1',
      videoId: crypto.randomUUID(),
      content: 'Test note',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [] as string[],
      ...overrides,
    }
  }

  it('should add and retrieve a note', async () => {
    const note = makeNote({ content: 'Study notes on influence' })
    await db.notes.add(note)

    const retrieved = await db.notes.get(note.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.content).toBe('Study notes on influence')
  })

  it('should allow same videoId across different courses via compound index', async () => {
    const videoId = 'lesson-1'
    await db.notes.add(makeNote({ courseId: 'course-a', videoId }))
    await db.notes.add(makeNote({ courseId: 'course-b', videoId }))

    const results = await db.notes.where({ courseId: 'course-a', videoId }).toArray()
    expect(results).toHaveLength(1)
    expect(results[0].courseId).toBe('course-a')
  })

  it('should query notes by courseId index', async () => {
    await db.notes.bulkAdd([
      makeNote({ courseId: 'c1', videoId: 'v1' }),
      makeNote({ courseId: 'c1', videoId: 'v2' }),
      makeNote({ courseId: 'c2', videoId: 'v3' }),
    ])

    const results = await db.notes.where('courseId').equals('c1').toArray()
    expect(results).toHaveLength(2)
  })

  it('should query notes by tags multi-entry index', async () => {
    await db.notes.bulkAdd([
      makeNote({ videoId: 'v1', tags: ['react', 'hooks'] }),
      makeNote({ videoId: 'v2', tags: ['typescript'] }),
    ])

    const reactNotes = await db.notes.where('tags').equals('react').toArray()
    expect(reactNotes).toHaveLength(1)
    expect(reactNotes[0].tags).toContain('react')
  })

  it('should query notes by compound [courseId+videoId] index', async () => {
    const note = makeNote({ courseId: 'c1', videoId: 'unique-lesson' })
    await db.notes.add(note)

    const result = await db.notes.where({ courseId: 'c1', videoId: 'unique-lesson' }).first()
    expect(result).toBeDefined()
    expect(result!.id).toBe(note.id)
  })
})

describe('v4 migration from localStorage', () => {
  it('should migrate notes from localStorage course-progress', async () => {
    // Step 1: Seed localStorage with legacy notes data
    const legacyData = {
      'course-1': {
        courseId: 'course-1',
        completedLessons: [],
        notes: {
          'lesson-1': [
            {
              id: 'note-1',
              content: 'Important concept',
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-02T00:00:00.000Z',
              tags: ['important'],
            },
          ],
          'lesson-2': [
            {
              id: 'note-2',
              content: 'Key takeaway',
              createdAt: '2025-01-03T00:00:00.000Z',
              updatedAt: '2025-01-03T00:00:00.000Z',
              tags: [],
            },
          ],
        },
        startedAt: '2025-01-01T00:00:00.000Z',
        lastAccessedAt: '2025-01-03T00:00:00.000Z',
      },
    }
    localStorage.setItem('course-progress', JSON.stringify(legacyData))

    // Step 2: Create a v3 database (without notes table) so the v4 upgrade triggers
    await Dexie.delete('ElearningDB')
    const v3Db = new Dexie('ElearningDB')
    v3Db.version(3).stores({
      importedCourses: 'id, name, importedAt, status, *tags',
      importedVideos: 'id, courseId, filename',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, courseId, lessonId, createdAt',
    })
    await v3Db.open()
    v3Db.close()

    // Step 3: Re-import the real schema module (v4) to trigger upgrade
    vi.resetModules()
    const module = await import('@/db/schema')
    db = module.db

    // Verify notes were migrated
    const notes = await db.notes.toArray()
    expect(notes).toHaveLength(2)

    const note1 = notes.find(n => n.id === 'note-1')
    expect(note1).toBeDefined()
    expect(note1!.courseId).toBe('course-1')
    expect(note1!.videoId).toBe('lesson-1')
    expect(note1!.content).toBe('Important concept')
    expect(note1!.tags).toEqual(['important'])

    const note2 = notes.find(n => n.id === 'note-2')
    expect(note2).toBeDefined()
    expect(note2!.videoId).toBe('lesson-2')

    // Verify localStorage was NOT deleted (retained as backup per AC)
    expect(localStorage.getItem('course-progress')).not.toBeNull()

    // Clean up
    localStorage.removeItem('course-progress')
  })
})

describe('authors table (v20)', () => {
  function makeAuthor(overrides: Record<string, unknown> = {}) {
    const now = new Date().toISOString()
    return {
      id: crypto.randomUUID(),
      name: 'Test Author',
      bio: 'A test bio',
      photoUrl: '',
      courseIds: [] as string[],
      isPreseeded: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  it('should add and retrieve an author', async () => {
    const author = makeAuthor({ name: 'Jane Doe' })
    await db.authors.add(author)

    const retrieved = await db.authors.get(author.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('Jane Doe')
    expect(retrieved!.courseIds).toEqual([])
  })

  it('should query authors by name index', async () => {
    await db.authors.add(makeAuthor({ name: 'Alice' }))
    await db.authors.add(makeAuthor({ name: 'Bob' }))

    const results = await db.authors.where('name').equals('Alice').toArray()
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Alice')
  })

  it('should query authors by createdAt index', async () => {
    const ts1 = '2026-01-01T00:00:00.000Z'
    const ts2 = '2026-06-01T00:00:00.000Z'
    await db.authors.bulkAdd([
      makeAuthor({ createdAt: ts1, updatedAt: ts1 }),
      makeAuthor({ createdAt: ts2, updatedAt: ts2 }),
    ])

    const results = await db.authors.where('createdAt').above(ts1).toArray()
    expect(results).toHaveLength(1)
    expect(results[0].createdAt).toBe(ts2)
  })

  it('should delete an author by id', async () => {
    const author = makeAuthor()
    await db.authors.add(author)

    await db.authors.delete(author.id)
    const result = await db.authors.get(author.id)
    expect(result).toBeUndefined()
  })

  it('should update an author', async () => {
    const author = makeAuthor({ name: 'Original' })
    await db.authors.add(author)

    await db.authors.update(author.id, { name: 'Updated' })
    const updated = await db.authors.get(author.id)
    expect(updated!.name).toBe('Updated')
  })
})

describe('v20 migration edge cases', () => {
  /**
   * Helper: create a v19 database with importedCourses data, then trigger v20 upgrade.
   * Returns the upgraded db instance.
   */
  async function migrateFromV19(courses: Array<Record<string, unknown>> = []) {
    await Dexie.delete('ElearningDB')

    // Create a v19 database with importedCourses
    const v19Db = new Dexie('ElearningDB')
    v19Db.version(19).stores({
      importedCourses: 'id, name, importedAt, status, *tags',
      importedVideos: 'id, courseId, filename',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
      screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
      contentProgress: '[courseId+itemId], courseId, itemId, status',
      challenges: 'id, type, deadline, createdAt',
      embeddings: 'noteId, createdAt',
      learningPath: 'courseId, position, generatedAt',
      courseThumbnails: 'courseId',
      aiUsageEvents: 'id, featureType, timestamp, courseId',
      reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
      courseReminders: 'id, courseId',
      courses: 'id, category, difficulty, authorId',
      quizzes: 'id, lessonId, createdAt',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
      videoCaptions: '[courseId+videoId], courseId, videoId',
    })
    await v19Db.open()

    // Seed importedCourses with authorName data
    if (courses.length > 0) {
      await v19Db.table('importedCourses').bulkAdd(courses)
    }

    v19Db.close()

    // Re-import the real schema module (v20) to trigger upgrade
    vi.resetModules()
    const module = await import('@/db/schema')
    db = module.db

    return db
  }

  function makeMigrationCourse(overrides: Record<string, unknown> = {}) {
    return {
      id: crypto.randomUUID(),
      name: 'Test Course',
      importedAt: new Date().toISOString(),
      category: '',
      tags: [] as string[],
      status: 'active',
      videoCount: 0,
      pdfCount: 0,
      directoryHandle: {} as FileSystemDirectoryHandle,
      ...overrides,
    }
  }

  it('should handle 0 courses (empty library) — only Chase Hughes is seeded', async () => {
    const upgradedDb = await migrateFromV19([])

    const authors = await upgradedDb.authors.toArray()
    expect(authors).toHaveLength(1)
    expect(authors[0].name).toBe('Chase Hughes')
    expect(authors[0].isPreseeded).toBe(true)
  })

  it('should deduplicate authorNames (case-insensitive, trimmed)', async () => {
    const courses = [
      makeMigrationCourse({ authorName: 'John Smith' }),
      makeMigrationCourse({ authorName: 'john smith' }),
      makeMigrationCourse({ authorName: ' John Smith ' }),
    ]

    const upgradedDb = await migrateFromV19(courses)

    const authors = await upgradedDb.authors.toArray()
    // 1 Chase Hughes (pre-seeded) + 1 John Smith (deduplicated)
    expect(authors).toHaveLength(2)

    // Migration stores the first-seen name (after trim). Since toArray() returns
    // records in primary-key (UUID) sort order, the first-seen variant is
    // non-deterministic. Match case-insensitively to avoid flakiness.
    const johnSmith = authors.find(a => a.name.toLowerCase() === 'john smith')
    expect(johnSmith).toBeDefined()
    expect(johnSmith!.courseIds).toHaveLength(3) // All 3 courses linked
    expect(johnSmith!.isPreseeded).toBe(false)
  })

  it('should skip empty authorName strings', async () => {
    const courses = [
      makeMigrationCourse({ authorName: '' }),
      makeMigrationCourse({ authorName: '   ' }),
      makeMigrationCourse({ authorName: 'Valid Author' }),
    ]

    const upgradedDb = await migrateFromV19(courses)

    const authors = await upgradedDb.authors.toArray()
    // 1 Chase Hughes + 1 Valid Author (empty strings skipped)
    expect(authors).toHaveLength(2)

    const validAuthor = authors.find(a => a.name === 'Valid Author')
    expect(validAuthor).toBeDefined()
    expect(validAuthor!.courseIds).toHaveLength(1)
  })
})

describe('quizzes table', () => {
  // Schema-level fixture: questions intentionally empty — Dexie doesn't enforce Zod constraints at
  // write time, so these tests validate index behavior only, not quiz content validity.
  function makeQuiz(overrides: Record<string, unknown> = {}): Quiz {
    return {
      id: crypto.randomUUID(),
      lessonId: crypto.randomUUID(),
      title: 'Test Quiz',
      description: 'A test quiz',
      questions: [],
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
      ...overrides,
    } as Quiz
  }

  it('should add and retrieve a quiz', async () => {
    const quiz = makeQuiz()
    await db.quizzes.add(quiz)
    const retrieved = await db.quizzes.get(quiz.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.title).toBe('Test Quiz')
  })

  it('should query by lessonId index', async () => {
    const lessonId = crypto.randomUUID()
    await db.quizzes.add(makeQuiz({ lessonId }))
    const results = await db.quizzes.where('lessonId').equals(lessonId).toArray()
    expect(results).toHaveLength(1)
    expect(results[0].lessonId).toBe(lessonId)
  })

  it('should query by createdAt index', async () => {
    const t1 = '2026-01-01T00:00:00.000Z'
    const t2 = '2026-01-02T00:00:00.000Z'
    await db.quizzes.bulkAdd([makeQuiz({ createdAt: t1 }), makeQuiz({ createdAt: t2 })])
    const results = await db.quizzes.where('createdAt').above(t1).toArray()
    expect(results).toHaveLength(1)
    expect(results[0].createdAt).toBe(t2)
  })
})

describe('quizAttempts table', () => {
  // Schema-level fixture: answers intentionally empty — Dexie doesn't enforce Zod constraints at
  // write time. score/percentage/passed values are fixed constants for index testing only.
  function makeAttempt(overrides: Record<string, unknown> = {}): QuizAttempt {
    return {
      id: crypto.randomUUID(),
      quizId: crypto.randomUUID(),
      answers: [],
      score: 80,
      percentage: 80,
      passed: true,
      timeSpent: 120,
      completedAt: '2026-01-15T10:00:00.000Z',
      startedAt: '2026-01-15T09:58:00.000Z',
      timerAccommodation: 'standard',
      ...overrides,
    } as QuizAttempt
  }

  it('should add and retrieve an attempt', async () => {
    const attempt = makeAttempt()
    await db.quizAttempts.add(attempt)
    const retrieved = await db.quizAttempts.get(attempt.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.score).toBe(80)
  })

  it('should query attempts by quizId using compound index', async () => {
    const quizId = crypto.randomUUID()
    const t1 = '2024-01-01T00:00:00.000Z'
    const t2 = '2024-01-02T00:00:00.000Z'
    await db.quizAttempts.bulkAdd([
      makeAttempt({ quizId, completedAt: t1 }),
      makeAttempt({ quizId, completedAt: t2 }),
    ])
    // EntityTable<T, K> doesn't expose compound index names in its where() types;
    // cast to Table<T> to access compound indexes while preserving QuizAttempt return type.
    const results = await (db.quizAttempts as Table<QuizAttempt>)
      .where('[quizId+completedAt]')
      .between([quizId, Dexie.minKey], [quizId, Dexie.maxKey])
      .toArray()
    expect(results).toHaveLength(2)
    // Results are ordered ascending by completedAt within the compound index range
    expect(results[results.length - 1].completedAt).toBe(t2)
  })

  it('should query attempts by completedAt index', async () => {
    const t1 = '2024-01-01T00:00:00.000Z'
    const t2 = '2024-01-02T00:00:00.000Z'
    await db.quizAttempts.bulkAdd([
      makeAttempt({ completedAt: t1 }),
      makeAttempt({ completedAt: t2 }),
    ])
    const results = await db.quizAttempts.where('completedAt').above(t1).toArray()
    expect(results).toHaveLength(1)
    expect(results[0].completedAt).toBe(t2)
  })
})

describe('flashcards table (v31 — FSRS fields)', () => {
  function makeFlashcard(overrides: Record<string, unknown> = {}) {
    return {
      id: crypto.randomUUID(),
      courseId: 'course-1',
      front: 'What is spaced repetition?',
      back: 'A learning technique that spaces reviews at increasing intervals.',
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      state: 0 as const, // New
      elapsed_days: 0,
      scheduled_days: 0,
      due: '2026-03-23T10:00:00.000Z',
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
      ...overrides,
    }
  }

  it('should add and retrieve a flashcard with FSRS fields', async () => {
    const card = makeFlashcard({ front: 'What is FSRS?' })
    await db.flashcards.add(card)
    const retrieved = await db.flashcards.get(card.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.front).toBe('What is FSRS?')
    expect(retrieved!.stability).toBe(0)
    expect(retrieved!.difficulty).toBe(0)
    expect(retrieved!.reps).toBe(0)
    expect(retrieved!.state).toBe(0)
  })

  it('should query flashcards by courseId index', async () => {
    const courseId = crypto.randomUUID()
    await db.flashcards.bulkAdd([
      makeFlashcard({ courseId, front: 'Card 1' }),
      makeFlashcard({ courseId, front: 'Card 2' }),
      makeFlashcard({ courseId: 'other-course', front: 'Card 3' }),
    ])
    const results = await db.flashcards.where('courseId').equals(courseId).toArray()
    expect(results).toHaveLength(2)
  })

  it('should query flashcards due for review by due index', async () => {
    const past = '2026-01-01T00:00:00.000Z'
    const future = '2030-01-01T00:00:00.000Z'
    await db.flashcards.bulkAdd([makeFlashcard({ due: past }), makeFlashcard({ due: future })])
    const now = '2026-03-23T10:00:00.000Z'
    const dueCards = await db.flashcards.where('due').belowOrEqual(now).toArray()
    expect(dueCards).toHaveLength(1)
    expect(dueCards[0].due).toBe(past)
  })

  it('should query flashcards by optional noteId index', async () => {
    const noteId = crypto.randomUUID()
    await db.flashcards.bulkAdd([
      makeFlashcard({ noteId, front: 'From note' }),
      makeFlashcard({ front: 'Standalone' }),
    ])
    const fromNote = await db.flashcards.where('noteId').equals(noteId).toArray()
    expect(fromNote).toHaveLength(1)
    expect(fromNote[0].front).toBe('From note')
  })

  it('should delete a flashcard', async () => {
    const card = makeFlashcard()
    await db.flashcards.add(card)
    await db.flashcards.delete(card.id)
    const result = await db.flashcards.get(card.id)
    expect(result).toBeUndefined()
  })
})

describe('v26 YouTube schema', () => {
  it('should have source index on importedCourses', () => {
    const indexNames = db.importedCourses.schema.indexes.map(i => i.name)
    expect(indexNames).toContain('source')
  })

  it('should have youtubeVideoId index on importedVideos', () => {
    const indexNames = db.importedVideos.schema.indexes.map(i => i.name)
    expect(indexNames).toContain('youtubeVideoId')
  })

  it('should have youtubeVideoCache table with videoId PK and expiresAt index', () => {
    expect(db.youtubeVideoCache.schema.primKey.name).toBe('videoId')
    const indexNames = db.youtubeVideoCache.schema.indexes.map(i => i.name)
    expect(indexNames).toContain('expiresAt')
  })

  it('should have youtubeTranscripts table with compound PK and indexes', () => {
    expect(db.youtubeTranscripts.schema.primKey.name).toBe('[courseId+videoId]')
    const indexNames = db.youtubeTranscripts.schema.indexes.map(i => i.name)
    expect(indexNames).toContain('courseId')
    expect(indexNames).toContain('videoId')
    expect(indexNames).toContain('status')
  })

  it('should have youtubeChapters table with id PK and courseId/order indexes', () => {
    expect(db.youtubeChapters.schema.primKey.name).toBe('id')
    const indexNames = db.youtubeChapters.schema.indexes.map(i => i.name)
    expect(indexNames).toContain('courseId')
    expect(indexNames).toContain('order')
  })

  it('should add and retrieve a YouTube video cache entry', async () => {
    const entry = {
      videoId: 'dQw4w9WgXcQ',
      title: 'Test Video',
      description: 'A test YouTube video',
      channelId: 'UCtest',
      channelTitle: 'Test Channel',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
      duration: 212,
      publishedAt: '2009-10-25T00:00:00.000Z',
      chapters: [],
      fetchedAt: '2026-03-26T10:00:00.000Z',
      expiresAt: '2026-03-27T10:00:00.000Z',
    }
    await db.youtubeVideoCache.add(entry)
    const retrieved = await db.youtubeVideoCache.get('dQw4w9WgXcQ')
    expect(retrieved).toBeDefined()
    expect(retrieved!.title).toBe('Test Video')
    expect(retrieved!.duration).toBe(212)
  })

  it('should query youtubeVideoCache by expiresAt index', async () => {
    const expired = '2026-01-01T00:00:00.000Z'
    const fresh = '2030-01-01T00:00:00.000Z'
    await db.youtubeVideoCache.bulkAdd([
      {
        videoId: 'vid1',
        title: 'Expired',
        description: '',
        channelId: 'ch1',
        channelTitle: 'Ch',
        thumbnailUrl: '',
        duration: 60,
        publishedAt: '2026-01-01T00:00:00.000Z',
        chapters: [],
        fetchedAt: '2025-12-01T00:00:00.000Z',
        expiresAt: expired,
      },
      {
        videoId: 'vid2',
        title: 'Fresh',
        description: '',
        channelId: 'ch1',
        channelTitle: 'Ch',
        thumbnailUrl: '',
        duration: 120,
        publishedAt: '2026-01-01T00:00:00.000Z',
        chapters: [],
        fetchedAt: '2026-03-26T00:00:00.000Z',
        expiresAt: fresh,
      },
    ])
    const now = '2026-03-26T12:00:00.000Z'
    const expiredEntries = await db.youtubeVideoCache.where('expiresAt').below(now).toArray()
    expect(expiredEntries).toHaveLength(1)
    expect(expiredEntries[0].videoId).toBe('vid1')
  })

  it('should add and query youtubeTranscripts by compound PK', async () => {
    const transcript = {
      courseId: 'course-1',
      videoId: 'vid-abc',
      language: 'en',
      cues: [{ startTime: 0, endTime: 5, text: 'Hello' }],
      fullText: 'Hello',
      source: 'youtube-transcript' as const,
      status: 'done' as const,
      fetchedAt: '2026-03-26T10:00:00.000Z',
    }
    await db.youtubeTranscripts.add(transcript)
    const retrieved = await db.youtubeTranscripts.get(['course-1', 'vid-abc'])
    expect(retrieved).toBeDefined()
    expect(retrieved!.language).toBe('en')
    expect(retrieved!.cues).toHaveLength(1)
    expect(retrieved!.fullText).toBe('Hello')
    expect(retrieved!.source).toBe('youtube-transcript')
    expect(retrieved!.status).toBe('done')
  })

  it('should query youtubeTranscripts by courseId index', async () => {
    await db.youtubeTranscripts.bulkAdd([
      {
        courseId: 'c1',
        videoId: 'v1',
        language: 'en',
        cues: [],
        fullText: '',
        source: 'youtube-transcript' as const,
        status: 'done' as const,
        fetchedAt: '2026-03-26T10:00:00.000Z',
      },
      {
        courseId: 'c1',
        videoId: 'v2',
        language: 'en',
        cues: [],
        fullText: '',
        source: 'youtube-transcript' as const,
        status: 'done' as const,
        fetchedAt: '2026-03-26T10:00:00.000Z',
      },
      {
        courseId: 'c2',
        videoId: 'v3',
        language: 'en',
        cues: [],
        fullText: '',
        source: 'youtube-transcript' as const,
        status: 'done' as const,
        fetchedAt: '2026-03-26T10:00:00.000Z',
      },
    ])
    const results = await db.youtubeTranscripts.where('courseId').equals('c1').toArray()
    expect(results).toHaveLength(2)
  })

  it('should add and query youtubeChapters by courseId', async () => {
    const chapter = {
      id: crypto.randomUUID(),
      courseId: 'course-1',
      videoId: 'vid-abc',
      title: 'Introduction',
      startTime: 0,
      endTime: 60,
      order: 1,
    }
    await db.youtubeChapters.add(chapter)
    const results = await db.youtubeChapters.where('courseId').equals('course-1').toArray()
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Introduction')
  })

  it('should query importedCourses by source index', async () => {
    await db.importedCourses.bulkAdd([
      makeCourse({ source: 'local' }),
      makeCourse({ source: 'youtube' }),
      makeCourse({ source: 'youtube' }),
    ])
    const ytCourses = await db.importedCourses.where('source').equals('youtube').toArray()
    expect(ytCourses).toHaveLength(2)
  })

  it('should query importedVideos by youtubeVideoId index', async () => {
    await db.importedVideos.bulkAdd([
      makeVideo({ youtubeVideoId: 'yt-123' }),
      makeVideo({ youtubeVideoId: 'yt-456' }),
      makeVideo({}),
    ])
    const results = await db.importedVideos.where('youtubeVideoId').equals('yt-123').toArray()
    expect(results).toHaveLength(1)
  })
})

describe('v26 migration — source backfill', () => {
  it('should backfill existing courses with source: local', async () => {
    await Dexie.delete('ElearningDB')

    // Create a v25 database with courses that have no source field
    const v25Db = new Dexie('ElearningDB')
    v25Db.version(25).stores({
      importedCourses: 'id, name, importedAt, status, *tags',
      importedVideos: 'id, courseId, filename',
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
      reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
      courseReminders: 'id, courseId',
      courses: 'id, category, difficulty, authorId',
      quizzes: 'id, lessonId, createdAt',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
      videoCaptions: '[courseId+videoId], courseId, videoId',
      authors: 'id, name, createdAt',
      careerPaths: 'id',
      pathEnrollments: 'id, pathId, status',
      flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
      entitlements: 'userId',
      learningPaths: 'id, createdAt',
      learningPathEntries: 'id, [pathId+courseId], pathId',
    })
    await v25Db.open()

    // Seed courses without source field
    await v25Db.table('importedCourses').bulkAdd([
      {
        id: 'course-a',
        name: 'Course A',
        importedAt: '2026-01-01T00:00:00.000Z',
        category: '',
        tags: [],
        status: 'active',
        videoCount: 5,
        pdfCount: 0,
        directoryHandle: {},
      },
      {
        id: 'course-b',
        name: 'Course B',
        importedAt: '2026-02-01T00:00:00.000Z',
        category: '',
        tags: [],
        status: 'active',
        videoCount: 3,
        pdfCount: 1,
        directoryHandle: {},
      },
    ])
    v25Db.close()

    // Re-import schema to trigger v26 upgrade
    vi.resetModules()
    const module = await import('@/db/schema')
    db = module.db

    const courses = await db.importedCourses.toArray()
    expect(courses).toHaveLength(2)
    expect(courses.every(c => c.source === 'local')).toBe(true)

    // Verify no data loss — original fields preserved
    const courseA = courses.find(c => c.id === 'course-a')
    expect(courseA!.name).toBe('Course A')
    expect(courseA!.videoCount).toBe(5)
  })
})
