import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataAndBackupPanel } from '@/app/components/settings/DataAndBackupPanel'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSettings = vi.fn()
const mockGetDriveToken = vi.fn()
const FIXED_DATE = new Date('2026-07-17T09:00:00.000Z')
const FIXED_NOW = FIXED_DATE.getTime()

vi.mock('@/lib/settings', () => ({
  getSettings: () => mockGetSettings(),
  saveSettings: vi.fn(),
}))

vi.mock('@/lib/googleDriveToken', () => ({
  getDriveToken: () => mockGetDriveToken(),
}))

vi.mock('@/lib/googleDriveUpload', () => ({
  uploadBackupToDrive: vi.fn(),
}))

vi.mock('@/lib/exportService', () => ({
  exportAllAsJson: vi.fn(),
  updateBackupMeta: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

// Mock date-fns to return predictable relative times
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_DATE)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSettings(overrides?: Record<string, unknown>) {
  const defaults = {
    displayName: 'Learner',
    bio: '',
    theme: 'system',
    colorScheme: 'professional',
    accessibilityFont: false,
    contentDensity: 'default',
    reduceMotion: 'system',
    focusAutoQuiz: true,
    focusAutoFlashcard: true,
    readingFontSize: '1x',
    readingLineHeight: 1.5,
    readingTheme: 'auto',
    autoSyncEnabled: true,
    backupMeta: undefined,
  }
  return { ...defaults, ...overrides }
}

describe('DataAndBackupPanel — backup metadata display (E77A-S04)', () => {
  it('shows "just now (Local)" after a local backup success', () => {
    mockGetSettings.mockReturnValue(
      createSettings({
        backupMeta: {
          lastLocalAt: FIXED_NOW - 30_000,
          lastDestination: 'local',
        },
      })
    )

    render(<DataAndBackupPanel />)

    expect(screen.getByTestId('recent-backup-text')).toHaveTextContent(/just now/)
    expect(screen.getByTestId('recent-backup-text')).toHaveTextContent(/Local/)
    expect(screen.getByTestId('backup-status-banner')).toHaveAttribute('data-stale', 'false')
  })

  it('shows "just now (Drive)" after a Drive backup success', () => {
    mockGetSettings.mockReturnValue(
      createSettings({
        backupMeta: {
          lastDriveAt: FIXED_NOW - 30_000,
          lastDestination: 'drive',
        },
      })
    )

    render(<DataAndBackupPanel />)

    expect(screen.getByTestId('recent-backup-text')).toHaveTextContent(/just now/)
    expect(screen.getByTestId('recent-backup-text')).toHaveTextContent(/Drive/)
  })

  it('shows amber "No backup yet" hint when never backed up', () => {
    mockGetSettings.mockReturnValue(createSettings({ backupMeta: undefined }))

    render(<DataAndBackupPanel />)

    expect(screen.getByTestId('never-backed-up-text')).toBeInTheDocument()
    expect(screen.getByTestId('never-backed-up-text')).toHaveTextContent('No backup yet')
    expect(screen.getByTestId('backup-status-banner')).toHaveAttribute('data-never', 'true')
  })

  it('shows red stale warning when last backup is >30 days ago', () => {
    const thirtyOneDaysAgo = FIXED_NOW - 31 * 24 * 60 * 60 * 1000
    mockGetSettings.mockReturnValue(
      createSettings({
        backupMeta: {
          lastDriveAt: thirtyOneDaysAgo,
          lastDestination: 'drive',
        },
      })
    )

    render(<DataAndBackupPanel />)

    expect(screen.getByTestId('stale-backup-text')).toBeInTheDocument()
    // date-fns mock returns "5 minutes ago" for any input, so we check partial text
    expect(screen.getByTestId('stale-backup-text')).toHaveTextContent(/Last backup was/)
    expect(screen.getByTestId('backup-status-banner')).toHaveAttribute('data-stale', 'true')
  })

  it('shows stale warning even when only lastLocalAt exists and is old', () => {
    const fortyDaysAgo = FIXED_NOW - 40 * 24 * 60 * 60 * 1000
    mockGetSettings.mockReturnValue(
      createSettings({
        backupMeta: {
          lastLocalAt: fortyDaysAgo,
          lastDestination: 'local',
        },
      })
    )

    render(<DataAndBackupPanel />)

    expect(screen.getByTestId('stale-backup-text')).toBeInTheDocument()
    expect(screen.getByTestId('backup-status-banner')).toHaveAttribute('data-stale', 'true')
  })

  it('shows recent backup when backupMeta is empty (no timestamps stored)', () => {
    mockGetSettings.mockReturnValue(createSettings({ backupMeta: { lastDestination: undefined } }))

    render(<DataAndBackupPanel />)

    expect(screen.getByTestId('never-backed-up-text')).toBeInTheDocument()
  })

  it('falls back to latest timestamp source when no lastDestination is set', () => {
    const twoHoursAgo = FIXED_NOW - 2 * 60 * 60 * 1000
    mockGetSettings.mockReturnValue(
      createSettings({
        backupMeta: {
          lastLocalAt: twoHoursAgo,
        },
      })
    )

    render(<DataAndBackupPanel />)

    expect(screen.getByTestId('recent-backup-text')).toHaveTextContent(/Local/)
  })

  it('shows Drive label when Drive was more recent but no lastDestination set', () => {
    const twoHoursAgo = FIXED_NOW - 2 * 60 * 60 * 1000
    const threeHoursAgo = FIXED_NOW - 3 * 60 * 60 * 1000
    mockGetSettings.mockReturnValue(
      createSettings({
        backupMeta: {
          lastLocalAt: threeHoursAgo,
          lastDriveAt: twoHoursAgo,
        },
      })
    )

    render(<DataAndBackupPanel />)

    expect(screen.getByTestId('recent-backup-text')).toHaveTextContent(/Drive/)
  })
})
