import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataAndBackupPanel } from '@/app/components/settings/DataAndBackupPanel'
import { toast } from 'sonner'

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

const mockUpdateBackupMeta = vi.fn()
vi.mock('@/lib/exportService', () => ({
  exportAllAsJson: (onProgress?: (pct: number, phase: string) => void) =>
    mockExportAllAsJson(onProgress),
  updateBackupMeta: (...args: unknown[]) => mockUpdateBackupMeta(...args),
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

  it('shows success toast with webViewLink and progress reaches 100% (AC2)', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    mockExportAllAsJson.mockResolvedValue({
      schemaVersion: 14,
      exportedAt: new Date().toISOString(),
      data: {},
    })
    mockUploadBackupToDrive.mockResolvedValue({
      fileId: 'test-file-id',
      webViewLink: 'https://drive.google.com/file/d/test/view',
    })

    const user = userEvent.setup()
    render(<DataAndBackupPanel />)

    await user.click(screen.getByTestId('send-to-drive-button'))

    // Wait for upload to finish — button re-enabled and progress gone
    await waitFor(() => {
      expect(screen.getByTestId('send-to-drive-button')).toBeEnabled()
    })

    // Progress indicator is no longer visible (isUploading = false)
    expect(screen.queryByTestId('drive-upload-progress')).not.toBeInTheDocument()

    // toast.success was called with success content
    expect(toast.success).toHaveBeenCalledWith(expect.objectContaining({}), expect.anything())

    // AC2: updateBackupMeta was called with 'drive' after successful upload
    expect(mockUpdateBackupMeta).toHaveBeenCalledWith('drive')
  })

  it('shows "Export failed" toast when export throws an unexpected error (AC3)', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    const exportError = new Error('Unexpected export failure')
    mockExportAllAsJson.mockRejectedValue(exportError)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<DataAndBackupPanel />)

    await user.click(screen.getByTestId('send-to-drive-button'))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Drive export error:', exportError)
    })

    expect(toast.error).toHaveBeenCalledWith('Export failed. Try again?')

    consoleSpy.mockRestore()
  })

  it('shows "Upload failed" toast when upload throws an unexpected error (AC9)', async () => {
    mockGetDriveToken.mockResolvedValue('valid-token')
    mockExportAllAsJson.mockResolvedValue({
      schemaVersion: 14,
      exportedAt: new Date().toISOString(),
      data: {},
    })
    const uploadError = new Error('Unexpected upload failure')
    mockUploadBackupToDrive.mockRejectedValue(uploadError)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<DataAndBackupPanel />)

    await user.click(screen.getByTestId('send-to-drive-button'))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Drive upload error:', uploadError)
    })

    expect(toast.error).toHaveBeenCalledWith('Upload failed. Try again?')

    consoleSpy.mockRestore()
  })
})
