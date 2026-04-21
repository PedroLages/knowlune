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
const mockNavigate = vi.fn()

// `getState()` is mutated per-test to drive error-path branches.
let mockImportError: string | null = null

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

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
      getState: () => ({ importError: mockImportError }),
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

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      authors: [],
      loadAuthors: vi.fn(),
    }),
}))

vi.mock('@/lib/authors', () => ({
  getAvatarSrc: () => ({ src: '' }),
  getInitials: (name: string) =>
    name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase(),
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
    youtubeChapters: {
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

function renderCard(
  overrides: Partial<ImportedCourse> = {},
  allTags: string[] = [],
  extraProps: { readOnly?: boolean; completionPercent?: number } = {}
) {
  return render(
    <MemoryRouter>
      <ImportedCourseCard course={makeCourse(overrides)} allTags={allTags} {...extraProps} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockUpdateCourseTags.mockClear()
  mockUpdateCourseStatus.mockReset()
  mockNavigate.mockClear()
  mockRemoveImportedCourse.mockClear()
  mockImportError = null
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

  it('does not render import date in card body (moved to info popover)', () => {
    // "Imported DATE" was moved from body to info popover to free a body line for stats
    const { container } = renderCard({ importedAt: '2026-02-10T10:00:00Z' })
    // The import date text should NOT appear in the main card body
    // (it lives inside the popover which is not open by default)
    const article = container.querySelector('article')
    expect(article).not.toBeNull()
    const bodyText = article!.textContent ?? ''
    expect(bodyText).not.toMatch(/^Imported \d/)
  })

  it('has accessible article with aria-label', () => {
    renderCard({ name: 'My Course', videoCount: 3, pdfCount: 2 })
    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('aria-label', 'My Course — 3 videos, 2 PDFs')
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

  it('is keyboard-focusable (article has tabindex 0)', () => {
    renderCard()
    const focusable = screen.getByRole('article')
    expect(focusable).toHaveAttribute('tabindex', '0')
    focusable.focus()
    expect(document.activeElement).toBe(focusable)
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

    it('exposes status via aria-label on each status (AC-1.3 behavior)', () => {
      // Behavioral substitute for previous brittle class-name assertions:
      // verify that each status surfaces a distinct, screen-reader-readable label.
      const { rerender } = renderCard({ status: 'active' })
      expect(screen.getByTestId('status-badge')).toHaveAttribute(
        'aria-label',
        'Course status: Active. Click to change.'
      )

      rerender(
        <MemoryRouter>
          <ImportedCourseCard course={makeCourse({ status: 'completed' })} allTags={[]} />
        </MemoryRouter>
      )
      expect(screen.getByTestId('status-badge')).toHaveAttribute(
        'aria-label',
        'Course status: Completed. Click to change.'
      )

      rerender(
        <MemoryRouter>
          <ImportedCourseCard course={makeCourse({ status: 'paused' })} allTags={[]} />
        </MemoryRouter>
      )
      expect(screen.getByTestId('status-badge')).toHaveAttribute(
        'aria-label',
        'Course status: Paused. Click to change.'
      )
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
    it('opens dropdown with all four status options, edit, and delete on click', async () => {
      const user = userEvent.setup()
      renderCard({ status: 'active' })

      await user.click(screen.getByTestId('status-badge'))

      expect(screen.getAllByRole('menuitem')).toHaveLength(6)
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

  describe('Play overlay (Start Studying)', () => {
    it('renders start-course-btn overlay for not-started course', () => {
      renderCard({ status: 'not-started' })
      expect(screen.getByTestId('start-course-btn')).toBeInTheDocument()
    })

    it('has accessible aria-label on Play overlay', () => {
      renderCard({ status: 'not-started', name: 'My Course' })
      const btn = screen.getByTestId('start-course-btn')
      expect(btn).toHaveAttribute('aria-label', 'Start studying "My Course"')
    })

    it('does not render start-course-btn for active course', () => {
      renderCard({ status: 'active' })
      expect(screen.queryByTestId('start-course-btn')).toBeNull()
    })

    it('does not render start-course-btn for completed course', () => {
      renderCard({ status: 'completed' })
      expect(screen.queryByTestId('start-course-btn')).toBeNull()
    })

    it('does not render start-course-btn for paused course', () => {
      renderCard({ status: 'paused' })
      expect(screen.queryByTestId('start-course-btn')).toBeNull()
    })

    it('calls updateCourseStatus and navigates when Play overlay is clicked', async () => {
      mockUpdateCourseStatus.mockResolvedValueOnce(undefined)
      const user = userEvent.setup()
      renderCard({ id: 'c1', status: 'not-started' })
      const btn = screen.getByTestId('start-course-btn')
      await user.click(btn)
      expect(mockUpdateCourseStatus).toHaveBeenCalledWith('c1', 'active')
      expect(mockNavigate).toHaveBeenCalledWith('/courses/c1/overview')
    })

    it('does not render start-course-btn when readOnly=true', () => {
      render(
        <MemoryRouter>
          <ImportedCourseCard
            course={makeCourse({ status: 'not-started' })}
            allTags={[]}
            readOnly
          />
        </MemoryRouter>
      )
      expect(screen.queryByTestId('start-course-btn')).toBeNull()
    })

    it('does NOT navigate when updateCourseStatus rejects', async () => {
      // Swallow the unhandled rejection that propagates through React's event
      // handler — this test asserts the navigation guard contract, not the
      // rejection-surface UX. A follow-up could add try/catch + toast.error
      // around the await in handleStartStudying; this test will then assert
      // toast.error directly and drop the swallow.
      const onUnhandled = (reason: unknown) => {
        if (reason instanceof Error && reason.message === 'boom') return
        throw reason
      }
      process.on('unhandledRejection', onUnhandled)
      try {
        mockUpdateCourseStatus.mockRejectedValueOnce(new Error('boom'))
        const user = userEvent.setup()
        renderCard({ id: 'c1', status: 'not-started' })
        const btn = screen.getByTestId('start-course-btn')
        await user.click(btn).catch(() => {})
        // Allow microtasks to drain so the rejection is observed.
        await new Promise(r => setTimeout(r, 0))
        expect(mockUpdateCourseStatus).toHaveBeenCalledWith('c1', 'active')
        expect(mockNavigate).not.toHaveBeenCalled()
      } finally {
        process.off('unhandledRejection', onUnhandled)
      }
    })

    it('shows toast.error with importError message and does NOT navigate when store reports importError', async () => {
      const { toast } = await import('sonner')
      mockImportError = 'Failed to update status'
      mockUpdateCourseStatus.mockResolvedValueOnce(undefined)
      const user = userEvent.setup()
      renderCard({ id: 'c1', status: 'not-started' })
      await user.click(screen.getByTestId('start-course-btn'))
      expect(toast.error).toHaveBeenCalledWith('Failed to update status')
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('keyboard Enter on not-started card triggers updateCourseStatus + navigate', async () => {
      mockUpdateCourseStatus.mockResolvedValueOnce(undefined)
      const user = userEvent.setup()
      renderCard({ id: 'c1', status: 'not-started' })
      const article = screen.getByRole('article')
      article.focus()
      await user.keyboard('{Enter}')
      expect(mockUpdateCourseStatus).toHaveBeenCalledWith('c1', 'active')
      expect(mockNavigate).toHaveBeenCalledWith('/courses/c1/overview')
    })

    it('in-flight guard: rapid double-click only invokes updateCourseStatus once', async () => {
      // Slow-resolving promise so the second click occurs before the first resolves
      let resolveFn: () => void = () => {}
      const slow = new Promise<void>(resolve => {
        resolveFn = resolve
      })
      mockUpdateCourseStatus.mockReturnValueOnce(slow)
      const user = userEvent.setup()
      renderCard({ id: 'c1', status: 'not-started' })
      const btn = screen.getByTestId('start-course-btn')
      await user.click(btn)
      await user.click(btn)
      expect(mockUpdateCourseStatus).toHaveBeenCalledTimes(1)
      resolveFn()
    })
  })

  describe('mutual exclusion: PlayOverlay vs CompletionOverlay', () => {
    it('completed status with completionPercent=100 hides PlayOverlay and renders CompletionOverlay', () => {
      const { container } = renderCard({ status: 'completed' }, [], { completionPercent: 100 })
      expect(screen.queryByTestId('start-course-btn')).toBeNull()
      // CompletionOverlay is decorative (aria-hidden) — locate via the wrapper containing the check icon.
      // It's rendered with `pointer-events-none` and `aria-hidden="true"`.
      const overlay = container.querySelector('[aria-hidden="true"].pointer-events-none')
      expect(overlay).not.toBeNull()
    })

    it('not-started + completionPercent=100 still suppresses PlayOverlay (isCompleted derives true)', () => {
      renderCard({ status: 'not-started' }, [], { completionPercent: 100 })
      expect(screen.queryByTestId('start-course-btn')).toBeNull()
    })
  })

  describe('readOnly prop', () => {
    it('hides camera overlay, edit menu item, and delete menu item when readOnly=true', async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <ImportedCourseCard course={makeCourse({ status: 'active' })} allTags={[]} readOnly />
        </MemoryRouter>
      )

      // Camera overlay (testid added by the source agent in this refactor)
      expect(screen.queryByTestId('course-thumbnail-edit-btn')).toBeNull()
      // Also check the legacy aria-label form in case the testid lands later.
      expect(screen.queryByRole('button', { name: 'Change thumbnail' })).toBeNull()

      // Status dropdown is still available
      const statusBadge = screen.getByTestId('status-badge')
      expect(statusBadge).toBeInTheDocument()

      await user.click(statusBadge)

      // Edit + delete items should NOT be in DOM
      expect(screen.queryByTestId('edit-course-menu-item')).toBeNull()
      expect(screen.queryByTestId('delete-course-menu-item')).toBeNull()
      // Status options remain (4 menu items, no edit/delete separator block)
      expect(screen.getAllByRole('menuitem').length).toBe(4)
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
