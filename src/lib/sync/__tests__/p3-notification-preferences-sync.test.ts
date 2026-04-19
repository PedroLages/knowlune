/**
 * p3-notification-preferences-sync.test.ts — E95-S06 integration tests for
 * the `hydrateSettingsFromSupabase` extension that hydrates
 * `useNotificationPrefsStore` from the Supabase `notification_preferences`
 * table on sign-in.
 *
 * Covers the decision matrix spelled out in `src/lib/settings.ts`:
 *   | Condition                                        | Outcome               |
 *   |--------------------------------------------------|-----------------------|
 *   | No remote row (new user / PGRST116)              | Skip (R10)            |
 *   | Remote updated_at >= local updatedAt             | Apply remote (R8)     |
 *   | Local is all-defaults (user never toggled)       | Apply remote (P2)     |
 *   | Otherwise (local strictly newer)                 | Keep local            |
 *
 * Also asserts the load-bearing no-echo-loop invariant: `hydrateFromRemote`
 * must not enqueue a `syncQueue` entry when hydrating on login, otherwise
 * every device would re-upload the row it just downloaded on every sign-in.
 *
 * @since E95-S06
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

// Hoisted mock state — read/written by the `@/lib/auth/supabase` mock below.
const mockState: {
  userSettings: { data: unknown; error: unknown } | null
  notificationPreferences: { data: unknown; error: unknown } | null
} = {
  userSettings: null,
  notificationPreferences: null,
}

vi.mock('@/lib/auth/supabase', () => {
  const makeQuery = () => ({
    select: () => ({
      eq: () => ({
        // single() for user_settings
        single: async () =>
          mockState.userSettings ?? { data: null, error: { code: 'PGRST116' } },
        // maybeSingle() for notification_preferences
        maybeSingle: async () =>
          mockState.notificationPreferences ?? { data: null, error: null },
      }),
    }),
  })
  return {
    supabase: {
      from: () => makeQuery(),
      rpc: async () => ({ error: null }),
    },
  }
})

// Stub sync engine to no-op so the E95-S06 store's syncableWrite path stays
// local; prevents a stray upload cycle from muddying the test assertions.
vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: { nudge: vi.fn() },
}))

// Stub toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

let hydrateSettingsFromSupabase: (
  userMetadata: Record<string, unknown> | undefined,
  userId?: string,
) => Promise<void>
let useNotificationPrefsStore: (typeof import('@/stores/useNotificationPrefsStore'))['useNotificationPrefsStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db/schema'))['db']

const USER_ID = 'user-e95-s06'

/** Build a fully-populated remote row with the given overrides. */
function remoteRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user_id: USER_ID,
    course_complete: true,
    streak_milestone: true,
    import_finished: true,
    achievement_unlocked: true,
    review_due: true,
    srs_due: true,
    knowledge_decay: true,
    recommendation_match: true,
    milestone_approaching: true,
    book_imported: true,
    book_deleted: true,
    highlight_review: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    updated_at: '2026-04-19T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  mockState.userSettings = null
  mockState.notificationPreferences = null
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  vi.doMock('@/lib/sync/syncEngine', () => ({ syncEngine: { nudge: vi.fn() } }))
  vi.doMock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }))
  // Re-declare the supabase mock so resetModules picks it up.
  vi.doMock('@/lib/auth/supabase', () => {
    const makeQuery = () => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            mockState.userSettings ?? { data: null, error: { code: 'PGRST116' } },
          maybeSingle: async () =>
            mockState.notificationPreferences ?? { data: null, error: null },
        }),
      }),
    })
    return {
      supabase: {
        from: () => makeQuery(),
        rpc: async () => ({ error: null }),
      },
    }
  })

  const settingsMod = await import('@/lib/settings')
  hydrateSettingsFromSupabase = settingsMod.hydrateSettingsFromSupabase
  const storeMod = await import('@/stores/useNotificationPrefsStore')
  useNotificationPrefsStore = storeMod.useNotificationPrefsStore
  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  const dbMod = await import('@/db/schema')
  db = dbMod.db
  useAuthStore.setState({ user: { id: USER_ID, email: 't@x.y' } as unknown as import('@supabase/supabase-js').User })
})

