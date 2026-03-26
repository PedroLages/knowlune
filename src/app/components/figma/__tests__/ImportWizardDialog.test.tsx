import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
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

const mockAISuggestions = {
  isAvailable: false,
  isLoading: false,
  suggestedTags: [] as string[],
  suggestedDescription: '',
  hasFetched: false,
}

vi.mock('@/ai/hooks/useAISuggestions', () => ({
  useAISuggestions: () => mockAISuggestions,
}))

const mockImportStoreState = {
  isImporting: false,
  importError: null,
  importProgress: null,
  importedCourses: [],
  setImporting: vi.fn(),
  setImportError: vi.fn(),
  setImportProgress: vi.fn(),
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector?: (state: typeof mockImportStoreState) => unknown) =>
      selector ? selector(mockImportStoreState) : mockImportStoreState,
    {
      getState: () => mockImportStoreState,
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    }
  ),
}))

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        paths: [],
        entries: [],
        activePath: null,
        isGenerating: false,
        error: null,
        loadPaths: vi.fn(),
        addCourseToPath: vi.fn(),
        createPath: vi.fn(),
      }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({
        paths: [],
        loadPaths: vi.fn(),
        addCourseToPath: vi.fn(),
        createPath: vi.fn(),
      }),
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    }
  ),
}))

vi.mock('@/ai/hooks/usePathPlacementSuggestion', () => ({
  usePathPlacementSuggestion: () => ({
    suggestion: null,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/ai/learningPath/suggestPlacement', () => ({
  isPathPlacementAvailable: () => false,
}))

function makeMockFileHandle(name: string): FileSystemFileHandle {
  return {
    name,
    getFile: vi.fn().mockResolvedValue(new File([''], name)),
  } as unknown as FileSystemFileHandle
}

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
        fileSize: 50_000_000,
        width: 1920,
        height: 1080,
      },
      {
        id: 'v2',
        filename: 'lesson2.mp4',
        path: '/lesson2.mp4',
        duration: 600,
        format: 'mp4',
        order: 2,
        fileHandle: {} as FileSystemFileHandle,
        fileSize: 100_000_000,
        width: 1920,
        height: 1080,
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
    images: [],
    ...overrides,
  }
}

