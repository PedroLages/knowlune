/**
 * MaterialsTab — Unit tests for inline PDF collapsible sections.
 *
 * Verifies:
 * - Loading state
 * - Empty state when no PDFs
 * - Lesson-scoped material display
 * - "Show all" fallback
 * - Document count display
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

// ---------------------------------------------------------------------------
// Mock Dexie
// ---------------------------------------------------------------------------

const mockToArray = vi.fn()

vi.mock('@/db/schema', () => ({
  db: {
    importedPdfs: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: (...args: unknown[]) => mockToArray(...args),
        }),
      }),
    },
    progress: {
      get: vi.fn().mockResolvedValue(null),
    },
  },
}))

// Mock PdfViewer to avoid pulling in pdf.js in tests
vi.mock('@/app/components/figma/PdfViewer', () => ({
  PdfViewer: ({ title }: { title?: string }) => <div data-testid="pdf-viewer">{title}</div>,
}))

// Mock courseAdapter — keep revokeObjectUrl mock but let real types through
vi.mock('@/lib/courseAdapter', async () => {
  const actual = await vi.importActual('@/lib/courseAdapter')
  return {
    ...actual,
    revokeObjectUrl: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { MaterialsTab } from '../tabs/MaterialsTab'
import type { CourseAdapter, MaterialGroup } from '@/lib/courseAdapter'

// ---------------------------------------------------------------------------
// Mock adapter factory
// ---------------------------------------------------------------------------

function makeMockAdapter(groups: MaterialGroup[]): CourseAdapter {
  return {
    getCourse: vi.fn() as unknown as CourseAdapter['getCourse'],
    getSource: vi.fn().mockReturnValue('local') as unknown as CourseAdapter['getSource'],
    getLessons: vi.fn().mockResolvedValue(groups.map(g => g.primary)),
    getGroupedLessons: vi.fn().mockResolvedValue(groups),
    getMediaUrl: vi.fn().mockResolvedValue(null),
    getTranscript: vi.fn().mockResolvedValue(null),
    getThumbnailUrl: vi.fn().mockResolvedValue(null),
    getCapabilities: vi.fn().mockReturnValue({
      hasVideo: true,
      hasPdf: true,
      hasTranscript: false,
      supportsNotes: true,
      supportsQuiz: false,
      supportsPrevNext: true,
      supportsBreadcrumbs: true,
      requiresNetwork: false,
      supportsRefresh: false,
      supportsFileVerification: false,
    }),
    getAuthorInfo: vi.fn().mockReturnValue(null),
    getChapterGrouping: vi.fn().mockReturnValue(null),
  }
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockPdfs = [
  {
    id: 'pdf-1',
    courseId: 'course-1',
    filename: '01-Chapter1.pdf',
    path: '/path/1',
    pageCount: 12,
    fileHandle: {},
  },
  {
    id: 'pdf-2',
    courseId: 'course-1',
    filename: 'Resources.pdf',
    path: '/path/2',
    pageCount: 3,
    fileHandle: {},
  },
]

// Groups where pdf-1 is companion to video-1, pdf-2 is standalone
const defaultGroups: MaterialGroup[] = [
  {
    primary: {
      id: 'video-1',
      title: '01-Chapter1.mp4',
      type: 'video',
      order: 1,
      duration: 300,
    },
    materials: [
      {
        id: 'pdf-1',
        title: '01-Chapter1.pdf',
        type: 'pdf',
        order: 1,
      },
    ],
  },
  {
    primary: {
      id: 'pdf-2',
      title: 'Resources.pdf',
      type: 'pdf',
      order: Infinity,
    },
    materials: [],
  },
]

function renderMaterials(lessonId = 'video-1', groups: MaterialGroup[] = defaultGroups) {
  const adapter = makeMockAdapter(groups)
  return render(
    <MemoryRouter>
      <MaterialsTab courseId="course-1" lessonId={lessonId} adapter={adapter} />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MaterialsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToArray.mockResolvedValue(mockPdfs)
  })

  it('renders the materials tab with lesson-scoped materials', async () => {
    renderMaterials('video-1')
    await waitFor(() => {
      expect(screen.getByTestId('materials-tab')).toBeInTheDocument()
    })
  })

  it('shows companion material count for current lesson', async () => {
    renderMaterials('video-1')
    await waitFor(() => {
      expect(screen.getByText('1 material for this lesson')).toBeInTheDocument()
    })
  })

  it('shows companion PDF filename without extension', async () => {
    renderMaterials('video-1')
    await waitFor(() => {
      expect(screen.getByText('01-Chapter1')).toBeInTheDocument()
    })
  })

  it('shows "View all" button when more PDFs exist', async () => {
    renderMaterials('video-1')
    await waitFor(() => {
      expect(screen.getByText('All (2)')).toBeInTheDocument()
    })
  })

  it('shows empty state with "view all" link when no companion materials', async () => {
    renderMaterials('pdf-2')
    await waitFor(() => {
      expect(screen.getByText('No materials for this lesson')).toBeInTheDocument()
      expect(screen.getByText('View all course materials (2)')).toBeInTheDocument()
    })
  })

  it('switches to all materials when "view all" is clicked', async () => {
    const user = userEvent.setup()
    renderMaterials('pdf-2')

    await waitFor(() => {
      expect(screen.getByText('View all course materials (2)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('View all course materials (2)'))

    await waitFor(() => {
      expect(screen.getByText('All course materials (2)')).toBeInTheDocument()
    })
  })

  it('shows empty state when no PDFs at all', async () => {
    mockToArray.mockResolvedValue([])
    renderMaterials()
    await waitFor(() => {
      expect(screen.getByText('No materials')).toBeInTheDocument()
    })
  })

  it('renders page count badges', async () => {
    renderMaterials('video-1')
    await waitFor(() => {
      expect(screen.getByText('12 pages')).toBeInTheDocument()
    })
  })

  it('shows loading skeletons while data is being fetched', async () => {
    let resolvePdfs!: (value: typeof mockPdfs) => void
    mockToArray.mockReturnValue(
      new Promise<typeof mockPdfs>(resolve => {
        resolvePdfs = resolve
      })
    )
    renderMaterials('video-1')

    // Skeletons should be visible while loading
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)

    // Resolve the deferred promise
    resolvePdfs(mockPdfs)

    // Content should appear after resolution
    await waitFor(() => {
      expect(screen.getByTestId('materials-tab')).toBeInTheDocument()
    })
  })

  it('"Show lesson only" returns to lesson-scoped view after "View all"', async () => {
    const user = userEvent.setup()
    renderMaterials('pdf-2')

    // Enter show-all mode
    await waitFor(() => {
      expect(screen.getByText('View all course materials (2)')).toBeInTheDocument()
    })
    await user.click(screen.getByText('View all course materials (2)'))

    await waitFor(() => {
      expect(screen.getByText('All course materials (2)')).toBeInTheDocument()
    })

    // Click "Show lesson only" to return
    await user.click(screen.getByText('Show lesson only'))

    await waitFor(() => {
      expect(screen.getByText('No materials for this lesson')).toBeInTheDocument()
    })
  })

  it('shows singular "1 page" badge for single-page PDF', async () => {
    const singlePagePdfs = [
      {
        id: 'pdf-single',
        courseId: 'course-1',
        filename: 'OnePager.pdf',
        path: '/path/single',
        pageCount: 1,
        fileHandle: {},
      },
    ]
    const singlePageGroups: MaterialGroup[] = [
      {
        primary: {
          id: 'video-1',
          title: '01-Chapter1.mp4',
          type: 'video',
          order: 1,
          duration: 300,
        },
        materials: [{ id: 'pdf-single', title: 'OnePager.pdf', type: 'pdf', order: 1 }],
      },
    ]
    mockToArray.mockResolvedValue(singlePagePdfs)
    renderMaterials('video-1', singlePageGroups)
    await waitFor(() => {
      expect(screen.getByText('1 page')).toBeInTheDocument()
    })
    // Ensure it does NOT say "1 pages"
    expect(screen.queryByText('1 pages')).not.toBeInTheDocument()
  })
})
