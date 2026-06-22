/**
 * DataAndBackupPanel tests — E77a-S01
 *
 * Covers rendering and user interaction states.
 * Download/restore flows involve browser APIs (createObjectURL, file input)
 * which are tested via the underlying service functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks (before imports)
// ---------------------------------------------------------------------------

vi.mock('@/db/checkpoint', () => ({
  CHECKPOINT_VERSION: 65,
}))

vi.mock('@/lib/exportService', () => ({
  collectBackupPayload: vi.fn().mockResolvedValue({
    schemaVersion: 65,
    exportedAt: '2026-01-01T00:00:00Z',
    data: {},
    settings: {},
  }),
  exportAllAsBlob: vi.fn().mockResolvedValue({
    blob: new Blob(['{}'], { type: 'application/json' }),
    filename: 'knowlune-backup-2026-01-01-120000.json',
  }),
}))

vi.mock('@/lib/importService', () => ({
  restoreFromBackup: vi.fn().mockResolvedValue({
    totalRecords: 42,
    counts: { importedCourses: 42 },
    schemaVersion: 65,
    wasMigrated: false,
    warnings: [],
  }),
}))

vi.mock('@/app/components/ui/spinner', () => ({
  Spinner: ({
    className,
    'aria-label': ariaLabel,
  }: {
    className?: string
    'aria-label'?: string
  }) => React.createElement('span', { className, 'aria-label': ariaLabel }, '...'),
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastSuccess: { exported: vi.fn() },
  toastError: { invalidFile: vi.fn(), importFailed: vi.fn(), saveFailed: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

const { DataAndBackupPanel } = await import('@/app/components/settings/DataAndBackupPanel')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataAndBackupPanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the backup section heading', () => {
    render(React.createElement(DataAndBackupPanel))

    expect(screen.getByText('Backup & Restore')).toBeDefined()
  })

  it('displays current schema version', () => {
    render(React.createElement(DataAndBackupPanel))

    expect(screen.getByText('v65')).toBeDefined()
  })

  it('renders "Download Backup" button', () => {
    render(React.createElement(DataAndBackupPanel))

    expect(screen.getByTestId('download-backup-btn')).toBeDefined()
    expect(screen.getByText('Download Backup')).toBeDefined()
  })

  it('renders "Restore from File" button', () => {
    render(React.createElement(DataAndBackupPanel))

    expect(screen.getByTestId('restore-backup-btn')).toBeDefined()
    expect(screen.getByText('Restore from File')).toBeDefined()
  })

  it('does not show "Last backup" when no backup has been made', () => {
    render(React.createElement(DataAndBackupPanel))

    expect(screen.queryByText('Last backup')).toBeNull()
  })

  it('shows "Last backup" date when a backup timestamp exists in localStorage', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    localStorage.setItem('knowlune-last-backup-at', yesterday)

    render(React.createElement(DataAndBackupPanel))

    expect(screen.getByText('Last backup')).toBeDefined()
  })

  it('disables both buttons while a backup is being created', async () => {
    // Override to create a slow export
    const { exportAllAsBlob } = await import('@/lib/exportService')
    vi.mocked(exportAllAsBlob).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              blob: new Blob(['{}'], { type: 'application/json' }),
              filename: 'test.json',
            })
          }, 1000)
        })
    )

    render(React.createElement(DataAndBackupPanel))

    const downloadBtn = screen.getByTestId('download-backup-btn')
    const restoreBtn = screen.getByTestId('restore-backup-btn')

    // Click download
    await userEvent.click(downloadBtn)

    // Both buttons should be disabled during export
    expect(downloadBtn).toBeDisabled()
    expect(restoreBtn).toBeDisabled()
  })

  it('renders a hidden file input for restore', () => {
    render(React.createElement(DataAndBackupPanel))

    const fileInput = screen.getByTestId('backup-file-input')
    expect(fileInput).toBeDefined()
    expect(fileInput).toHaveAttribute('type', 'file')
    expect(fileInput).toHaveAttribute('aria-hidden', 'true')
  })
})
