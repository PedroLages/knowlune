/**
 * MaterialsTab — Unit tests for inline PDF collapsible sections.
 *
 * Verifies:
 * - Loading state
 * - Empty state when no PDFs
 * - Collapsible section rendering with filenames and page counts
 * - Document count display
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

// Mock courseAdapter
vi.mock('@/lib/courseAdapter', () => ({
  revokeObjectUrl: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { MaterialsTab } from '../tabs/MaterialsTab'

function renderMaterials(lessonId = 'pdf-1') {
  return render(
    <MemoryRouter>
      <MaterialsTab courseId="course-1" lessonId={lessonId} />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const mockPdfs = [
  {
    id: 'pdf-1',
    courseId: 'course-1',
    filename: 'Chapter1.pdf',
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

describe('MaterialsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToArray.mockResolvedValue(mockPdfs)
  })

  it('renders the materials tab', async () => {
    renderMaterials()
    await waitFor(() => {
      expect(screen.getByTestId('materials-tab')).toBeInTheDocument()
    })
  })

  it('shows document count', async () => {
    renderMaterials()
    await waitFor(() => {
      expect(screen.getByText('2 documents')).toBeInTheDocument()
    })
  })

  it('renders PDF filenames without extension', async () => {
    renderMaterials()
    await waitFor(() => {
      expect(screen.getByText('Chapter1')).toBeInTheDocument()
      expect(screen.getByText('Resources')).toBeInTheDocument()
    })
  })

  it('shows page count badges', async () => {
    renderMaterials()
    await waitFor(() => {
      expect(screen.getByText('12 pages')).toBeInTheDocument()
      expect(screen.getByText('3 pages')).toBeInTheDocument()
    })
  })

  it('renders collapsible entries', async () => {
    renderMaterials()
    await waitFor(() => {
      const entries = screen.getAllByTestId('materials-entry')
      expect(entries).toHaveLength(2)
    })
  })

  it('sections are collapsed by default', async () => {
    renderMaterials()
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { expanded: false })
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows empty state when no PDFs', async () => {
    mockToArray.mockResolvedValue([])
    renderMaterials()
    await waitFor(() => {
      expect(screen.getByText('No materials')).toBeInTheDocument()
    })
  })

  it('shows singular document count for one PDF', async () => {
    mockToArray.mockResolvedValue([mockPdfs[0]])
    renderMaterials()
    await waitFor(() => {
      expect(screen.getByText('1 document')).toBeInTheDocument()
    })
  })
})
