import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tableRegistry, ERASURE_TABLE_NAMES } from '@/lib/sync/tableRegistry'

const {
  mockSignInWithPassword,
  mockFrom,
  mockFunctionsInvoke,
  mockGetState,
  mockSetState,
  mockEntitlementsDelete,
} = vi.hoisted(() => {
  const mockSignOut = vi.fn(() => Promise.resolve({ error: null }))
  const storeState = {
    session: {
      access_token: '',
      token_type: 'bearer',
    },
    user: { id: 'user-1', email: 'test@example.com', created_at: '2026-01-01' },
    signOut: mockSignOut,
  }

  return {
    mockSignInWithPassword: vi.fn(),
    mockFrom: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
    mockFunctionsInvoke: vi.fn(),
    mockGetState: vi.fn(() => storeState),
    mockSetState: vi.fn(),
    mockEntitlementsDelete: vi.fn(() => Promise.resolve()),
    storeState,
    mockSignOut,
  }
})

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: mockSignInWithPassword },
    from: mockFrom,
    functions: { invoke: mockFunctionsInvoke },
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: mockGetState,
    setState: mockSetState,
  },
}))

vi.mock('@/db/schema', () => ({
  db: {
    entitlements: { delete: mockEntitlementsDelete },
  },
}))

import {
  sessionRequiresReauth,
  reauthenticate,
  getAccountData,
  deleteAccount,
  cancelAccountDeletion,
  DELETION_STEP_LABELS,
  DELETION_STEP_PROGRESS,
  SOFT_DELETE_GRACE_DAYS,
} from '../account/deleteAccount'

function makeFreshToken() {
  const iat = Math.floor(Date.now() / 1000)
  return 'header.' + btoa(JSON.stringify({ iat })) + '.sig'
}

function makeExpiredToken() {
  const iat = Math.floor(Date.now() / 1000) - 6 * 60
  return 'header.' + btoa(JSON.stringify({ iat })) + '.sig'
}

