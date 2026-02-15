import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Courses } from '../Courses'
import type { ImportedCourse } from '@/data/types'

const mockCourses: ImportedCourse[] = [
  {
    id: 'c1',
    name: 'Older Course',
    importedAt: '2026-01-01T00:00:00Z',
    category: 'general',
    tags: ['alpha'],
    videoCount: 3,
    pdfCount: 1,
    directoryHandle: {} as FileSystemDirectoryHandle,
  },
  {
    id: 'c2',
    name: 'Newer Course',
    importedAt: '2026-02-10T00:00:00Z',
    category: 'general',
    tags: ['beta'],
    videoCount: 7,
    pdfCount: 2,
    directoryHandle: {} as FileSystemDirectoryHandle,
  },
]

const storeState = {
  importedCourses: [] as ImportedCourse[],
  isImporting: false,
  importError: null as string | null,
  importProgress: null,
  addImportedCourse: vi.fn(),
  removeImportedCourse: vi.fn(),
  loadImportedCourses: vi.fn(),
  setImporting: vi.fn(),
  setImportError: vi.fn(),
  setImportProgress: vi.fn(),
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}))

vi.mock('@/lib/courseImport', () => ({
  importCourseFromFolder: vi.fn(),
}))

vi.mock('@/lib/progress', () => ({
  getCourseCompletionPercent: () => 0,
}))

function renderCourses() {
  return render(
    <MemoryRouter>
      <Courses />
    </MemoryRouter>
  )
}

describe('Courses page', () => {
  beforeEach(() => {
    storeState.importedCourses = []
    storeState.loadImportedCourses = vi.fn()
  })

  describe('empty state', () => {
    it('displays empty state when no imported courses', () => {
      renderCourses()
      expect(screen.getByText('Import your first course to get started')).toBeInTheDocument()
      expect(screen.getByText('Import Your First Course')).toBeInTheDocument()
    })

    it('empty state card uses rounded-[24px]', () => {
      const { container } = renderCourses()
      const emptyCard = container.querySelector('[role="region"][aria-label="Import courses"]')
      expect(emptyCard).toBeInTheDocument()
      expect(emptyCard).toHaveClass('rounded-[24px]')
    })
  })

  describe('with imported courses', () => {
    beforeEach(() => {
      storeState.importedCourses = mockCourses
    })

    it('renders imported course cards', () => {
      renderCourses()
      expect(screen.getByText('Older Course')).toBeInTheDocument()
      expect(screen.getByText('Newer Course')).toBeInTheDocument()
    })

    it('sorts courses by most recently imported (newest first)', () => {
      renderCourses()
      const headings = screen.getAllByRole('heading', { level: 3 })
      const importedHeadings = headings.filter(
        h => h.textContent === 'Newer Course' || h.textContent === 'Older Course'
      )
      expect(importedHeadings[0]).toHaveTextContent('Newer Course')
      expect(importedHeadings[1]).toHaveTextContent('Older Course')
    })

    it('uses 4-column grid on imported courses section', () => {
      const { container } = renderCourses()
      const grid = container.querySelector('.lg\\:grid-cols-4')
      expect(grid).toBeInTheDocument()
    })
  })
})
