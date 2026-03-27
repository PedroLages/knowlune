/**
 * Cross-Store Integration Test: Session Workflow
 *
 * Verifies that starting/ending a study session correctly updates:
 * - useSessionStore (session created, duration calculated, persisted)
 * - useContentProgressStore (progress reflects study activity)
 *
 * Uses real Dexie with fake-indexeddb (no mocks on persistence layer).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { Course, Module } from '@/data/types'

// Mock persistWithRetry to pass-through (retry logic tested elsewhere)
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

// Mock sonner to prevent DOM errors
vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
    warning: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  toastFn.warning = vi.fn()
  return { toast: toastFn }
})

// Mock toastHelpers
vi.mock('@/lib/toastHelpers', () => ({
  toastWithUndo: vi.fn(),
  toastError: {
    deleteFailed: vi.fn(),
    saveFailed: vi.fn(),
    storageFull: vi.fn(),
  },
}))

// Mock progress bridge (uses localStorage directly)
vi.mock('@/lib/progress', () => ({
  markLessonComplete: vi.fn(),
  markLessonIncomplete: vi.fn(),
}))

// Mock qualityScore (pure function, but depends on complex scoring logic)
vi.mock('@/lib/qualityScore', () => ({
  calculateQualityScore: vi.fn().mockReturnValue({
    score: 75,
    factors: {
      activeTimeScore: 80,
      interactionDensityScore: 70,
      sessionLengthScore: 75,
      breaksScore: 75,
    },
    tier: 'good',
  }),
}))

let useSessionStore: (typeof import('@/stores/useSessionStore'))['useSessionStore']
let useContentProgressStore: (typeof import('@/stores/useContentProgressStore'))['useContentProgressStore']
let db: (typeof import('@/db'))['db']

const COURSE_ID = 'course-session-1'
const LESSON_ID = 'lesson-session-1'
const MODULE_ID = 'mod-session-1'

const testModules: Module[] = [
  {
    id: MODULE_ID,
    title: 'Module 1',
    description: 'Test module',
    order: 0,
    lessons: [
      {
        id: LESSON_ID,
        title: 'Lesson 1',
        description: 'Test lesson',
        order: 0,
        resources: [],
        keyTopics: [],
        duration: '20:00',
      },
    ],
  },
]

const testCourse: Course = {
  id: COURSE_ID,
  title: 'Session Test Course',
  shortTitle: 'STC',
  description: 'A course for session integration testing',
  category: 'research-library',
  difficulty: 'beginner',
  totalLessons: 1,
  totalVideos: 1,
  totalPDFs: 0,
  estimatedHours: 1,
  tags: [],
  modules: testModules,
  isSequential: false,
  basePath: '/courses/session-test',
  authorId: 'author-1',
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()

  const dbMod = await import('@/db')
  db = dbMod.db

  const sessionStoreMod = await import('@/stores/useSessionStore')
  useSessionStore = sessionStoreMod.useSessionStore

  const progressStoreMod = await import('@/stores/useContentProgressStore')
  useContentProgressStore = progressStoreMod.useContentProgressStore

  vi.clearAllMocks()
})

describe('Session Workflow: Cross-Store Integration', () => {
  it('starting a session creates an active session in the store and DB', async () => {
    await db.courses.put(testCourse)

    await act(async () => {
      await useSessionStore.getState().startSession(COURSE_ID, LESSON_ID, 'video')
    })

    const state = useSessionStore.getState()
    expect(state.activeSession).not.toBeNull()
    expect(state.activeSession!.courseId).toBe(COURSE_ID)
    expect(state.activeSession!.contentItemId).toBe(LESSON_ID)
    expect(state.activeSession!.sessionType).toBe('video')
    expect(state.activeSession!.duration).toBe(0)
    expect(state.activeSession!.endTime).toBeUndefined()

    // Verify persisted to DB
    const dbSessions = await db.studySessions.toArray()
    expect(dbSessions).toHaveLength(1)
    expect(dbSessions[0].courseId).toBe(COURSE_ID)
  })

  it('ending a session calculates duration and persists', async () => {
    await db.courses.put(testCourse)

    // Start session
    await act(async () => {
      await useSessionStore.getState().startSession(COURSE_ID, LESSON_ID, 'video')
    })

    const sessionId = useSessionStore.getState().activeSession!.id

    // Simulate user activity by updating lastActivity with a timestamp 5 minutes later
    const startTime = useSessionStore.getState().activeSession!.startTime
    const fiveMinutesLater = new Date(new Date(startTime).getTime() + 5 * 60 * 1000).toISOString()

    await act(async () => {
      useSessionStore.getState().updateLastActivity(fiveMinutesLater)
    })

    // End session
    await act(async () => {
      useSessionStore.getState().endSession()
    })

    // Active session should be cleared
    expect(useSessionStore.getState().activeSession).toBeNull()

    // Wait for fire-and-forget persistence to complete
    // endSession uses fire-and-forget persistence, so we need a small delay
    await new Promise(resolve => setTimeout(resolve, 50))

    // Verify DB has the closed session with duration
    const dbSession = await db.studySessions.get(sessionId)
    expect(dbSession).toBeDefined()
    expect(dbSession!.endTime).toBeDefined()
    expect(dbSession!.duration).toBeGreaterThan(0)
    // Duration should be approximately 300 seconds (5 minutes)
    expect(dbSession!.duration).toBe(300)
  })

  it('session stats reflect completed sessions after load', async () => {
    await db.courses.put(testCourse)

    // Seed a completed session directly in DB
    const completedSession = {
      id: 'session-completed-1',
      courseId: COURSE_ID,
      contentItemId: LESSON_ID,
      startTime: '2026-03-27T10:00:00.000Z',
      endTime: '2026-03-27T10:30:00.000Z',
      duration: 1800, // 30 minutes
      idleTime: 0,
      videosWatched: [],
      lastActivity: '2026-03-27T10:30:00.000Z',
      sessionType: 'video' as const,
      interactionCount: 10,
      breakCount: 0,
    }
    await db.studySessions.add(completedSession)

    // Load session stats
    await act(async () => {
      await useSessionStore.getState().loadSessionStats(COURSE_ID)
    })

    const totalTime = useSessionStore.getState().getTotalStudyTime(COURSE_ID)
    expect(totalTime).toBe(1800) // 30 minutes in seconds
  })

  it('starting a new session ends the previous active session', async () => {
    await db.courses.put(testCourse)

    // Start first session
    await act(async () => {
      await useSessionStore.getState().startSession(COURSE_ID, LESSON_ID, 'video')
    })

    const firstSessionId = useSessionStore.getState().activeSession!.id

    // Update activity to give the first session some duration
    const startTime = useSessionStore.getState().activeSession!.startTime
    const twoMinutesLater = new Date(new Date(startTime).getTime() + 2 * 60 * 1000).toISOString()
    await act(async () => {
      useSessionStore.getState().updateLastActivity(twoMinutesLater)
    })

    // Start second session (should end first)
    await act(async () => {
      await useSessionStore.getState().startSession(COURSE_ID, 'lesson-2', 'pdf')
    })

    // Wait for fire-and-forget persistence
    await new Promise(resolve => setTimeout(resolve, 50))

    const state = useSessionStore.getState()
    expect(state.activeSession).not.toBeNull()
    expect(state.activeSession!.contentItemId).toBe('lesson-2')
    expect(state.activeSession!.id).not.toBe(firstSessionId)

    // First session should be closed in DB
    const firstSession = await db.studySessions.get(firstSessionId)
    expect(firstSession?.endTime).toBeDefined()
  })

  it('session and content progress work together across stores', async () => {
    await db.courses.put(testCourse)

    // Start and end a session
    await act(async () => {
      await useSessionStore.getState().startSession(COURSE_ID, LESSON_ID, 'video')
    })

    const startTime = useSessionStore.getState().activeSession!.startTime
    const tenMinutesLater = new Date(new Date(startTime).getTime() + 10 * 60 * 1000).toISOString()
    await act(async () => {
      useSessionStore.getState().updateLastActivity(tenMinutesLater)
    })

    await act(async () => {
      useSessionStore.getState().endSession()
    })

    // Wait for fire-and-forget persistence
    await new Promise(resolve => setTimeout(resolve, 50))

    // Separately, mark the lesson as completed via contentProgress store
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus(COURSE_ID, LESSON_ID, 'completed', testModules)
    })

    // Verify both stores reflect the work done
    const progressStatus = useContentProgressStore
      .getState()
      .getItemStatus(COURSE_ID, LESSON_ID)
    expect(progressStatus).toBe('completed')

    // Verify session exists in DB with duration
    const sessions = await db.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].duration).toBe(600) // 10 minutes

    // Verify content progress exists in DB
    const progressRecords = await db.contentProgress.where({ courseId: COURSE_ID }).toArray()
    expect(progressRecords.length).toBeGreaterThanOrEqual(1)
    const lessonRecord = progressRecords.find(r => r.itemId === LESSON_ID)
    expect(lessonRecord?.status).toBe('completed')
  })

  it('orphaned sessions are recovered on next load', async () => {
    await db.courses.put(testCourse)

    // Seed an orphaned session (no endTime) directly in DB
    const orphanedSession = {
      id: 'orphaned-session-1',
      courseId: COURSE_ID,
      contentItemId: LESSON_ID,
      startTime: '2026-03-27T09:00:00.000Z',
      endTime: undefined,
      duration: 0,
      idleTime: 0,
      videosWatched: [],
      lastActivity: '2026-03-27T09:15:00.000Z',
      sessionType: 'video' as const,
      interactionCount: 5,
      breakCount: 0,
    }
    await db.studySessions.add(orphanedSession)

    // Run orphan recovery
    await act(async () => {
      await useSessionStore.getState().recoverOrphanedSessions()
    })

    // Verify session was closed with lastActivity as endTime
    const recovered = await db.studySessions.get('orphaned-session-1')
    expect(recovered?.endTime).toBe('2026-03-27T09:15:00.000Z')
    expect(recovered?.duration).toBeGreaterThan(0)
  })

  it('recordInteraction increments interaction count on active session', async () => {
    await db.courses.put(testCourse)

    await act(async () => {
      await useSessionStore.getState().startSession(COURSE_ID, LESSON_ID, 'video')
    })

    expect(useSessionStore.getState().activeSession!.interactionCount).toBe(0)

    // Record several interactions
    await act(async () => {
      useSessionStore.getState().recordInteraction()
      useSessionStore.getState().recordInteraction()
      useSessionStore.getState().recordInteraction()
    })

    expect(useSessionStore.getState().activeSession!.interactionCount).toBe(3)
  })
})
