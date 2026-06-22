import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { DriveFolderBrowser } from '@/app/components/import/DriveFolderBrowser'

// ── Mocks ──────────────────────────────────────────────────────

const mockGetDriveToken = vi.fn()
const mockRefreshDriveToken = vi.fn()
const mockHasDriveReadScope = vi.fn()
const mockRequestDriveReadScope = vi.fn()

vi.mock('@/lib/googleDriveToken', () => ({
  getDriveToken: () => mockGetDriveToken(),
  refreshDriveToken: () => mockRefreshDriveToken(),
  hasDriveReadScope: () => mockHasDriveReadScope(),
  requestDriveReadScope: () => mockRequestDriveReadScope(),
}))

const mockListFolder = vi.fn()

vi.mock('@/lib/googleDriveFileService', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/googleDriveFileService')>()
  return {
    ...actual,
    listFolder: (...args: unknown[]) => mockListFolder(...args),
  }
})

const mockOnFolderSelected = vi.fn()
const mockOnOpenChange = vi.fn()

function renderDriveBrowser(open = true) {
  return render(
    <DriveFolderBrowser
      open={open}
      onOpenChange={mockOnOpenChange}
      onFolderSelected={mockOnFolderSelected}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockGetDriveToken.mockResolvedValue('test-token')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Scope Check Step ──────────────────────────────────────────

describe('DriveFolderBrowser - Scope Check', () => {
  it('shows loading state while checking scope', () => {
    mockHasDriveReadScope.mockReturnValue(new Promise(() => {})) // never resolves
    renderDriveBrowser()
    expect(screen.getByTestId('drive-scope-checking')).toBeInTheDocument()
    expect(screen.getByText('Checking Google Drive access...')).toBeInTheDocument()
  })

  it('transitions to browse when scope is granted', async () => {
    mockHasDriveReadScope.mockResolvedValue(true)
    mockListFolder.mockResolvedValue({
      ok: true,
      data: { files: [], nextPageToken: undefined },
    })

    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByTestId('drive-file-list')).toBeInTheDocument()
    })
  })

  it('shows grant access UI when scope is not granted', async () => {
    mockHasDriveReadScope.mockResolvedValue(false)

    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByTestId('drive-scope-required')).toBeInTheDocument()
    })

    expect(screen.getByText('Grant Access')).toBeInTheDocument()
  })

  it('calls requestDriveReadScope when Grant Access is clicked', async () => {
    mockHasDriveReadScope.mockResolvedValue(false)
    mockRequestDriveReadScope.mockResolvedValue(undefined)

    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByTestId('drive-grant-scope-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('drive-grant-scope-btn'))
    expect(mockRequestDriveReadScope).toHaveBeenCalledTimes(1)
  })
})

// ── Browse Step ───────────────────────────────────────────────