describe('ImportWizardDialog', () => {
  // Suppress Radix UI aria-describedby warning — the component provides
  // both aria-describedby and DialogDescription, but Radix emits a console
  // warning during the render cycle before DialogDescription mounts.
  const originalWarn = console.warn
  beforeAll(() => {
    console.warn = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (msg.includes('aria-describedby')) return
      originalWarn(...args)
    }
  })
  afterAll(() => {
    console.warn = originalWarn
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock URL.createObjectURL / revokeObjectURL for image previews
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
    // Reset AI suggestions mock to defaults
    mockAISuggestions.isAvailable = false
    mockAISuggestions.isLoading = false
    mockAISuggestions.suggestedTags = []
    mockAISuggestions.suggestedDescription = ''
    mockAISuggestions.hasFetched = false
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
          fileSize: 50_000_000,
          width: 1920,
          height: 1080,
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

  // --- Tag management tests ---

  it('shows tag input section on details step', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-tags-section')).toBeInTheDocument()
    })
    expect(screen.getByTestId('wizard-tag-input')).toBeInTheDocument()
  })

  it('adds a tag when Enter is pressed', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-tag-input')).toBeInTheDocument()
    })

    const tagInput = screen.getByTestId('wizard-tag-input')
    await user.type(tagInput, 'react{Enter}')

    expect(screen.getByTestId('wizard-tag-react')).toBeInTheDocument()
    expect(screen.getByTestId('wizard-tag-react')).toHaveTextContent('react')
  })

  it('does not add duplicate tags', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-tag-input')).toBeInTheDocument()
    })

    const tagInput = screen.getByTestId('wizard-tag-input')
    await user.type(tagInput, 'react{Enter}')
    await user.type(tagInput, 'react{Enter}')

    // Should only have one tag badge (the Badge component with data-slot="badge")
    const tagSection = screen.getByTestId('wizard-tags-section')
    const badges = tagSection.querySelectorAll('[data-slot="badge"]')
    expect(badges).toHaveLength(1)
  })

  it('removes a tag when X is clicked', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-tag-input')).toBeInTheDocument()
    })

    const tagInput = screen.getByTestId('wizard-tag-input')
    await user.type(tagInput, 'react{Enter}')
    expect(screen.getByTestId('wizard-tag-react')).toBeInTheDocument()

    await user.click(screen.getByTestId('wizard-remove-tag-react'))
    expect(screen.queryByTestId('wizard-tag-react')).not.toBeInTheDocument()
  })

  it('removes last tag on Backspace when input is empty', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-tag-input')).toBeInTheDocument()
    })

    const tagInput = screen.getByTestId('wizard-tag-input')
    await user.type(tagInput, 'react{Enter}')
    await user.type(tagInput, 'typescript{Enter}')

    expect(screen.getByTestId('wizard-tag-react')).toBeInTheDocument()
    expect(screen.getByTestId('wizard-tag-typescript')).toBeInTheDocument()

    // Focus the input and press Backspace
    await user.click(tagInput)
    await user.keyboard('{Backspace}')

    expect(screen.getByTestId('wizard-tag-react')).toBeInTheDocument()
    expect(screen.queryByTestId('wizard-tag-typescript')).not.toBeInTheDocument()
  })

  it('passes tags to persistScannedCourse', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockScanCourseFolder.mockResolvedValueOnce(scanned)
    mockPersistScannedCourse.mockResolvedValueOnce({
      ...scanned,
      importedAt: '2026-03-25T10:00:00.000Z',
      category: '',
      tags: ['react', 'frontend'],
      status: 'active',
      videoCount: 2,
      pdfCount: 1,
    })

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-tag-input')).toBeInTheDocument()
    })

    const tagInput = screen.getByTestId('wizard-tag-input')
    await user.type(tagInput, 'react{Enter}')
    await user.type(tagInput, 'frontend{Enter}')

    await user.click(screen.getByTestId('wizard-import-btn'))

    await waitFor(() => {
      expect(mockPersistScannedCourse).toHaveBeenCalledWith(scanned, {
        tags: ['react', 'frontend'],
      })
    })
  })

  it('shows tag count in summary', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-tag-input')).toBeInTheDocument()
    })

    const tagInput = screen.getByTestId('wizard-tag-input')
    await user.type(tagInput, 'react{Enter}')
    await user.type(tagInput, 'frontend{Enter}')

    expect(screen.getByTestId('wizard-tag-count')).toHaveTextContent('2 tags')
  })

  // --- Cover image tests ---

  it('shows no-images placeholder when no images found', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse({ images: [] }))

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-no-images')).toBeInTheDocument()
    })
    expect(screen.getByText(/no images found in folder/i)).toBeInTheDocument()
  })

  it('shows image grid when images are found', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse({
      images: [
        { filename: 'cover.jpg', path: '/cover.jpg', fileHandle: makeMockFileHandle('cover.jpg') },
        {
          filename: 'banner.png',
          path: '/banner.png',
          fileHandle: makeMockFileHandle('banner.png'),
        },
      ],
    })
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-image-grid')).toBeInTheDocument()
    })

    expect(screen.getByTestId('wizard-image-option-cover.jpg')).toBeInTheDocument()
    expect(screen.getByTestId('wizard-image-option-banner.png')).toBeInTheDocument()
  })

  it('shows image count in summary when images exist', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse({
      images: [
        { filename: 'cover.jpg', path: '/cover.jpg', fileHandle: makeMockFileHandle('cover.jpg') },
      ],
    })
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-image-count')).toBeInTheDocument()
    })
    expect(screen.getByTestId('wizard-image-count')).toHaveTextContent('1 image')
  })

  it('passes coverImageHandle to persistScannedCourse when image selected', async () => {
    const user = userEvent.setup()
    const coverHandle = makeMockFileHandle('cover.jpg')
    const scanned = makeScannedCourse({
      images: [{ filename: 'cover.jpg', path: '/cover.jpg', fileHandle: coverHandle }],
    })
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
      expect(screen.getByTestId('wizard-image-grid')).toBeInTheDocument()
    })

    // The first image is auto-selected, so just import directly
    await user.click(screen.getByTestId('wizard-import-btn'))

    await waitFor(() => {
      expect(mockPersistScannedCourse).toHaveBeenCalledWith(scanned, {
        coverImageHandle: coverHandle,
      })
    })
  })

  it('shows cover selected info in summary when image chosen', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse({
      images: [
        { filename: 'cover.jpg', path: '/cover.jpg', fileHandle: makeMockFileHandle('cover.jpg') },
      ],
    })
    mockScanCourseFolder.mockResolvedValueOnce(scanned)

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    // Auto-selects first image
    await waitFor(() => {
      expect(screen.getByTestId('wizard-cover-selected')).toBeInTheDocument()
    })
    expect(screen.getByTestId('wizard-cover-selected')).toHaveTextContent('Cover: cover.jpg')
  })

  // --- AI suggestions tests ---

  it('shows AI loading indicator when Ollama is available and loading', async () => {
    const user = userEvent.setup()
    mockAISuggestions.isAvailable = true
    mockAISuggestions.isLoading = true
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-ai-loading')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/AI is generating tag and description suggestions/i)
    ).toBeInTheDocument()
  })

  it('does not show AI loading indicator when Ollama is not available', async () => {
    const user = userEvent.setup()
    mockAISuggestions.isAvailable = false
    mockAISuggestions.isLoading = false
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-details-step')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('wizard-ai-loading')).not.toBeInTheDocument()
  })

  it('shows AI-suggested tags with sparkle badge when suggestions arrive', async () => {
    const user = userEvent.setup()
    mockAISuggestions.isAvailable = true
    mockAISuggestions.isLoading = false
    mockAISuggestions.suggestedTags = ['react', 'typescript']
    mockAISuggestions.hasFetched = true
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    // AI tags get auto-applied via the useEffect
    await waitFor(() => {
      expect(screen.getByTestId('wizard-tag-react')).toBeInTheDocument()
      expect(screen.getByTestId('wizard-tag-typescript')).toBeInTheDocument()
    })

    // Should show AI Suggested badge on the tags section
    expect(screen.getByTestId('wizard-ai-tags-badge')).toBeInTheDocument()
    expect(screen.getByTestId('wizard-ai-tags-badge')).toHaveTextContent('AI Suggested')
  })

  it('shows description field on details step', async () => {
    const user = userEvent.setup()
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-description-section')).toBeInTheDocument()
    })
    expect(screen.getByTestId('wizard-description-input')).toBeInTheDocument()
  })

  it('shows AI Suggested badge on description when AI provides one', async () => {
    const user = userEvent.setup()
    mockAISuggestions.isAvailable = true
    mockAISuggestions.isLoading = false
    mockAISuggestions.suggestedDescription = 'A course about React and TypeScript.'
    mockAISuggestions.hasFetched = true
    mockScanCourseFolder.mockResolvedValueOnce(makeScannedCourse())

    render(<ImportWizardDialog open={true} onOpenChange={vi.fn()} />)
    await user.click(screen.getByTestId('wizard-select-folder-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('wizard-description-input')).toHaveValue(
        'A course about React and TypeScript.'
      )
    })
    expect(screen.getByTestId('wizard-ai-description-badge')).toBeInTheDocument()
  })

  it('passes description to persistScannedCourse on import', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockAISuggestions.isAvailable = true
    mockAISuggestions.isLoading = false
    mockAISuggestions.suggestedDescription = 'AI generated description'
    mockAISuggestions.hasFetched = true
    mockScanCourseFolder.mockResolvedValueOnce(scanned)
    mockPersistScannedCourse.mockResolvedValueOnce({
      ...scanned,
      description: 'AI generated description',
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
      expect(screen.getByTestId('wizard-description-input')).toHaveValue('AI generated description')
    })

    await user.click(screen.getByTestId('wizard-import-btn'))

    await waitFor(() => {
      expect(mockPersistScannedCourse).toHaveBeenCalledWith(scanned, {
        description: 'AI generated description',
      })
    })
  })

  it('works without AI when Ollama is not configured', async () => {
    const user = userEvent.setup()
    const scanned = makeScannedCourse()
    mockAISuggestions.isAvailable = false
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

    // No AI indicators
    expect(screen.queryByTestId('wizard-ai-loading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wizard-ai-tags-badge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wizard-ai-description-badge')).not.toBeInTheDocument()

    // Import should still work
    await user.click(screen.getByTestId('wizard-import-btn'))
    await waitFor(() => {
      expect(mockPersistScannedCourse).toHaveBeenCalledWith(scanned, undefined)
    })
  })
})
