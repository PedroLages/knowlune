import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import type { ImportedCourse, LearnerCourseStatus } from '@/data/types'

const mockUpdateCourseTags = vi.fn()
const mockUpdateCourseStatus = vi.fn()
const mockUpdateCourseDetails = vi.fn().mockResolvedValue(undefined)
const mockRemoveImportedCourse = vi.fn().mockResolvedValue(undefined)
const mockNavigate = vi.fn()

// Per-test override variables for mocks — mutated in test bodies
const mockCourseCardPreview = vi.hoisted(() => ({
  showPreview: false,
  videoReady: false,
  setVideoReady: vi.fn(),
  previewHandlers: {},
  previewOpen: false,
  setPreviewOpen: vi.fn(),
  infoOpen: false,
  setInfoOpen: vi.fn(),
  guardNavigation: vi.fn(),
}))
const mockVideoFromHandle = vi.hoisted(() => ({
  blobUrl: null as string | null,
  error: null as string | null,
  loading: false,
}))
const mockDBSortBy = vi.hoisted(() => vi.fn().mockResolvedValue([]))

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
      getState: () => ({ importError: null }),
    }
  ),
}))

vi.mock('@/hooks/useCourseCardPreview', () => ({
  useCourseCardPreview: () => mockCourseCardPreview,
}))

vi.mock('@/hooks/useVideoFromHandle', () => ({
  useVideoFromHandle: () => mockVideoFromHandle,
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
          sortBy: mockDBSortBy,
        }),
      }),
    },
    youtubeChapters: {
      where: () => ({
        equals: () => ({
          sortBy: vi.fn().mockResolvedValue([]),
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
    tags: [],
    status: 'active' as LearnerCourseStatus,
    videoCount: 5,
    pdfCount: 3,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

function renderCard(
  overrides: Partial<ImportedCourse> = {},
  extraProps: { readOnly?: boolean; completionPercent?: number } = {}
) {
  return render(
    <MemoryRouter>
      <ImportedCourseCard course={makeCourse(overrides)} allTags={[]} {...extraProps} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockUpdateCourseTags.mockClear()
  mockUpdateCourseStatus.mockReset()
  mockNavigate.mockClear()
  mockRemoveImportedCourse.mockClear()
  mockDBSortBy.mockClear()
  mockDBSortBy.mockResolvedValue([])
  mockCourseCardPreview.showPreview = false
  mockCourseCardPreview.videoReady = false
  mockCourseCardPreview.setVideoReady = vi.fn()
  mockCourseCardPreview.previewHandlers = {}
  mockVideoFromHandle.blobUrl = null
  mockVideoFromHandle.error = null
  mockVideoFromHandle.loading = false
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CourseCard Drive source badge', () => {
  it('shows Drive source badge when course source is "drive"', () => {
    renderCard({ source: 'drive' })

    const badge = screen.getByTestId('course-card-source-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Drive')
  })

  it('does not show Drive source badge for local courses', () => {
    renderCard({ source: undefined })

    expect(screen.queryByTestId('course-card-source-badge')).not.toBeInTheDocument()
  })

  it('does not show Drive source badge for YouTube courses', () => {
    renderCard({ source: 'youtube' })

    expect(screen.queryByTestId('course-card-source-badge')).not.toBeInTheDocument()
  })

  it('renders video count alongside Drive badge', () => {
    renderCard({ source: 'drive', videoCount: 10 })

    expect(screen.getByTestId('course-card-source-badge')).toBeInTheDocument()
    expect(screen.getByText('10 videos')).toBeInTheDocument()
  })
})