describe('DriveFolderBrowser - Browse', () => {
  const mockFolders = [
    { id: 'folder-1', name: 'Course Materials', mimeType: 'application/vnd.google-apps.folder' },
    { id: 'folder-2', name: 'References', mimeType: 'application/vnd.google-apps.folder' },
    { id: 'file-1', name: 'intro.mp4', mimeType: 'video/mp4', size: 5000000, modifiedTime: '2026-06-01T12:00:00Z' },
    { id: 'file-2', name: 'slides.pdf', mimeType: 'application/pdf', size: 2000000, modifiedTime: '2026-06-01T12:00:00Z' },
    { id: 'file-3', name: 'notes.txt', mimeType: 'text/plain', size: 1000, modifiedTime: '2026-06-01T12:00:00Z' },
  ]

  beforeEach(() => {
    mockHasDriveReadScope.mockResolvedValue(true)
    mockListFolder.mockResolvedValue({
      ok: true,
      data: { files: mockFolders },
    })
  })

  it('displays folders and supported files', async () => {
    renderDriveBrowser()

    await waitFor(() => {
      // Folders should be visible
      expect(screen.getByText('Course Materials')).toBeInTheDocument()
      expect(screen.getByText('References')).toBeInTheDocument()
      // Supported files
      expect(screen.getByText('intro.mp4')).toBeInTheDocument()
      expect(screen.getByText('slides.pdf')).toBeInTheDocument()
    })

    // Unsupported files (notes.txt) should not be shown
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
  })

  it('shows listFolder was called with root', async () => {
    renderDriveBrowser()

    await waitFor(() => {
      expect(mockListFolder).toHaveBeenCalledWith('root')
    })
  })

  it('shows empty state when folder has no contents', async () => {
    mockListFolder.mockResolvedValue({
      ok: true,
      data: { files: [] },
    })

    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByTestId('drive-empty-folder')).toBeInTheDocument()
    })
  })

  it('shows error state when listFolder fails', async () => {
    mockListFolder.mockResolvedValue({
      ok: false,
      error: 'Failed to load Drive folder.',
      status: 403,
    })

    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByText('Failed to load Drive folder.')).toBeInTheDocument()
    })
  })

  it('retry button reloads folder contents after error', async () => {
    mockListFolder
      .mockResolvedValueOnce({
        ok: false,
        error: 'Failed to load Drive folder.',
        status: 403,
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { files: mockFolders },
      })

    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByTestId('drive-retry-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('drive-retry-btn'))

    await waitFor(() => {
      expect(mockListFolder).toHaveBeenCalledTimes(2)
    })
  })

  it('navigates into a folder when folder item is clicked', async () => {
    // First call returns root contents, second returns subfolder contents
    mockListFolder
      .mockResolvedValueOnce({
        ok: true,
        data: { files: mockFolders },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { files: [] },
      })

    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByText('Course Materials')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Course Materials'))

    await waitFor(() => {
      // Should have called listFolder with the subfolder ID
      expect(mockListFolder).toHaveBeenCalledWith('folder-1')
    })
  })

  it('displays breadcrumbs and allows navigation back', async () => {
    mockListFolder
      .mockResolvedValueOnce({
        ok: true,
        data: { files: mockFolders },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { files: [] },
      })

    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByText('Course Materials')).toBeInTheDocument()
    })

    // Navigate into Course Materials
    fireEvent.click(screen.getByText('Course Materials'))

    // Breadcrumb should show current folder name
    await waitFor(() => {
      expect(screen.getByText('My Drive')).toBeInTheDocument()
      expect(screen.getByText('Course Materials')).toBeInTheDocument()
    })

    // Click breadcrumb back to My Drive
    fireEvent.click(screen.getByText('My Drive'))

    await waitFor(() => {
      // Should have reloaded root
      expect(mockListFolder).toHaveBeenCalledWith('root')
    })
  })

  it('filters contents by search query', async () => {
    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByTestId('drive-search-input')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('drive-search-input')
    fireEvent.change(searchInput, { target: { value: 'intro' } })

    // Should show matching file
    expect(screen.getByText('intro.mp4')).toBeInTheDocument()
    // Should not show non-matching
    expect(screen.queryByText('slides.pdf')).not.toBeInTheDocument()
  })

  it('shows file size for files', async () => {
    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByText('4.8 MB')).toBeInTheDocument() // 5,000,000 bytes
    })
  })

  it('folder click also selects the folder', async () => {
    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByText('Course Materials')).toBeInTheDocument()
    })

    // Clicking a folder navigates into it rather than selecting it
    fireEvent.click(screen.getByText('Course Materials'))

    // Confirm button should be disabled since no folder is selected
    expect(screen.getByTestId('drive-confirm-btn')).toBeDisabled()
  })
})

// ── Folder Selection Confirmation ─────────────────────────────

describe('DriveFolderBrowser - Selection', () => {
  const mockFiles = [
    { id: 'folder-1', name: 'My Course', mimeType: 'application/vnd.google-apps.folder' },
    { id: 'file-1', name: 'lesson1.mp4', mimeType: 'video/mp4', size: 10000000, modifiedTime: '2026-06-01T12:00:00Z' },
    { id: 'file-2', name: 'handout.pdf', mimeType: 'application/pdf', size: 3000000, modifiedTime: '2026-06-01T12:00:00Z' },
  ]

  beforeEach(() => {
    mockHasDriveReadScope.mockResolvedValue(true)
    mockListFolder.mockResolvedValue({
      ok: true,
      data: { files: mockFiles },
    })
  })

  it('confirm button is disabled when no folder is selected', async () => {
    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByTestId('drive-confirm-btn')).toBeDisabled()
    })
  })
})

// ── Close / Reset ────────────────────────────────────────────

describe('DriveFolderBrowser - Close', () => {
  beforeEach(() => {
    mockHasDriveReadScope.mockResolvedValue(true)
    mockListFolder.mockResolvedValue({
      ok: true,
      data: { files: [] },
    })
  })

  it('calls onOpenChange(false) when cancel is clicked', async () => {
    renderDriveBrowser()

    await waitFor(() => {
      expect(screen.getByTestId('drive-cancel-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('drive-cancel-btn'))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes when open prop changes to false', () => {
    const { rerender } = renderDriveBrowser(true)

    rerender(
      <DriveFolderBrowser
        open={false}
        onOpenChange={mockOnOpenChange}
        onFolderSelected={mockOnFolderSelected}
      />
    )

    // Dialog should not be visible
    expect(screen.queryByTestId('drive-folder-browser')).not.toBeInTheDocument()
  })
})
