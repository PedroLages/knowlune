/**
 * hydrateP3P4.test.ts — E96-S02 unit test for the fan-out hydrator.
 *
 * Covers:
 *   - Happy path — dispatches rows to each of the 6 hydrate targets
 *     (learningPaths+learningPathEntries combined, studySchedules, challenges,
 *     courseReminders, notifications).
 *   - Does NOT dispatch to insert-only tables (`quizAttempts`, `aiUsageEvents`).
 *   - Promise.allSettled branch — one Supabase query rejecting does not
 *     cancel the remaining hydrates.
 *   - Critical echo-loop assertion — zero syncableWrite calls during the
 *     full hydration pass (system-wide invariant).
 *   - No-op when userId is null/empty.
 *
 * @module hydrateP3P4
 * @since E96-S02
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

// ---- Hoisted Supabase mock --------------------------------------------------
// The module-level `supabase` client is replaced with a per-test spy so we can
// steer responses for each table query.
const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    from: (table: string) => mockSupabaseFrom(table),
  },
}))

function makeQueryResult(data: unknown[]) {
  return {
    select: () => ({
      eq: () => Promise.resolve({ data, error: null }),
    }),
  }
}

function makeQueryError() {
  return {
    select: () => ({
      eq: () => Promise.resolve({ data: null, error: new Error('supabase boom') }),
    }),
  }
}

let hydrateP3P4FromSupabase: (typeof import('@/lib/sync/hydrateP3P4'))['hydrateP3P4FromSupabase']
// useLearningPathStore rows are asserted via the Dexie snapshot, not the store.
let useStudyScheduleStore: (typeof import('@/stores/useStudyScheduleStore'))['useStudyScheduleStore']
let useChallengeStore: (typeof import('@/stores/useChallengeStore'))['useChallengeStore']
let useNotificationStore: (typeof import('@/stores/useNotificationStore'))['useNotificationStore']
let syncableWriteModule: typeof import('@/lib/sync/syncableWrite')
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-fanout'

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  vi.clearAllMocks()

  vi.doMock('@/lib/auth/supabase', () => ({
    supabase: {
      from: (table: string) => mockSupabaseFrom(table),
    },
  }))

  const mod = await import('@/lib/sync/hydrateP3P4')
  hydrateP3P4FromSupabase = mod.hydrateP3P4FromSupabase

  // useLearningPathStore is imported for its module side-effects (so
  // hydrateP3P4FromSupabase can resolve its state selector); the tests below
  // assert the Dexie snapshot directly.
  await import('@/stores/useLearningPathStore')
  useStudyScheduleStore = (await import('@/stores/useStudyScheduleStore')).useStudyScheduleStore
  useChallengeStore = (await import('@/stores/useChallengeStore')).useChallengeStore
  useNotificationStore = (await import('@/stores/useNotificationStore')).useNotificationStore

  syncableWriteModule = await import('@/lib/sync/syncableWrite')

  const dbMod = await import('@/db')
  db = dbMod.db
})

describe('hydrateP3P4FromSupabase', () => {
  it('is a no-op when userId is null/empty', async () => {
    await hydrateP3P4FromSupabase(null)
    await hydrateP3P4FromSupabase('')

    expect(mockSupabaseFrom).not.toHaveBeenCalled()
  })

  it('dispatches rows to each of the 6 hydrate targets on happy path', async () => {
    const now = new Date().toISOString()
    mockSupabaseFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'learning_paths':
          return makeQueryResult([
            { id: 'p1', name: 'P1', created_at: now, updated_at: now, is_ai_generated: false },
          ])
        case 'learning_path_entries':
          return makeQueryResult([
            {
              id: 'e1',
              path_id: 'p1',
              course_id: 'c1',
              course_type: 'imported',
              position: 1,
              is_manually_ordered: false,
            },
          ])
        case 'study_schedules':
          return makeQueryResult([
            {
              id: 's1',
              title: 'S1',
              days: ['monday'],
              start_time: '09:00',
              duration_minutes: 60,
              recurrence: 'weekly',
              reminder_minutes: 15,
              enabled: true,
              timezone: 'UTC',
              created_at: now,
              updated_at: now,
            },
          ])
        case 'challenges':
          return makeQueryResult([
            {
              id: 'ch1',
              name: 'C',
              type: 'study_streak',
              target_value: 5,
              deadline: '2026-12-31',
              created_at: now,
              current_progress: 1,
              celebrated_milestones: [],
            },
          ])
        case 'course_reminders':
          return makeQueryResult([
            {
              id: 'r1',
              course_id: 'c1',
              course_name: 'Course',
              enabled: true,
              days: ['monday'],
              time: '09:00',
              updated_at: now,
            },
          ])
        case 'notifications':
          return makeQueryResult([
            {
              id: 'n1',
              type: 'course-complete',
              title: 'T',
              message: 'M',
              created_at: now,
              read_at: null,
              dismissed_at: null,
            },
          ])
        default:
          return makeQueryResult([])
      }
    })

    await hydrateP3P4FromSupabase(TEST_USER_ID)

    // learningPaths + entries landed.
    const storedPath = await db.learningPaths.get('p1')
    expect(storedPath).toBeDefined()
    const storedEntry = await db.learningPathEntries.get('e1')
    expect(storedEntry).toBeDefined()

    // studySchedules landed.
    expect(useStudyScheduleStore.getState().schedules.find(s => s.id === 's1')).toBeDefined()

    // challenges landed.
    expect(useChallengeStore.getState().challenges.find(c => c.id === 'ch1')).toBeDefined()

    // courseReminders landed.
    const reminder = await db.courseReminders.get('r1')
    expect(reminder).toBeDefined()

    // notifications landed.
    expect(useNotificationStore.getState().notifications.find(n => n.id === 'n1')).toBeDefined()
  })

  it('does NOT query insert-only tables (quizAttempts, aiUsageEvents)', async () => {
    mockSupabaseFrom.mockImplementation(() => makeQueryResult([]))
    await hydrateP3P4FromSupabase(TEST_USER_ID)

    const queriedTables = mockSupabaseFrom.mock.calls.map(c => c[0])
    expect(queriedTables).not.toContain('quiz_attempts')
    expect(queriedTables).not.toContain('ai_usage_events')
  })

  it('survives a per-table Supabase query rejection (Promise.allSettled branch)', async () => {
    const now = new Date().toISOString()
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'challenges') return makeQueryError()
      if (table === 'notifications') {
        return makeQueryResult([
          {
            id: 'n1',
            type: 'course-complete',
            title: 'T',
            message: 'M',
            created_at: now,
            read_at: null,
            dismissed_at: null,
          },
        ])
      }
      return makeQueryResult([])
    })

    await hydrateP3P4FromSupabase(TEST_USER_ID)

    // Challenge fetch rejected, but notifications still landed.
    expect(useNotificationStore.getState().notifications.find(n => n.id === 'n1')).toBeDefined()
  })

  it('critical — zero syncableWrite calls during a full hydration pass (echo-loop guard)', async () => {
    const now = new Date().toISOString()
    mockSupabaseFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'learning_paths':
          return makeQueryResult([
            { id: 'p1', name: 'P1', created_at: now, updated_at: now, is_ai_generated: false },
          ])
        case 'notifications':
          return makeQueryResult([
            {
              id: 'n1',
              type: 'course-complete',
              title: 'T',
              message: 'M',
              created_at: now,
              read_at: null,
              dismissed_at: null,
            },
          ])
        default:
          return makeQueryResult([])
      }
    })

    const spy = vi.spyOn(syncableWriteModule, 'syncableWrite')

    await hydrateP3P4FromSupabase(TEST_USER_ID)

    expect(spy).not.toHaveBeenCalled()

    // syncQueue must also be empty.
    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(0)
  })
})