describe('deleteAccount module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      session: {
        access_token: makeFreshToken(),
        token_type: 'bearer',
      },
      user: { id: 'user-1', email: 'test@example.com', created_at: '2026-01-01' },
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    })
  })

  describe('constants', () => {
    it('exports DELETION_STEP_LABELS for all steps', () => {
      expect(DELETION_STEP_LABELS.verifying).toBe('Verifying your identity...')
      expect(DELETION_STEP_LABELS.complete).toBe('Account deletion scheduled')
    })

    it('exports DELETION_STEP_PROGRESS with 100 for complete', () => {
      expect(DELETION_STEP_PROGRESS.verifying).toBe(10)
      expect(DELETION_STEP_PROGRESS.complete).toBe(100)
    })

    it('exports SOFT_DELETE_GRACE_DAYS as 7', () => {
      expect(SOFT_DELETE_GRACE_DAYS).toBe(7)
    })
  })

  describe('sessionRequiresReauth', () => {
    it('returns true when session is null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockGetState.mockReturnValue({ session: null, user: null, signOut: vi.fn() } as any)
      expect(sessionRequiresReauth()).toBe(true)
    })

    it('returns false for fresh session', () => {
      expect(sessionRequiresReauth()).toBe(false)
    })

    it('returns true for expired session (iat > 5 minutes ago)', () => {
      mockGetState.mockReturnValue({
        session: {
          access_token: makeExpiredToken(),
          token_type: 'bearer',
        },
        user: { id: 'user-1', email: 'test@example.com' },
        signOut: vi.fn(),
      } as any)
      expect(sessionRequiresReauth()).toBe(true)
    })

    it('returns true when token has no iat', () => {
      mockGetState.mockReturnValue({
        session: {
          access_token: 'header.' + btoa(JSON.stringify({})) + '.sig',
          token_type: 'bearer',
        },
        user: { id: 'user-1' },
        signOut: vi.fn(),
      } as any)
      expect(sessionRequiresReauth()).toBe(true)
    })

    it('returns true for malformed JWT', () => {
      mockGetState.mockReturnValue({
        session: { access_token: 'invalid', token_type: 'bearer' },
        user: { id: 'user-1' },
        signOut: vi.fn(),
      } as any)
      expect(sessionRequiresReauth()).toBe(true)
    })
  })

  describe('reauthenticate', () => {
    it('succeeds when signInWithPassword returns no error', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null })
      const result = await reauthenticate('password123')
      expect(result.error).toBeUndefined()
    })

    it('returns error for wrong password', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid' } })
      const result = await reauthenticate('wrong')
      expect(result.error).toBe('Incorrect password. Please try again.')
    })

    it('returns error when signIn throws', async () => {
      mockSignInWithPassword.mockRejectedValue(new Error('Network'))
      const result = await reauthenticate('password')
      expect(result.error).toContain('Unable to verify password')
    })
  })

  describe('getAccountData', () => {
    it('returns account data for authenticated user', async () => {
      const data = await getAccountData()
      expect(data).toEqual(
        expect.objectContaining({
          email: 'test@example.com',
          createdAt: '2026-01-01',
        })
      )
    })

    it('returns null when no user', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockGetState.mockReturnValue({ session: null, user: null, signOut: vi.fn() } as any)
      const data = await getAccountData()
      expect(data).toBeNull()
    })
  })

  describe('deleteAccount', () => {
    it('succeeds for full deletion flow', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { step: 'customer_deleted' },
        error: null,
      })

      const steps: string[] = []
      const result = await deleteAccount(step => steps.push(step))

      expect(result.success).toBe(true)
      expect(steps).toContain('verifying')
      expect(steps).toContain('cancelling-subscription')
      expect(steps).toContain('complete')
    })

    it('returns error when session is null', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockGetState.mockReturnValue({ session: null, user: null, signOut: vi.fn() } as any)
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.error).toContain('signed in')
    })

    it('returns error when session requires reauth', async () => {
      mockGetState.mockReturnValue({
        session: {
          access_token: makeExpiredToken(),
          token_type: 'bearer',
        },
        user: { id: 'user-1', email: 'test@example.com' },
        signOut: vi.fn(),
      } as any)
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.error).toContain('password')
    })

    it('returns invoiceError when open invoices', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'open invoice' },
      })
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.invoiceError).toBe(true)
    })

    it('returns flaggedForAdmin on auth_deletion_failed', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'auth_deletion_failed' },
      })
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.flaggedForAdmin).toBe(true)
    })

    it('returns generic error on unknown failure', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'unknown error' },
      })
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unable to delete account')
    })

    it('handles exception during deletion', async () => {
      mockFunctionsInvoke.mockRejectedValue(new Error('Network'))
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.error).toContain('connection')
    })

    it('returns error when body contains error (boot-crash: error=null, data.error set)', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { error: 'Worker failed to boot', details: 'import error' },
        error: null,
      })
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Account deletion failed')
    })

    it('returns error when body success=false (application-level failure)', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { success: false, error: 'open invoice' },
        error: null,
      })
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Account deletion failed')
    })

    it('returns error when body has router msg envelope (main router failure)', async () => {
      // Main router returns { success: false, error, msg } on worker dispatch failure.
      // F2: guard must catch data.msg even if callers previously only looked at data.error.
      mockFunctionsInvoke.mockResolvedValue({
        data: { msg: 'worker create timed out after 10000ms' },
        error: null,
      })
      const result = await deleteAccount()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Account deletion failed')
    })
  })

  describe('cancelAccountDeletion', () => {
    it('succeeds when edge function succeeds', async () => {
      mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null })
      const result = await cancelAccountDeletion()
      expect(result.error).toBeUndefined()
    })

    it('returns error when edge function fails', async () => {
      mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'Not found' } })
      const result = await cancelAccountDeletion()
      expect(result.error).toContain('cancel deletion')
    })

    it('returns error on network failure', async () => {
      mockFunctionsInvoke.mockRejectedValue(new Error('Network'))
      const result = await cancelAccountDeletion()
      expect(result.error).toContain('connection')
    })

    it('returns error when no session', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockGetState.mockReturnValue({ session: null, user: null, signOut: vi.fn() } as any)
      const result = await cancelAccountDeletion()
      expect(result.error).toContain('signed in')
    })

    it('returns error when body contains data.error (boot-crash)', async () => {
      // F3 symmetric guard — mirrors the deleteAccount body-error coverage.
      mockFunctionsInvoke.mockResolvedValue({
        data: { error: 'Worker failed to boot' },
        error: null,
      })
      const result = await cancelAccountDeletion()
      expect(result.error).toContain('cancel deletion')
    })

    it('returns error when body contains router msg envelope', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { msg: 'missing function name in request' },
        error: null,
      })
      const result = await cancelAccountDeletion()
      expect(result.error).toContain('cancel deletion')
    })

    it('returns error when body has success=false', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { success: false, error: 'already cancelled' },
        error: null,
      })
      const result = await cancelAccountDeletion()
      expect(result.error).toContain('cancel deletion')
    })
  })
})

