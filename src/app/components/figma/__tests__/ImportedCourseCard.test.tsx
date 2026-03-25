import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ImportedCourseCard } from '../ImportedCourseCard'
import type { ImportedCourse } from '@/data/types'

const mockUpdateCourseTags = vi.fn()
const mockUpdateCourseStatus = vi.fn()
const mockUpdateCourseDetails = vi.fn().mockResolvedValue(undefined)
const mockRemoveImportedCourse = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        updateCourseTags: mockUpdateCourseTags,
        updateCourseStatus: mockUpdateCourseStatus,
        updateCourseDetails: mockUpdateCourseDetails,
        removeImportedCourse: mockRemoveImportedCourse,
        thumbnailUrls: {},
        autoAnalysisStatus: {},
      }),
    {
      getState: () => ({ importError: null }),
    }
  ),
}))

vi.mock('@/hooks/useCourseCardPreview', () => ({
  useCourseCardPreview: () => ({
    showPreview: false,
    videoReady: false,
    setVideoReady: vi.fn(),
    previewHandlers: {},
    previewOpen: false,
    setPreviewOpen: vi.fn(),
    infoOpen: false,
    setInfoOpen: vi.fn(),
    guardNavigation: vi.fn(),
  }),
}))

vi.mock('@/hooks/useVideoFromHandle', () => ({
  useVideoFromHandle: () => ({ blobUrl: null, error: null, loading: false }),
}))

vi.mock('@/db/schema', () => ({
  db: {
    importedVideos: {
      where: () => ({
        equals: () => ({
          sortBy: () => Promise.resolve([]),
        }),
      }),
    },
  },
}))

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'Test Course',
    importedAt: '2026-02-10T10:00:00Z',
    category: 'general',
    tags: ['test'],
    status: 'active',
    videoCount: 5,
    pdfCount: 3,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

function renderCard(overrides: Partial<ImportedCourse> = {}, allTags: string[] = []) {
  return render(
    <MemoryRouter>
      <ImportedCourseCard course={makeCourse(overrides)} allTags={allTags} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockUpdateCourseTags.mockClear()
  mockUpdateCourseStatus.mockClear()
})

