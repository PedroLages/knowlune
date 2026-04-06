/**
 * Unit tests for useStudyScheduleStore — study schedule CRUD with Dexie persistence.
 *
 * Tests loadSchedules, addSchedule, updateSchedule, deleteSchedule,
 * getSchedulesForDay, and getSchedulesForCourse.
 * Feed token actions are not tested here (require Supabase).
 *
 * @since E106-S01
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { StudySchedule, DayOfWeek } from '@/data/types'

const FIXED_DATE = new Date('2026-03-23T10:00:00.000Z')

// Mock supabase — StudyScheduleStore imports it at module level
vi.mock('@/lib/auth/supabase', () => ({
  supabase: null,
}))

// Mock persistWithRetry to just execute the operation directly
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: vi.fn(async (op: () => Promise<void>) => op()),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

let useStudyScheduleStore: (typeof import('@/stores/useStudyScheduleStore'))['useStudyScheduleStore']
let db: (typeof import('@/db/schema'))['db']

function makeSchedule(overrides: Partial<StudySchedule> = {}): StudySchedule {
  return {
    id: crypto.randomUUID(),
    title: 'Morning Study',
    days: ['monday', 'wednesday', 'friday'] as DayOfWeek[],
    startTime: '09:00',
    durationMinutes: 60,
    recurrence: 'weekly',
    reminderMinutes: 15,
    enabled: true,
    timezone: 'America/New_York',
    createdAt: FIXED_DATE.toISOString(),
    updatedAt: FIXED_DATE.toISOString(),
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  // Re-apply mocks after module reset
  vi.doMock('@/lib/auth/supabase', () => ({
    supabase: null,
  }))
  vi.doMock('@/lib/persistWithRetry', () => ({
    persistWithRetry: vi.fn(async (op: () => Promise<void>) => op()),
  }))
  vi.doMock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }))
  const storeModule = await import('@/stores/useStudyScheduleStore')
  useStudyScheduleStore = storeModule.useStudyScheduleStore
  const dbModule = await import('@/db/schema')
  db = dbModule.db
})

describe('initial state', () => {
  it('starts with empty schedules and isLoaded false', () => {
    const state = useStudyScheduleStore.getState()
    expect(state.schedules).toEqual([])
    expect(state.isLoaded).toBe(false)
  })
})

describe('loadSchedules', () => {
  it('loads schedules from IndexedDB', async () => {
    const schedule = makeSchedule({ title: 'Test Schedule' })
    await db.studySchedules.add(schedule)

    await useStudyScheduleStore.getState().loadSchedules()

    const state = useStudyScheduleStore.getState()
    expect(state.schedules).toHaveLength(1)
    expect(state.schedules[0].title).toBe('Test Schedule')
    expect(state.isLoaded).toBe(true)
  })

  it('sets error state on load failure', async () => {
    vi.spyOn(db.studySchedules, 'toArray').mockRejectedValueOnce(new Error('DB error'))
    const { toast } = await import('sonner')

    await useStudyScheduleStore.getState().loadSchedules()

    expect(toast.error).toHaveBeenCalledWith('Failed to load study schedules')
  })
})

describe('addSchedule', () => {
  it('creates a schedule with auto-generated id and timestamps', async () => {
    const result = await useStudyScheduleStore.getState().addSchedule({
      title: 'New Schedule',
      days: ['monday'] as DayOfWeek[],
      startTime: '10:00',
      durationMinutes: 45,
      recurrence: 'weekly',
      reminderMinutes: 10,
      enabled: true,
      timezone: 'UTC',
    })

    expect(result).toBeDefined()
    expect(result!.id).toBeTruthy()
    expect(result!.title).toBe('New Schedule')
    expect(result!.createdAt).toBeTruthy()

    const state = useStudyScheduleStore.getState()
    expect(state.schedules).toHaveLength(1)

    // Verify Dexie persistence
    const all = await db.studySchedules.toArray()
    expect(all).toHaveLength(1)
  })

  it('returns undefined on DB failure', async () => {
    vi.spyOn(db.studySchedules, 'add').mockRejectedValueOnce(new Error('Write fail'))

    const result = await useStudyScheduleStore.getState().addSchedule({
      title: 'Fail Schedule',
      days: ['tuesday'] as DayOfWeek[],
      startTime: '08:00',
      durationMinutes: 30,
      recurrence: 'daily',
      reminderMinutes: 5,
      enabled: true,
      timezone: 'UTC',
    })

    expect(result).toBeUndefined()
    expect(useStudyScheduleStore.getState().schedules).toHaveLength(0)
  })

  it('uses default timezone when not provided', async () => {
    const result = await useStudyScheduleStore.getState().addSchedule({
      title: 'No TZ',
      days: ['monday'] as DayOfWeek[],
      startTime: '09:00',
      durationMinutes: 60,
      recurrence: 'weekly',
      reminderMinutes: 15,
      enabled: true,
    } as Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>)

    expect(result).toBeDefined()
    expect(result!.timezone).toBeTruthy() // Intl.DateTimeFormat default
  })
})

describe('updateSchedule', () => {
  it('updates schedule fields and persists', async () => {
    const schedule = makeSchedule({ id: 'upd-1', title: 'Original' })
    await db.studySchedules.add(schedule)
    useStudyScheduleStore.setState({ schedules: [schedule] })

    await useStudyScheduleStore.getState().updateSchedule('upd-1', { title: 'Updated' })

    const updated = useStudyScheduleStore.getState().schedules[0]
    expect(updated.title).toBe('Updated')
    expect(updated.updatedAt).toBeTruthy()

    // Verify Dexie
    const record = await db.studySchedules.get('upd-1')
    expect(record?.title).toBe('Updated')
  })

  it('is a no-op for non-existent schedule', async () => {
    useStudyScheduleStore.setState({ schedules: [] })

    await useStudyScheduleStore.getState().updateSchedule('nonexistent', { title: 'X' })

    expect(useStudyScheduleStore.getState().schedules).toHaveLength(0)
  })

  it('prevents id override in updates', async () => {
    const schedule = makeSchedule({ id: 'keep-id' })
    await db.studySchedules.add(schedule)
    useStudyScheduleStore.setState({ schedules: [schedule] })

    await useStudyScheduleStore.getState().updateSchedule('keep-id', {
      id: 'new-id',
      title: 'Changed',
    } as Partial<StudySchedule>)

    expect(useStudyScheduleStore.getState().schedules[0].id).toBe('keep-id')
  })

  it('shows toast on DB failure', async () => {
    const schedule = makeSchedule({ id: 'fail-upd' })
    useStudyScheduleStore.setState({ schedules: [schedule] })
    vi.spyOn(db.studySchedules, 'put').mockRejectedValueOnce(new Error('Write fail'))
    const { toast } = await import('sonner')

    await useStudyScheduleStore.getState().updateSchedule('fail-upd', { title: 'X' })

    expect(toast.error).toHaveBeenCalledWith('Failed to update study schedule')
  })
})

describe('deleteSchedule', () => {
  it('removes schedule from state and Dexie', async () => {
    const schedule = makeSchedule({ id: 'del-1' })
    await db.studySchedules.add(schedule)
    useStudyScheduleStore.setState({ schedules: [schedule] })

    await useStudyScheduleStore.getState().deleteSchedule('del-1')

    expect(useStudyScheduleStore.getState().schedules).toHaveLength(0)
    const record = await db.studySchedules.get('del-1')
    expect(record).toBeUndefined()
  })

  it('is a no-op for non-existent schedule', async () => {
    useStudyScheduleStore.setState({ schedules: [] })

    await useStudyScheduleStore.getState().deleteSchedule('nonexistent')

    expect(useStudyScheduleStore.getState().schedules).toHaveLength(0)
  })

  it('shows toast on DB failure', async () => {
    const schedule = makeSchedule({ id: 'fail-del' })
    useStudyScheduleStore.setState({ schedules: [schedule] })
    vi.spyOn(db.studySchedules, 'delete').mockRejectedValueOnce(new Error('Delete fail'))
    const { toast } = await import('sonner')

    await useStudyScheduleStore.getState().deleteSchedule('fail-del')

    expect(toast.error).toHaveBeenCalledWith('Failed to delete study schedule')
  })
})

describe('getSchedulesForDay', () => {
  it('returns schedules that include the given day', () => {
    const s1 = makeSchedule({
      id: 's1',
      days: ['monday', 'wednesday'] as DayOfWeek[],
      enabled: true,
    })
    const s2 = makeSchedule({
      id: 's2',
      days: ['tuesday', 'thursday'] as DayOfWeek[],
      enabled: true,
    })
    const s3 = makeSchedule({ id: 's3', days: ['monday'] as DayOfWeek[], enabled: true })
    useStudyScheduleStore.setState({ schedules: [s1, s2, s3] })

    const result = useStudyScheduleStore.getState().getSchedulesForDay('monday')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.id)).toContain('s1')
    expect(result.map(s => s.id)).toContain('s3')
  })

  it('filters out disabled schedules by default', () => {
    const s1 = makeSchedule({ id: 's1', days: ['monday'] as DayOfWeek[], enabled: true })
    const s2 = makeSchedule({ id: 's2', days: ['monday'] as DayOfWeek[], enabled: false })
    useStudyScheduleStore.setState({ schedules: [s1, s2] })

    const result = useStudyScheduleStore.getState().getSchedulesForDay('monday')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1')
  })

  it('includes disabled schedules when enabledOnly is false', () => {
    const s1 = makeSchedule({ id: 's1', days: ['monday'] as DayOfWeek[], enabled: false })
    useStudyScheduleStore.setState({ schedules: [s1] })

    const result = useStudyScheduleStore.getState().getSchedulesForDay('monday', false)
    expect(result).toHaveLength(1)
  })
})

describe('getSchedulesForCourse', () => {
  it('returns schedules for the given courseId', () => {
    const s1 = makeSchedule({ id: 's1', courseId: 'course-1', enabled: true })
    const s2 = makeSchedule({ id: 's2', courseId: 'course-2', enabled: true })
    useStudyScheduleStore.setState({ schedules: [s1, s2] })

    const result = useStudyScheduleStore.getState().getSchedulesForCourse('course-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s1')
  })

  it('filters out disabled schedules by default', () => {
    const s1 = makeSchedule({ id: 's1', courseId: 'course-1', enabled: false })
    useStudyScheduleStore.setState({ schedules: [s1] })

    const result = useStudyScheduleStore.getState().getSchedulesForCourse('course-1')
    expect(result).toHaveLength(0)
  })

  it('includes disabled schedules when enabledOnly is false', () => {
    const s1 = makeSchedule({ id: 's1', courseId: 'course-1', enabled: false })
    useStudyScheduleStore.setState({ schedules: [s1] })

    const result = useStudyScheduleStore.getState().getSchedulesForCourse('course-1', false)
    expect(result).toHaveLength(1)
  })
})

describe('feed token (no supabase)', () => {
  it('getFeedUrl returns null when no token', () => {
    const result = useStudyScheduleStore.getState().getFeedUrl()
    expect(result).toBeNull()
  })

  it('getFeedUrl returns URL when token is set', () => {
    useStudyScheduleStore.setState({ feedToken: 'abc123' })
    const result = useStudyScheduleStore.getState().getFeedUrl()
    expect(result).toContain('/api/calendar/abc123.ics')
  })

  it('loadFeedToken is a no-op when supabase is null', async () => {
    await useStudyScheduleStore.getState().loadFeedToken()
    expect(useStudyScheduleStore.getState().feedToken).toBeNull()
  })

  it('generateFeedToken returns null when supabase is null', async () => {
    const result = await useStudyScheduleStore.getState().generateFeedToken()
    expect(result).toBeNull()
  })

  it('regenerateFeedToken returns null when supabase is null', async () => {
    const result = await useStudyScheduleStore.getState().regenerateFeedToken()
    expect(result).toBeNull()
  })

  it('disableFeed is a no-op when supabase is null', async () => {
    useStudyScheduleStore.setState({ feedToken: 'old-token', feedEnabled: true })
    await useStudyScheduleStore.getState().disableFeed()
    // State not changed because supabase is null — toast.error shown instead
    expect(useStudyScheduleStore.getState().feedToken).toBe('old-token')
  })
})

describe('feed token (with mocked supabase)', () => {
  // These tests re-import the store with a non-null supabase mock
  let feedStore: typeof useStudyScheduleStore
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/supabase', () => ({
      supabase: mockSupabase,
    }))
    vi.doMock('@/lib/persistWithRetry', () => ({
      persistWithRetry: vi.fn(async (op: () => Promise<void>) => op()),
    }))
    vi.doMock('sonner', () => ({
      toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
    }))
    const mod = await import('@/stores/useStudyScheduleStore')
    feedStore = mod.useStudyScheduleStore
    vi.clearAllMocks()
  })

  it('loadFeedToken loads token from supabase', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { token: 'existing-token' }, error: null }),
    }
    mockSupabase.from.mockReturnValue(selectChain)

    await feedStore.getState().loadFeedToken()

    expect(feedStore.getState().feedToken).toBe('existing-token')
    expect(feedStore.getState().feedEnabled).toBe(true)
  })

  it('loadFeedToken handles no user gracefully', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    await feedStore.getState().loadFeedToken()

    expect(feedStore.getState().feedToken).toBeNull()
  })

  it('loadFeedToken handles error by resetting state', async () => {
    feedStore.setState({ feedToken: 'stale', feedEnabled: true })
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    })

    await feedStore.getState().loadFeedToken()

    expect(feedStore.getState().feedToken).toBeNull()
    expect(feedStore.getState().feedEnabled).toBe(false)
  })

  it('generateFeedToken creates token via supabase', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })

    const token = await feedStore.getState().generateFeedToken()

    expect(token).toBeTruthy()
    expect(token!.length).toBe(40) // 20 bytes = 40 hex chars
    expect(feedStore.getState().feedEnabled).toBe(true)
  })

  it('generateFeedToken returns null when no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const token = await feedStore.getState().generateFeedToken()

    expect(token).toBeNull()
    expect(feedStore.getState().feedLoading).toBe(false)
  })

  it('generateFeedToken prevents concurrent calls', async () => {
    feedStore.setState({ feedLoading: true })

    const result = await feedStore.getState().generateFeedToken()

    expect(result).toBeNull()
  })

  it('generateFeedToken handles upsert error', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error('upsert fail') }),
    })

    const token = await feedStore.getState().generateFeedToken()

    expect(token).toBeNull()
    expect(feedStore.getState().feedLoading).toBe(false)
  })

  it('regenerateFeedToken deletes old and creates new', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })

    const token = await feedStore.getState().regenerateFeedToken()

    expect(token).toBeTruthy()
    expect(token!.length).toBe(40)
    expect(feedStore.getState().feedEnabled).toBe(true)
  })

  it('regenerateFeedToken handles delete error', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('delete fail') }),
      }),
    })

    const token = await feedStore.getState().regenerateFeedToken()

    expect(token).toBeNull()
    expect(feedStore.getState().feedLoading).toBe(false)
  })

  it('regenerateFeedToken handles insert error after delete', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ error: new Error('insert fail') }),
    })

    const token = await feedStore.getState().regenerateFeedToken()

    expect(token).toBeNull()
    // State should be cleared since insert failed after delete
    expect(feedStore.getState().feedToken).toBeNull()
    expect(feedStore.getState().feedEnabled).toBe(false)
  })

  it('regenerateFeedToken returns null when no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const token = await feedStore.getState().regenerateFeedToken()

    expect(token).toBeNull()
  })

  it('regenerateFeedToken prevents concurrent calls', async () => {
    feedStore.setState({ feedLoading: true })

    const result = await feedStore.getState().regenerateFeedToken()

    expect(result).toBeNull()
  })

  it('disableFeed removes token from supabase', async () => {
    feedStore.setState({ feedToken: 'old-token', feedEnabled: true })
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    await feedStore.getState().disableFeed()

    expect(feedStore.getState().feedToken).toBeNull()
    expect(feedStore.getState().feedEnabled).toBe(false)
  })

  it('disableFeed handles no user gracefully', async () => {
    feedStore.setState({ feedToken: 'token', feedEnabled: true })
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    await feedStore.getState().disableFeed()

    // Token not changed since no user to delete for
    expect(feedStore.getState().feedToken).toBe('token')
  })

  it('disableFeed handles error gracefully', async () => {
    feedStore.setState({ feedToken: 'token', feedEnabled: true })
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('delete fail') }),
      }),
    })

    await feedStore.getState().disableFeed()

    // Token preserved on error
    expect(feedStore.getState().feedToken).toBe('token')
    expect(feedStore.getState().feedLoading).toBe(false)
  })

  it('disableFeed prevents concurrent calls', async () => {
    feedStore.setState({ feedLoading: true, feedToken: 'token' })

    await feedStore.getState().disableFeed()

    // No change since already loading
    expect(feedStore.getState().feedToken).toBe('token')
  })
})