describe('hydrateSettingsFromSupabase — notification_preferences', () => {
  it('R10: no remote row — store unchanged, no hydrateFromRemote call', async () => {
    mockState.notificationPreferences = { data: null, error: null }
    const before = useNotificationPrefsStore.getState().prefs

    await hydrateSettingsFromSupabase({}, USER_ID)

    const after = useNotificationPrefsStore.getState().prefs
    expect(after.courseComplete).toBe(before.courseComplete)
    expect(after.quietHoursEnabled).toBe(before.quietHoursEnabled)
  })

  it('R8 happy path: remote newer than local → applies remote values', async () => {
    // Seed local with an older timestamp + non-default values so the P2
    // "all defaults" guard does NOT fire.
    useNotificationPrefsStore.setState({
      prefs: {
        id: 'singleton',
        courseComplete: true,
        streakMilestone: true,
        importFinished: true,
        achievementUnlocked: true,
        reviewDue: true,
        srsDue: true,
        knowledgeDecay: true,
        recommendationMatch: true,
        milestoneApproaching: true,
        bookImported: true,
        bookDeleted: true,
        highlightReview: false, // non-default so isAllDefaults is false
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      isLoaded: true,
    })

    mockState.notificationPreferences = {
      data: remoteRow({
        course_complete: false,
        quiet_hours_enabled: true,
        quiet_hours_start: '23:00',
        quiet_hours_end: '06:00',
        updated_at: '2026-04-19T00:00:00.000Z',
      }),
      error: null,
    }

    await hydrateSettingsFromSupabase({}, USER_ID)

    const prefs = useNotificationPrefsStore.getState().prefs
    expect(prefs.courseComplete).toBe(false)
    expect(prefs.quietHoursEnabled).toBe(true)
    expect(prefs.quietHoursStart).toBe('23:00')
    expect(prefs.quietHoursEnd).toBe('06:00')
  })

  it('P2 guard: local is all-defaults → remote wins even with older timestamp', async () => {
    // Local is the fresh DEFAULTS with a NEW timestamp (e.g., just written
    // by init() at app-load), remote row has an OLDER timestamp from a
    // previous upload. Without the P2 guard the local defaults would block
    // the legitimate remote row.
    useNotificationPrefsStore.setState({
      prefs: {
        ...useNotificationPrefsStore.getState().prefs,
        updatedAt: '2026-12-31T00:00:00.000Z', // strictly newer than remote
      },
    })

    mockState.notificationPreferences = {
      data: remoteRow({
        course_complete: false,
        updated_at: '2026-01-01T00:00:00.000Z', // older
      }),
      error: null,
    }

    await hydrateSettingsFromSupabase({}, USER_ID)

    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(false)
  })

  it('local strictly newer → keeps local, remote discarded', async () => {
    useNotificationPrefsStore.setState({
      prefs: {
        ...useNotificationPrefsStore.getState().prefs,
        courseComplete: false, // user toggled off locally
        highlightReview: false, // force isAllDefaults=false
        updatedAt: '2026-12-31T00:00:00.000Z',
      },
    })

    mockState.notificationPreferences = {
      data: remoteRow({
        course_complete: true,
        updated_at: '2026-01-01T00:00:00.000Z',
      }),
      error: null,
    }

    await hydrateSettingsFromSupabase({}, USER_ID)

    // Local kept — user's local toggle wins.
    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(false)
  })

  it('inclusive timestamp: equal timestamps → remote wins', async () => {
    const ts = '2026-04-19T00:00:00.000Z'
    useNotificationPrefsStore.setState({
      prefs: {
        ...useNotificationPrefsStore.getState().prefs,
        courseComplete: true,
        highlightReview: false, // force isAllDefaults=false
        updatedAt: ts,
      },
    })

    mockState.notificationPreferences = {
      data: remoteRow({ course_complete: false, updated_at: ts }),
      error: null,
    }

    await hydrateSettingsFromSupabase({}, USER_ID)

    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(false)
  })

  it('R11: malformed quiet_hours_start is dropped, DEFAULTS value used', async () => {
    mockState.notificationPreferences = {
      data: remoteRow({
        quiet_hours_enabled: true,
        quiet_hours_start: '99:00', // malformed
        quiet_hours_end: '06:00',
      }),
      error: null,
    }

    await hydrateSettingsFromSupabase({}, USER_ID)

    const prefs = useNotificationPrefsStore.getState().prefs
    // Malformed start fell back to DEFAULTS ('22:00'), end was applied.
    expect(prefs.quietHoursStart).toBe('22:00')
    expect(prefs.quietHoursEnd).toBe('06:00')
  })

  it('R12: unknown remote field is silently ignored (no runtime error)', async () => {
    mockState.notificationPreferences = {
      data: remoteRow({
        unknown_field_from_future_epic: 'surprise',
        course_complete: false,
      }),
      error: null,
    }

    await expect(hydrateSettingsFromSupabase({}, USER_ID)).resolves.toBeUndefined()
    expect(useNotificationPrefsStore.getState().prefs.courseComplete).toBe(false)
  })

  it('R9: Supabase fetch error is swallowed — store unchanged, no throw', async () => {
    mockState.notificationPreferences = {
      data: null,
      error: { message: 'network down', code: '500' },
    }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(hydrateSettingsFromSupabase({}, USER_ID)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('no-echo-loop invariant: hydration does NOT enqueue a syncQueue entry', async () => {
    // This is the critic-flagged invariant. Writing the remote row back to
    // the queue here would make every device re-upload the row it just
    // downloaded on every sign-in — O(N) amplification per device.
    mockState.notificationPreferences = {
      data: remoteRow({ course_complete: false }),
      error: null,
    }

    await hydrateSettingsFromSupabase({}, USER_ID)

    const queue = await db.syncQueue.toArray()
    const prefsEntries = queue.filter(q => q.tableName === 'notificationPreferences')
    expect(prefsEntries).toHaveLength(0)
  })
})