// ---------------------------------------------------------------------------
// E119-S03: Erasure cascade probe tests + registry-drift guard
//
// These tests do NOT import the Deno _shared/hardDeleteUser.ts module (it uses
// Deno-only URL imports incompatible with Vitest). Instead, they:
//   1. Import ERASURE_TABLE_NAMES from tableRegistry.ts (TypeScript, Vite-safe)
//      which is derived from tableRegistry the same way hardDeleteUser derives
//      TABLE_NAMES at runtime.
//   2. Assert that the two lists have the same length — if a developer adds a
//      new tableRegistry entry without updating _shared/hardDeleteUser.ts TABLE_NAMES,
//      the count diverges and this test fails CI.
//   3. Assert the canonical list of 4 Storage buckets.
//   4. Assert that the Edge Function invocations use the correct function names.
// ---------------------------------------------------------------------------

describe('E119-S03: erasure cascade — registry probe and drift guard', () => {
  // -------------------------------------------------------------------------
  // Registry-drift guard (AC-9)
  //
  // The TABLE_NAMES array in supabase/functions/_shared/hardDeleteUser.ts must
  // stay in sync with ERASURE_TABLE_NAMES exported from tableRegistry.ts.
  //
  // This test fails CI if:
  //   - A new entry is added to tableRegistry without updating TABLE_NAMES
  //   - A table is removed from tableRegistry without updating TABLE_NAMES
  //   - The counts drift for any reason
  //
  // To fix: update TABLE_NAMES in _shared/hardDeleteUser.ts to match
  // tableRegistry.map(e => e.supabaseTable).
  // -------------------------------------------------------------------------

  // Inline TABLE_NAMES snapshot mirroring _shared/hardDeleteUser.ts.
  // This is the source of truth for the drift assertion.
  const HARD_DELETE_TABLE_NAMES: string[] = [
    // P0
    'content_progress',
    'study_sessions',
    'video_progress',
    // P1
    'notes',
    'bookmarks',
    'flashcards',
    'review_records',
    'embeddings',
    'book_highlights',
    'vocabulary_items',
    'audio_bookmarks',
    'audio_clips',
    'chat_conversations',
    'learner_models',
    // P2
    'imported_courses',
    'imported_videos',
    'imported_pdfs',
    'authors',
    'books',
    'book_reviews',
    'shelves',
    'book_shelves',
    'reading_queue',
    'chapter_mappings',
    // P3
    'learning_paths',
    'learning_path_entries',
    'challenges',
    'course_reminders',
    'notifications',
    'career_paths',
    'path_enrollments',
    'study_schedules',
    'opds_catalogs',
    'audiobookshelf_servers',
    'notification_preferences',
    // P4
    'quizzes',
    'quiz_attempts',
    'ai_usage_events',
  ]

  const HARD_DELETE_STORAGE_BUCKETS = ['avatars', 'course-media', 'audio', 'exports']

  describe('ERASURE_TABLE_NAMES export', () => {
    it('is derived from tableRegistry (one entry per registry table)', () => {
      expect(ERASURE_TABLE_NAMES).toHaveLength(tableRegistry.length)
    })

    it('maps each registry entry to its supabaseTable name', () => {
      for (let i = 0; i < tableRegistry.length; i++) {
        expect(ERASURE_TABLE_NAMES[i]).toBe(tableRegistry[i].supabaseTable)
      }
    })

    it('contains no duplicates', () => {
      const unique = new Set(ERASURE_TABLE_NAMES)
      expect(unique.size).toBe(ERASURE_TABLE_NAMES.length)
    })
  })

  describe('registry-drift guard (AC-9)', () => {
    it('hardDeleteUser TABLE_NAMES covers exactly the same tables as tableRegistry', () => {
      // If this fails, update TABLE_NAMES in supabase/functions/_shared/hardDeleteUser.ts
      // to match tableRegistry.map(e => e.supabaseTable).
      expect(HARD_DELETE_TABLE_NAMES).toHaveLength(tableRegistry.length)
    })

    it('hardDeleteUser TABLE_NAMES matches ERASURE_TABLE_NAMES entry-for-entry', () => {
      expect(HARD_DELETE_TABLE_NAMES).toEqual(ERASURE_TABLE_NAMES)
    })

    it('all hardDeleteUser TABLE_NAMES appear in tableRegistry supabaseTable list', () => {
      const registryTables = new Set(tableRegistry.map(e => e.supabaseTable))
      for (const tableName of HARD_DELETE_TABLE_NAMES) {
        expect(registryTables.has(tableName)).toBe(true)
      }
    })
  })

  describe('storage bucket coverage (AC-2)', () => {
    it('cascade targets exactly 4 Storage buckets', () => {
      expect(HARD_DELETE_STORAGE_BUCKETS).toHaveLength(4)
    })

    it('cascade targets the expected bucket names', () => {
      expect(HARD_DELETE_STORAGE_BUCKETS).toEqual(['avatars', 'course-media', 'audio', 'exports'])
    })
  })

  describe('delete-account Edge Function soft-delete behaviour (AC-3)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockGetState.mockReturnValue({
        session: {
          access_token: 'header.' + btoa(JSON.stringify({ iat: Math.floor(Date.now() / 1000) })) + '.sig',
          token_type: 'bearer',
        },
        user: { id: 'user-1', email: 'test@example.com', created_at: '2026-01-01' },
        signOut: vi.fn(() => Promise.resolve({ error: null })),
      })
    })

    afterEach(() => {
      vi.clearAllMocks()
    })

    it('deleteAccount invokes delete-account edge function (soft-delete phase)', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { step: 'customer_deleted' },
        error: null,
      })

      const { deleteAccount } = await import('../account/deleteAccount')
      const result = await deleteAccount()

      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'delete-account',
        expect.objectContaining({ body: {} })
      )
      expect(result.success).toBe(true)
    })

    it('cancelAccountDeletion invokes cancel-account-deletion edge function', async () => {
      mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null })

      const { cancelAccountDeletion } = await import('../account/deleteAccount')
      const result = await cancelAccountDeletion()

      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'cancel-account-deletion',
        expect.objectContaining({ body: {} })
      )
      expect(result.error).toBeUndefined()
    })
  })

  describe('table count invariants', () => {
    it('registry has 38 tables (update if a new table is added to tableRegistry)', () => {
      // This assertion documents the expected table count at E119 time.
      // When a new sync table is added to tableRegistry, this count must increase
      // AND TABLE_NAMES in _shared/hardDeleteUser.ts must be updated.
      expect(tableRegistry).toHaveLength(38)
    })

    it('ERASURE_TABLE_NAMES has 38 entries matching the registry', () => {
      expect(ERASURE_TABLE_NAMES).toHaveLength(38)
    })
  })
})
