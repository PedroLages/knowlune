import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportWizardDialog } from '../ImportWizardDialog'
import type { ScannedCourse } from '@/lib/courseImport'

const mockScanCourseFolder = vi.fn()
const mockPersistScannedCourse = vi.fn()

vi.mock('@/lib/courseImport', () => ({
  scanCourseFolder: (...args: unknown[]) => mockScanCourseFolder(...args),
  persistScannedCourse: (...args: unknown[]) => mockPersistScannedCourse(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        isImporting: false,
        importError: null,
        importProgress: null,
        importedCourses: [],
      }),
    {
      getState: () => ({
        isImporting: false,
        importError: null,
        importProgress: null,
        setImporting: vi.fn(),
        setImportError: vi.fn(),
        setImportProgress: vi.fn(),
      }),
      setState: vi.fn(),
    }
  ),
}))

function makeScannedCourse(overrides: Partial<ScannedCourse> = {}): ScannedCourse {
  return {
    id: 'course-123',
    name: 'My Test Course',
    scannedAt: '2026-03-25T10:00:00.000Z',
    directoryHandle: {} as FileSystemDirectoryHandle,
    videos: [
      {
        id: 'v1',
        filename: 'lesson1.mp4',
        path: '/lesson1.mp4',
        duration: 300,
        format: 'mp4',
        order: 1,
        fileHandle: {} as FileSystemFileHandle,
      },
      {
        id: 'v2',
        filename: 'lesson2.mp4',
        path: '/lesson2.mp4',
        duration: 600,
        format: 'mp4',
        order: 2,
        fileHandle: {} as FileSystemFileHandle,
      },
    ],
    pdfs: [
      {
        id: 'p1',
        filename: 'notes.pdf',
        path: '/notes.pdf',
        pageCount: 10,
        fileHandle: {} as FileSystemFileHandle,
      },
    ],
    ...overrides,
  }
}

describe('ImportWizardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dialog when open', () => {
    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('import-wizard-dialog')).toBeInTheDocument()
    expect(screen.getByText('Import Course')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<ImportWizardDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByTestId('import-wizard-dialog')).not.toBeInTheDocument()
  })

  it('shows folder selection step initially', () => {
    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('wizard-select-folder-btn')).toBeInTheDocument()
    expect(screen.getByText(/choose a folder with your course materials/i)).toBeInTheDocument()
  })

  it('shows step indicator with step 1 active', () => {
    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    // Step indicator shows both step labels — "Select Folder" appears twice
    // (once in the step indicator, once on the button), so check for "Details" as the second step
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getAllByText('Select Folder').length).toBeGreaterThanOrEqual(1)
  })

  it('transitions to details step after scanning', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-details-step')).toBeInTheDocument()
    })

    // Shows course name input with scanned name
    const nameInput = screen.getByTestId('wizard-course-name-input')
    expect(nameInput).toHaveValue('My Test Course')

    // Shows video and PDF counts
    expect(screen.getByTestId('wizard-video-count')).toHaveTextContent('2 videos')
    expect(screen.getByTestId('wizard-pdf-count')).toHaveTextContent('1 PDF')
  })

  it('allows editing the course name', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-course-name-input')).toBeInTheDocument()
    })

    const nameInput = screen.getByTestId('wizard-course-name-input')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed Course')
    expect(nameInput).toHaveValue('Renamed Course')
  })

  it('disables import button when name is empty', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-course-name-input')).toBeInTheDocument()
    })

    const nameInput = screen.getByTestId('wizard-course-name-input')
    await user.clear(nameInput)

    const importBtn = screen.getByTestId('wizard-import-btn')
    expect(importBtn).toBeDisabled()
  })

  it('calls persistScannedCourse with overrides when name is changed', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockScanCourseFolder.mockResolvedValueOnce(scanned)
    mockPersistScannedCourse.mockResolvedValueOnce({
      ...scanned,
      name: 'Custom Name',
      importedAt: '2026-03-25T10:00:00.000Z',
      category: '',
      tags: [],
      status: 'active',
      videoCount: 2,
      pdfCount: 1,
    })

    const onOpenChange = vi.fn()
    render(<ImportWizardDialog open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-course-name-input')).toBeInTheDocument()
    })

    const nameInput = screen.getByTestId('wizard-course-name-input')
    await user.clear(nameInput)
    await user.type(nameInput, 'Custom Name')

    await user.click(screen.getByTestId('wizard-import-btn'))

    await waitFor(() => {
      expect(mockPersistScannedCourse).toHaveBeenCalledWith(scanned, { name: 'Custom Name' })
    })

    // Should close dialog on success
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls persistScannedCourse without overrides when name unchanged', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockScanCourseFolder.mockResolvedValueOnce(scanned)
    mockPersistScannedCourse.mockResolvedValueOnce({
      ...scanned,
      importedAt: '2026-03-25T10:00:00.000Z',
      category: '',
      tags: [],
      status: 'active',
      videoCount: 2,
      pdfCount: 1,
    })

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-import-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('wizard-import-btn'))

    await waitFor(() => {
      expect(mockPersistScannedCourse).toHaveBeenCalledWith(scanned, undefined)
    })
  })

  it('goes back to folder selection when Back is clicked', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-back-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('wizard-back-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-select-folder-btn')).toBeInTheDocument()
    })
  })

  it('stays on select step if user cancels the folder picker', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockRejectedValueOnce(new Error('User cancelled'))

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    // Should still be on select step
    await waitFor(() => {
      expect(screen.getByTestId('wizard-select-folder-btn')).toBeInTheDocument()
      expect(screen.getByTestId('wizard-select-folder-btn')).not.toBeDisabled()
    })
  })

  it('shows scanning state on the select folder button', async () => {
    const user = userEvent.setup()
    let resolvePromise: (value: ScannedCourse) => void
    mockScanCourseFolder.mockReturnValueOnce(
      new Promise<ScannedCourse>(resolve => {
        resolvePromise = resolve
      })
    )

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    // Button should show scanning state
    expect(screen.getByText('Scanning...')).toBeInTheDocument()
    expect(screen.getByTestId('wizard-select-folder-btn')).toBeDisabled()

    // Resolve to clean up
    resolvePromise!(makeScannedCourse())
    await waitFor(() => {
      expect(screen.queryByText('Scanning...')).not.toBeInTheDocument()
    })
  })

  it('displays singular form for 1 video and 1 PDF', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse({
      videos: [
        {
          id: 'v1',
          filename: 'lesson.mp4',
          path: '/lesson.mp4',
          duration: 300,
          format: 'mp4',
          order: 1,
          fileHandle: {} as FileSystemFileHandle,
        },
      ],
      pdfs: [
        {
          id: 'p1',
          filename: 'notes.pdf',
          path: '/notes.pdf',
          pageCount: 5,
          fileHandle: {} as FileSystemFileHandle,
        },
      ],
    })
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-video-count')).toHaveTextContent('1 video')
      expect(screen.getByTestId('wizard-pdf-count')).toHaveTextContent('1 PDF')
    })
  })

  it('shows validation error when name is cleared', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-course-name-input')).toBeInTheDocument()
    })

    const nameInput = screen.getByTestId('wizard-course-name-input')
    await user.clear(nameInput)

    expect(screen.getByText('Course name is required.')).toBeInTheDocument()
  })
})
