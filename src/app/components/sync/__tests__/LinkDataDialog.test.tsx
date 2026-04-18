/**
 * Unit tests for LinkDataDialog business logic.
 *
 * We focus on the two resolution paths (handleLink / handleStartFresh) and
 * the localStorage flag — not on Radix's non-dismissibility behaviour, which
 * requires a real browser and is exercised in E2E tests instead.
 *
 * The countUnlinkedRecords module is mocked so tests run without IndexedDB.
 * syncEngine, backfillUserId, db, and clearSyncState are all mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { LinkDataDialog } from '../LinkDataDialog'

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@/lib/sync/countUnlinkedRecords', () => ({
  countUnlinkedRecords: vi.fn().mockResolvedValue({
    courses: 2,
    notes: 3,
    books: 1,
    flashcards: 0,
    other: 0,
  }),
}))

vi.mock('@/lib/sync/backfill', () => ({
  backfillUserId: vi.fn().mockResolvedValue(undefined),
  SYNCABLE_TABLES: ['notes', 'books'],
}))

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    start: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/sync/clearSyncState', () => ({
  clearSyncState: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/db', () => ({
  db: {
    table: vi.fn().mockReturnValue({
      clear: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

// ─── Import mocked modules after vi.mock ─────────────────────────────────────

import { backfillUserId } from '@/lib/sync/backfill'
import { syncEngine } from '@/lib/sync/syncEngine'
import { clearSyncState } from '@/lib/sync/clearSyncState'
import { db } from '@/db'
import { countUnlinkedRecords } from '@/lib/sync/countUnlinkedRecords'

// ─── Setup ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc'

function renderDialog(props?: Partial<React.ComponentProps<typeof LinkDataDialog>>) {
  const onResolved = vi.fn()
  render(
    <LinkDataDialog
      open={true}
      userId={USER_ID}
      onResolved={onResolved}
      {...props}
    />,
  )
  return { onResolved }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // Restore default mock return values after vi.clearAllMocks() wipes them
  vi.mocked(countUnlinkedRecords).mockResolvedValue({
    courses: 2,
    notes: 3,
    books: 1,
    flashcards: 0,
    other: 0,
  })
  vi.mocked(backfillUserId).mockResolvedValue(undefined)
  vi.mocked(syncEngine.start).mockResolvedValue(undefined)
  vi.mocked(clearSyncState).mockResolvedValue(undefined)
  vi.mocked(db.table).mockReturnValue({
    clear: vi.fn().mockResolvedValue(undefined),
  } as ReturnType<typeof db.table>)
  // Ensure window.confirm returns true by default (user confirms)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LinkDataDialog', () => {
  describe('rendering', () => {
    it('renders the dialog heading and description', async () => {
      renderDialog()
      expect(screen.getByText('You have local data')).toBeDefined()
      expect(
        screen.getByText(/We found data saved on this device/i),
      ).toBeDefined()
    })

    it('renders both action buttons', async () => {
      renderDialog()
      expect(screen.getByRole('button', { name: /link to my account/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /start fresh/i })).toBeDefined()
    })

    it('shows a loading skeleton while counts are being fetched', () => {
      // countUnlinkedRecords is async — skeleton visible before it resolves
      vi.mocked(countUnlinkedRecords).mockImplementation(
        () => new Promise(() => { /* never resolves in this test */ }),
      )
      renderDialog()
      // Skeleton has animate-pulse — check it exists in DOM
      const skeleton = document.querySelector('.animate-pulse')
      expect(skeleton).not.toBeNull()
    })

    it('shows category rows once counts resolve', async () => {
      renderDialog()
      // Wait for countUnlinkedRecords to resolve and re-render
      await waitFor(() => {
        expect(screen.getByText('Courses & videos')).toBeDefined()
        expect(screen.getByText('Notes')).toBeDefined()
        expect(screen.getByText('Books')).toBeDefined()
      })
    })

    it('does not render when open=false', () => {
      renderDialog({ open: false })
      expect(screen.queryByText('You have local data')).toBeNull()
    })
  })

  describe('handleLink', () => {
    it('calls backfillUserId with the correct userId', async () => {
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /link to my account/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
      expect(backfillUserId).toHaveBeenCalledWith(USER_ID)
    })

    it('starts the sync engine after backfill', async () => {
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /link to my account/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
      expect(syncEngine.start).toHaveBeenCalledWith(USER_ID)
    })

    it('sets the localStorage linked flag', async () => {
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /link to my account/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
      expect(localStorage.getItem(`sync:linked:${USER_ID}`)).toBe('true')
    })

    it('calls onResolved even when backfillUserId throws', async () => {
      vi.mocked(backfillUserId).mockRejectedValueOnce(new Error('backfill failed'))
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /link to my account/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
    })
  })

  describe('handleStartFresh', () => {
    it('shows a window.confirm before clearing data', async () => {
      renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }))
      expect(window.confirm).toHaveBeenCalled()
    })

    it('does nothing if the user cancels the confirm dialog', async () => {
      vi.mocked(window.confirm).mockReturnValueOnce(false)
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }))
      // Give any async work time to run
      await new Promise((r) => setTimeout(r, 50))
      expect(onResolved).not.toHaveBeenCalled()
      expect(clearSyncState).not.toHaveBeenCalled()
    })

    it('clears all SYNCABLE_TABLES when confirmed', async () => {
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
      // db.table().clear() should have been called for each table
      expect(db.table).toHaveBeenCalledWith('notes')
      expect(db.table).toHaveBeenCalledWith('books')
    })

    it('calls clearSyncState after clearing tables', async () => {
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
      expect(clearSyncState).toHaveBeenCalled()
    })

    it('starts the sync engine after clearing', async () => {
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
      expect(syncEngine.start).toHaveBeenCalledWith(USER_ID)
    })

    it('sets the localStorage linked flag', async () => {
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
      expect(localStorage.getItem(`sync:linked:${USER_ID}`)).toBe('true')
    })

    it('calls onResolved even when clearSyncState throws', async () => {
      vi.mocked(clearSyncState).mockRejectedValueOnce(new Error('clear failed'))
      const { onResolved } = renderDialog()
      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }))
      await waitFor(() => expect(onResolved).toHaveBeenCalled())
    })
  })
})