describe('ImportedCourseCard', () => {
  it('renders course title', () => {
    renderCard()
    expect(screen.getByText('Test Course')).toBeInTheDocument()
  })

  it('renders video count', () => {
    renderCard({ videoCount: 12 })
    expect(screen.getByText('12 videos')).toBeInTheDocument()
  })

  it('renders PDF count', () => {
    renderCard({ pdfCount: 7 })
    expect(screen.getByText('7 PDFs')).toBeInTheDocument()
  })

  it('renders import date', () => {
    renderCard({ importedAt: '2026-02-10T10:00:00Z' })
    expect(screen.getByText(/Imported/)).toBeInTheDocument()
  })

  it('has accessible article with aria-label', () => {
    renderCard({ name: 'My Course', videoCount: 3, pdfCount: 2 })
    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('aria-label', 'My Course — 3 videos, 2 PDFs')
  })

  it('uses rounded-[24px] border radius', () => {
    const { container } = renderCard()
    const card = container.querySelector('.rounded-\\[24px\\]')
    expect(card).toBeInTheDocument()
  })

  it('has elevated hover shadow', () => {
    const { container } = renderCard()
    const shadow = container.querySelector('.hover\\:shadow-2xl')
    expect(shadow).toBeInTheDocument()
  })

  it('has hover scale effect', () => {
    const { container } = renderCard()
    const scaled = container.querySelector('.hover\\:\\[transform\\:scale\\(1\\.02\\)\\]')
    expect(scaled).toBeInTheDocument()
  })

  it('has group-hover title color change', () => {
    const { container } = renderCard()
    const title = container.querySelector('.group-hover\\:text-brand')
    expect(title).toBeInTheDocument()
  })

  it('is keyboard-focusable with focus ring', () => {
    const { container } = renderCard()
    const focusable = container.querySelector('[tabindex="0"]')
    expect(focusable).toBeInTheDocument()
    expect(focusable).toHaveClass('focus-visible:ring-2')
  })

  it('respects prefers-reduced-motion', () => {
    const { container } = renderCard()
    const motionSafe = container.querySelector(
      '.motion-reduce\\:hover\\:\\[transform\\:scale\\(1\\)\\]'
    )
    expect(motionSafe).toBeInTheDocument()
  })

  it('uses singular form for count of 1', () => {
    renderCard({ videoCount: 1, pdfCount: 1 })
    expect(screen.getByText('1 video')).toBeInTheDocument()
    expect(screen.getByText('1 PDF')).toBeInTheDocument()
    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('aria-label', 'Test Course — 1 video, 1 PDF')
  })

  it('marks icons as aria-hidden', () => {
    const { container } = renderCard()
    const hiddenIcons = container.querySelectorAll('[aria-hidden="true"]')
    expect(hiddenIcons.length).toBeGreaterThanOrEqual(2)
  })

  describe('status badge', () => {
    it('renders Active badge for active course', () => {
      renderCard({ status: 'active' })
      expect(screen.getByTestId('status-badge')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders Completed badge for completed course', () => {
      renderCard({ status: 'completed' })
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('renders Paused badge for paused course', () => {
      renderCard({ status: 'paused' })
      expect(screen.getByText('Paused')).toBeInTheDocument()
    })

    it('uses correct color classes for each status (AC-1.3)', () => {
      const { container, rerender } = renderCard({ status: 'active' })
      // Badge component is nested inside the button with testid
      // ImportedCourseCard uses lighter variants (bg-blue-100), StatusFilter uses darker (bg-blue-600)
      let badgeEl = container.querySelector('[data-testid="status-badge"] > span')
      expect(badgeEl?.className).toMatch(/bg-blue-100/)
      expect(badgeEl?.className).toMatch(/text-blue-700/)

      rerender(
        <MemoryRouter>
          <ImportedCourseCard course={makeCourse({ status: 'completed' })} allTags={[]} />
        </MemoryRouter>
      )
      badgeEl = container.querySelector('[data-testid="status-badge"] > span')
      expect(badgeEl?.className).toMatch(/bg-green-100/)
      expect(badgeEl?.className).toMatch(/text-green-700/)

      rerender(
        <MemoryRouter>
          <ImportedCourseCard course={makeCourse({ status: 'paused' })} allTags={[]} />
        </MemoryRouter>
      )
      badgeEl = container.querySelector('[data-testid="status-badge"] > span')
      expect(badgeEl?.className).toMatch(/bg-gray-100/)
      expect(badgeEl?.className).toMatch(/text-gray-400/)
    })

    it('has descriptive aria-label on status badge', () => {
      renderCard({ status: 'active' })
      const badge = screen.getByTestId('status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Course status: Active. Click to change.')
    })
  })

  describe('E22-S04 AC5: AI-generated tag editing/removal', () => {
    it('renders AI-generated tags on the course card', () => {
      renderCard({ tags: ['Python', 'Machine Learning', 'Data Science'] })
      const tagContainer = screen.getByTestId('course-card-tags')
      expect(tagContainer).toBeInTheDocument()
      expect(screen.getByText('Python')).toBeInTheDocument()
      expect(screen.getByText('Machine Learning')).toBeInTheDocument()
      expect(screen.getByText('Data Science')).toBeInTheDocument()
    })

    it('renders remove buttons on tag badges', () => {
      renderCard({ tags: ['Python', 'AI'] })
      const removeButtons = screen.getAllByRole('button', { name: /Remove tag:/ })
      expect(removeButtons.length).toBe(2)
      expect(screen.getByRole('button', { name: 'Remove tag: Python' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remove tag: AI' })).toBeInTheDocument()
    })

    it('calls updateCourseTags without the removed tag when X is clicked', async () => {
      const user = userEvent.setup()
      renderCard({ id: 'c1', tags: ['Python', 'AI', 'Web'] })

      const removeButton = screen.getByRole('button', { name: 'Remove tag: AI' })
      await user.click(removeButton)

      expect(mockUpdateCourseTags).toHaveBeenCalledWith('c1', ['Python', 'Web'])
    })

    it('renders an add-tag button for adding new tags', () => {
      renderCard({ tags: ['Python'] })
      expect(screen.getByTestId('add-tag-button')).toBeInTheDocument()
    })

    it('respects maxVisible and shows overflow badge', () => {
      renderCard({ tags: ['Python', 'AI', 'Web', 'Data', 'ML'] })
      // TagBadgeList maxVisible=3, so 3 visible + overflow badge
      const tagBadges = screen.getAllByTestId('tag-badge')
      expect(tagBadges.length).toBe(3)
      expect(screen.getByTestId('tag-overflow-badge')).toBeInTheDocument()
      expect(screen.getByText('+2 more')).toBeInTheDocument()
    })
  })

  describe('status dropdown', () => {
    it('opens dropdown with all three status options and delete on click', async () => {
      const user = userEvent.setup()
      renderCard({ status: 'active' })

      await user.click(screen.getByTestId('status-badge'))

      expect(screen.getAllByRole('menuitem')).toHaveLength(5)
    })

    it('calls updateCourseStatus when a different status is selected', async () => {
      const user = userEvent.setup()
      renderCard({ id: 'c1', status: 'active' })

      await user.click(screen.getByTestId('status-badge'))

      const menuItems = screen.getAllByRole('menuitem')
      const completedItem = menuItems.find(item => item.textContent?.includes('Completed'))
      expect(completedItem).toBeDefined()
      await user.click(completedItem!)

      expect(mockUpdateCourseStatus).toHaveBeenCalledWith('c1', 'completed')
    })

    it('does not call updateCourseStatus when same status is selected', async () => {
      const user = userEvent.setup()
      renderCard({ id: 'c1', status: 'active' })

      await user.click(screen.getByTestId('status-badge'))

      const menuItems = screen.getAllByRole('menuitem')
      const activeItem = menuItems.find(item => item.textContent?.includes('Active'))
      await user.click(activeItem!)

      expect(mockUpdateCourseStatus).not.toHaveBeenCalled()
    })

    it('shows checkmark indicator on current status', async () => {
      const user = userEvent.setup()
      renderCard({ status: 'completed' })

      await user.click(screen.getByTestId('status-badge'))

      const menuItems = screen.getAllByRole('menuitem')
      const completedItem = menuItems.find(item => item.textContent?.includes('Completed'))
      // The current status item should contain a checkmark icon (extra SVG)
      const svgs = completedItem?.querySelectorAll('svg')
      expect(svgs?.length).toBeGreaterThanOrEqual(2) // status icon + checkmark
    })
  })

  describe('edit course menu item', () => {
    it('shows Edit details option in the dropdown menu', async () => {
      const user = userEvent.setup()
      renderCard()

      await user.click(screen.getByTestId('status-badge'))

      expect(screen.getByTestId('edit-course-menu-item')).toBeInTheDocument()
      expect(screen.getByText('Edit details')).toBeInTheDocument()
    })

    it('opens edit dialog when Edit details is clicked', async () => {
      const user = userEvent.setup()
      renderCard()

      await user.click(screen.getByTestId('status-badge'))
      await user.click(screen.getByTestId('edit-course-menu-item'))

      expect(screen.getByTestId('edit-course-dialog')).toBeInTheDocument()
    })
  })
})
