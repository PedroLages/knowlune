import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditCourseDialog } from '../EditCourseDialog'
import type { ImportedCourse } from '@/data/types'

const mockUpdateCourseDetails = vi.fn().mockResolvedValue(true)

vi.mock('@/db', () => ({
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

vi.mock('../VideoReorderList', () => ({
  VideoReorderList: ({ videos }: { videos: unknown[] }) => (
    <div data-testid="video-reorder-list">
      {videos.length === 0 ? 'No videos in this course.' : `${videos.length} videos`}
    </div>
  ),
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        updateCourseDetails: mockUpdateCourseDetails,
      }),
    {
      getState: () => ({ importError: null }),
    }
  ),
}))

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      authors: [
        { id: 'author-1', name: 'Test Author', photoUrl: '', courseIds: [] },
      ],
      loadAuthors: vi.fn(),
      linkCourseToAuthor: vi.fn(),
      unlinkCourseFromAuthor: vi.fn(),
    }),
}))

vi.mock('@/lib/authors', () => ({
  getAvatarSrc: () => ({ src: '' }),
  getInitials: (name: string) => name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
}))

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'Test Course',
    description: 'A test description',
    importedAt: '2026-02-10T10:00:00Z',
    category: 'programming',
    tags: ['python', 'ai'],
    status: 'active',
    videoCount: 5,
    pdfCount: 3,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  course: makeCourse(),
  allTags: ['python', 'ai', 'web', 'data-science'],
}

function renderDialog(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(<EditCourseDialog {...props} />)
}

beforeEach(() => {
  mockUpdateCourseDetails.mockClear()
  defaultProps.onOpenChange.mockClear()
})

describe('EditCourseDialog', () => {
  it('renders with pre-populated course data', () => {
    renderDialog()
    expect(screen.getByTestId('edit-course-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('edit-course-name')).toHaveValue('Test Course')
    expect(screen.getByTestId('edit-course-description')).toHaveValue('A test description')
    expect(screen.getByTestId('edit-course-category')).toHaveValue('programming')
    expect(screen.getAllByTestId('edit-tag-badge')).toHaveLength(2)
  })

  it('disables Save when no changes are made', () => {
    renderDialog()
    expect(screen.getByTestId('edit-course-save')).toBeDisabled()
  })

  it('enables Save when name is changed', async () => {
    const user = userEvent.setup()
    renderDialog()
    const nameInput = screen.getByTestId('edit-course-name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Course')
    expect(screen.getByTestId('edit-course-save')).toBeEnabled()
  })

  it('disables Save when name is empty', async () => {
    const user = userEvent.setup()
    renderDialog()
    const nameInput = screen.getByTestId('edit-course-name')
    await user.clear(nameInput)
    expect(screen.getByTestId('edit-course-save')).toBeDisabled()
    expect(screen.getByText('Course name is required.')).toBeInTheDocument()
  })

  it('calls updateCourseDetails on Save', async () => {
    const user = userEvent.setup()
    renderDialog()
    const nameInput = screen.getByTestId('edit-course-name')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByTestId('edit-course-save'))
    await waitFor(() => {
      expect(mockUpdateCourseDetails).toHaveBeenCalledWith('course-1', {
        name: 'New Name',
        description: 'A test description',
        category: 'programming',
        tags: ['python', 'ai'],
        authorId: null,
      })
    })
  })

  it('closes dialog on Cancel', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange })
    await user.click(screen.getByTestId('edit-course-cancel'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('can remove a tag', async () => {
    const user = userEvent.setup()
    renderDialog()
    const removeButtons = screen.getAllByRole('button', { name: /Remove tag:/ })
    await user.click(removeButtons[0]) // Remove 'python'
    expect(screen.getAllByTestId('edit-tag-badge')).toHaveLength(1)
    // Save should be enabled since tags changed
    expect(screen.getByTestId('edit-course-save')).toBeEnabled()
  })

  it('can add a new tag via Enter', async () => {
    const user = userEvent.setup()
    renderDialog()
    const tagInput = screen.getByTestId('edit-course-tag-input')
    await user.type(tagInput, 'newtag{Enter}')
    expect(screen.getAllByTestId('edit-tag-badge')).toHaveLength(3)
  })

  it('shows tag suggestions from allTags', async () => {
    const user = userEvent.setup()
    renderDialog()
    const tagInput = screen.getByTestId('edit-course-tag-input')
    await user.type(tagInput, 'web')
    expect(screen.getByTestId('tag-suggestions')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument()
  })

  it('does not allow duplicate tags', async () => {
    const user = userEvent.setup()
    renderDialog()
    const tagInput = screen.getByTestId('edit-course-tag-input')
    await user.type(tagInput, 'python{Enter}')
    // Still only 2 tags since 'python' already exists
    expect(screen.getAllByTestId('edit-tag-badge')).toHaveLength(2)
  })

  it('enables Save when description changes', async () => {
    const user = userEvent.setup()
    renderDialog()
    const descInput = screen.getByTestId('edit-course-description')
    await user.clear(descInput)
    await user.type(descInput, 'New description')
    expect(screen.getByTestId('edit-course-save')).toBeEnabled()
  })

  it('enables Save when category changes', async () => {
    const user = userEvent.setup()
    renderDialog()
    const catInput = screen.getByTestId('edit-course-category')
    await user.clear(catInput)
    await user.type(catInput, 'design')
    expect(screen.getByTestId('edit-course-save')).toBeEnabled()
  })

  it('renders Details and Video Order tabs', () => {
    renderDialog()
    expect(screen.getByTestId('edit-course-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('tab-details')).toBeInTheDocument()
    expect(screen.getByTestId('tab-videos')).toBeInTheDocument()
  })

  it('switches to Video Order tab', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByTestId('tab-videos'))
    expect(screen.getByTestId('video-reorder-list')).toBeInTheDocument()
    expect(screen.getByTestId('edit-course-done')).toBeInTheDocument()
    // Save button should not be visible on videos tab
    expect(screen.queryByTestId('edit-course-save')).not.toBeInTheDocument()
  })
})
