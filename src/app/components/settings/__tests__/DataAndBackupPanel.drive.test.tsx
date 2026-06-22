import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataAndBackupPanel } from '@/app/components/settings/DataAndBackupPanel'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetDriveToken = vi.fn()
const mockUploadBackupToDrive = vi.fn()
const mockExportAllAsJson = vi.fn()
const mockSignInWithGoogle = vi.fn()

vi.mock('@/lib/googleDriveToken', () => ({
  getDriveToken: () => mockGetDriveToken(),
}))

vi.mock('@/lib/googleDriveUpload', () => {
  const DriveQuotaError = class extends Error {
    constructor() {
      super('Your Google Drive is full.')
      this.name = 'DriveQuotaError'
    }
  }
  const DrivePermissionError = class extends Error {
    constructor() {
      super('Reconnect Google')
      this.name = 'DrivePermissionError'
    }
  }
  const DriveNetworkError = class extends Error {
    constructor() {
      super('Upload failed. Try again?')
      this.name = 'DriveNetworkError'
    }
  }
  return {
    uploadBackupToDrive: (...args: unknown[]) => mockUploadBackupToDrive(...args),
    DriveQuotaError,
    DrivePermissionError,
    DriveNetworkError,
  }
})

vi.mock('@/lib/exportService', () => ({
  exportAllAsJson: (onProgress?: (pct: number, phase: string) => void) =>
    mockExportAllAsJson(onProgress),
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ signInWithGoogle: mockSignInWithGoogle }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────

describe('DataAndBackupPanel', () => {
  it('renders the send to drive section', () => {
    render(<DataAndBackupPanel />)

    expect(screen.getByText('Send to Google Drive')).toBeInTheDocument()
    expect(
      screen.getByText('Upload your backup JSON to Google Drive for safekeeping')
    ).toBeInTheDocument()
    expect(screen.getByTestId('send-to-drive-button')).toBeInTheDocument()
  })

  it('shows "Uploading..." on the button during upload', async () => {
    // Use a delayed promise so React renders the intermediate "Uploading" state
    mockGetDriveToken.mockResolvedValue('valid-token')
    mockExportAllAsJson.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => resolve({ schemaVersion: 14, exportedAt: '', data: {} }), 100)
        )
    )
    mockUploadBackupToDrive.mockResolvedValue({ fileId: 'id', webViewLink: 'https://drivE' })

    const user = userEvent.setup()
    render(<DataAndBackupPanel />)

    await user.click(screen.getByTestId('send-to-drive-button'))

    // React should have committed "Uploading..." while export is pending
    await waitFor(() => {
      expect(screen.getByTestId('send-to-drive-button')).toHaveTextContent(/Uploading/)
    })
  })

  it('opens reconnect dialog when token is null', async () => {
    mockGetDriveToken.mockResolvedValue(null)
    const user = userEvent.setup()

    render(<DataAndBackupPanel />)

    await user.click(screen.getByTestId('send-to-drive-button'))

    // Reconnect dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Connect Google Drive')).toBeInTheDocument()
    })
  })

  it('shows upload progress during export', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    // Make export yield so React renders the "Uploading" state first
    mockExportAllAsJson.mockImplementation(
      (onProgress?: (pct: number, phase: string) => void) =>
        new Promise<{ schemaVersion: number; exportedAt: string; data: Record<string, never> }>(
          resolve => {
            setTimeout(() => {
              onProgress?.(50, 'Exporting courses...')
              resolve({ schemaVersion: 14, exportedAt: new Date().toISOString(), data: {} })
            }, 100)
          }
        )
    )
    mockUploadBackupToDrive.mockResolvedValue({
      fileId: 'test-file-id',
      webViewLink: 'https://drive.google.com/file/d/test-file-id/view',
    })

    const user = userEvent.setup()
    render(<DataAndBackupPanel />)

    await user.click(screen.getByTestId('send-to-drive-button'))

    // Should see progress indicator
    await waitFor(() => {
      expect(screen.getByTestId('drive-upload-progress')).toBeInTheDocument()
    })
  })

  it('shows reconnect button label when token is null and user returns to panel', async () => {
    mockGetDriveToken.mockResolvedValue(null)
    mockSignInWithGoogle.mockResolvedValue({})

    const user = userEvent.setup()
    render(<DataAndBackupPanel />)

    // Click to check token — triggers reconnect dialog
    await user.click(screen.getByTestId('send-to-drive-button'))

    await waitFor(() => {
      expect(screen.getByText('Connect Google Drive')).toBeInTheDocument()
    })

    // Close the dialog
    await user.click(screen.getByText('Cancel'))

    // After closing, button should show "Reconnect Google" because
    // the component remembers that token was null
    await waitFor(() => {
      expect(screen.getByTestId('send-to-drive-button')).toHaveTextContent(/Reconnect/)
    })
  })
})
