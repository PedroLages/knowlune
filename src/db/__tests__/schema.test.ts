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
    expect(db.tables.map(t => t.name).sort()).toEqual([
      'aiUsageEvents',
      'bookmarks',
      'challenges',
      'contentProgress',
      'courseReminders',
      'courseThumbnails',
      'courses',
      'embeddings',
      'importedCourses',
      'importedPdfs',
      'importedVideos',
      'learningPath',
      'notes',
      'progress',
      'quizAttempts',
      'quizzes',
      'reviewRecords',
      'screenshots',
      'studySessions',
    ])
  })

  it('should be at version 17', () => {
    expect(db.verno).toBe(17)
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
