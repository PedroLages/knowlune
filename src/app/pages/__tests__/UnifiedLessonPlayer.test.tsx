/**
 * UnifiedLessonPlayer — Unit tests for completion flow callbacks
 *
 * Tests:
 * - handleVideoEnded stops celebration/auto-advance on persistence failure
 * - Celebration modal only appears on course completion (not individual lesson)
 * - showCelebration uses lessons from hook (no extra getLessons call)
 * - Course-level celebration type selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_LESSONS = [
  { id: 'lesson-1', title: 'Lesson 1', type: 'video' as const },
  { id: 'lesson-2', title: 'Lesson 2', type: 'video' as const },
  { id: 'lesson-3', title: 'Lesson 3', type: 'video' as const },
]

// ---------------------------------------------------------------------------
// Mocks — alphabetical by module path
// ---------------------------------------------------------------------------

// Prevent Dexie from initializing IndexedDB (not available in jsdom)
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/db/schema', () => ({ db: {} }))

const mockSetItemStatus = vi.fn().mockResolvedValue(undefined)
const mockGetItemStatus = vi.fn().mockReturnValue('not-started')

vi.mock('@/stores/useContentProgressStore', () => ({
  useContentProgressStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      setItemStatus: mockSetItemStatus,
      getItemStatus: mockGetItemStatus,
      loadCourseProgress: vi.fn(),
    }),
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      importedCourses: [
        {
          id: 'test-course',
          name: 'Test Course',
          importedAt: '2025-01-15T12:00:00.000Z',
          category: 'general',
          tags: [],
          status: 'active',
          videoCount: 3,
          pdfCount: 0,
        },
      ],
    }),
}))

const mockAdapter = {
  getLessons: vi.fn().mockResolvedValue(MOCK_LESSONS),
  getLesson: vi.fn().mockImplementation((id: string) =>
    Promise.resolve(MOCK_LESSONS.find(l => l.id === id) ?? null)
  ),
  getSource: vi.fn().mockReturnValue('local'),
  getCapabilities: vi.fn().mockReturnValue({
    hasVideo: true,
    supportsPrevNext: true,
    supportsQuiz: false,
    hasTranscript: false,
  }),
}

vi.mock('@/hooks/useCourseAdapter', () => ({
  useCourseAdapter: () => ({ adapter: mockAdapter, loading: false, error: null }),
}))

const mockUseLessonNavigation = vi.fn(() => ({
  prevLesson: null as (typeof MOCK_LESSONS)[number] | null,
  nextLesson: MOCK_LESSONS[1] as (typeof MOCK_LESSONS)[number] | null,
  currentIndex: 0,
  totalLessons: 3,
  lessons: MOCK_LESSONS as (typeof MOCK_LESSONS)[number][],
  loading: false as boolean,
}))

vi.mock('@/app/hooks/useLessonNavigation', () => ({
  useLessonNavigation: () => mockUseLessonNavigation(),
}))

vi.mock('@/app/hooks/useMediaQuery', () => ({
  useIsDesktop: () => true,
  useIsTablet: () => false,
}))

vi.mock('@/app/hooks/useTheaterMode', () => ({
  useTheaterMode: () => ({ isTheater: false, toggleTheater: vi.fn() }),
}))

vi.mock('@/app/hooks/useSessionTracking', () => ({
  useSessionTracking: vi.fn(),
}))

vi.mock('@/hooks/useHasQuiz', () => ({
  useHasQuiz: () => ({ hasQuiz: false }),
}))

vi.mock('@/hooks/useQuizGeneration', () => ({
  useQuizGeneration: () => ({
    generate: vi.fn(),
    isGenerating: false,
    error: null,
    quizId: null,
  }),
}))

const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}))

// Stub out heavy sub-components
vi.mock('@/app/components/course/PlayerHeader', () => ({
  PlayerHeader: () => <div data-testid="player-header">Header</div>,
}))
vi.mock('@/app/components/course/CourseBreadcrumb', () => ({
  CourseBreadcrumb: () => <div>Breadcrumb</div>,
}))
vi.mock('@/app/components/course/LessonNavigation', () => ({
  LessonNavigation: () => <div data-testid="lesson-navigation">Nav</div>,
}))
vi.mock('@/app/components/figma/AutoAdvanceCountdown', () => ({
  AutoAdvanceCountdown: ({ nextLessonTitle }: { nextLessonTitle: string }) => (
    <div data-testid="auto-advance-countdown">{nextLessonTitle}</div>
  ),
}))
vi.mock('@/app/components/celebrations/CompletionModal', () => ({
  CompletionModal: ({ open, type, title }: { open: boolean; type: string; title: string }) =>
    open ? (
      <div data-testid="celebration-modal" data-type={type}>
        {title}
      </div>
    ) : null,
}))
vi.mock('@/app/components/course/LocalVideoContent', () => ({
  LocalVideoContent: ({ onEnded }: { onEnded: () => void }) => (
    <div data-testid="local-video">
      <button data-testid="trigger-ended" onClick={onEnded}>
        End Video
      </button>
    </div>
  ),
}))
vi.mock('@/app/components/course/YouTubeVideoContent', () => ({
  YouTubeVideoContent: () => <div>YT</div>,
}))
vi.mock('@/app/components/course/BelowVideoTabs', () => ({
  BelowVideoTabs: () => <div data-testid="below-video-tabs">Below Video Tabs</div>,
}))
vi.mock('@/app/components/course/tabs/LessonsTab', () => ({
  LessonsTab: () => <div data-testid="lessons-tab">Lessons Tab</div>,
}))
vi.mock('@/app/components/DelayedFallback', () => ({
  DelayedFallback: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/app/components/NextCourseSuggestion', () => ({
  NextCourseSuggestion: () => <div data-testid="next-course-suggestion">Suggestion</div>,
}))

vi.mock('@/lib/courseSuggestion', () => ({
  suggestNextCourse: () => null,
}))

vi.mock('@/app/components/course/MiniPlayer', () => ({
  MiniPlayer: () => null,
}))

vi.mock('@/app/components/course/LessonHeaderCard', () => ({
  LessonHeaderCard: () => <div>Lesson Header</div>,
}))

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { UnifiedLessonPlayer } from '../UnifiedLessonPlayer'

function renderPlayer(courseId = 'test-course', lessonId = 'lesson-1') {
  return render(
    <MemoryRouter initialEntries={[`/courses/${courseId}/lessons/${lessonId}`]}>
      <Routes>
        <Route path="/courses/:courseId/lessons/:lessonId" element={<UnifiedLessonPlayer />} />
      </Routes>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedLessonPlayer — E54-S01 callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetItemStatus.mockResolvedValue(undefined)
    mockGetItemStatus.mockReturnValue('not-started')
  })

  it('renders lesson player content', async () => {
    renderPlayer()
    expect(await screen.findByTestId('lesson-player-content')).toBeInTheDocument()
  })

  it('does NOT show celebration when a single lesson completes (course not fully done)', async () => {
    renderPlayer()
    const endButton = await screen.findByTestId('trigger-ended')

    await act(async () => {
      endButton.click()
    })

    // Wait for the completion to process (setItemStatus resolves, showCelebration runs)
    await waitFor(() => {
      expect(mockSetItemStatus).toHaveBeenCalled()
    })

    // Celebration modal should NOT appear for individual lesson completion
    expect(screen.queryByTestId('celebration-modal')).not.toBeInTheDocument()

    // Auto-advance countdown SHOULD still appear
    expect(screen.getByTestId('auto-advance-countdown')).toBeInTheDocument()
  })

  it('does NOT show celebration when setItemStatus throws (persistence failure)', async () => {
    mockSetItemStatus.mockRejectedValueOnce(new Error('DB write failed'))

    renderPlayer()
    const endButton = await screen.findByTestId('trigger-ended')

    await act(async () => {
      endButton.click()
    })

    // Wait for the error toast
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to mark lesson as complete')
    })

    // Celebration modal should NOT appear
    expect(screen.queryByTestId('celebration-modal')).not.toBeInTheDocument()

    // Auto-advance should NOT appear
    expect(screen.queryByTestId('auto-advance-countdown')).not.toBeInTheDocument()
  })

  it('does NOT show auto-advance when lesson is last in course and course not complete', async () => {
    // Override useLessonNavigation to simulate the last lesson (no next lesson)
    mockUseLessonNavigation.mockReturnValue({
      prevLesson: MOCK_LESSONS[1],
      nextLesson: null,
      currentIndex: 2,
      totalLessons: 3,
      lessons: MOCK_LESSONS,
      loading: false,
    })

    renderPlayer()
    const endButton = await screen.findByTestId('trigger-ended')

    await act(async () => {
      endButton.click()
    })

    await waitFor(() => {
      expect(mockSetItemStatus).toHaveBeenCalled()
    })

    // Auto-advance countdown should NOT appear when there's no next lesson
    expect(screen.queryByTestId('auto-advance-countdown')).not.toBeInTheDocument()
  })

  it('shows course-level celebration when all lessons are complete', async () => {
    // Mark all other lessons as completed
    mockGetItemStatus.mockReturnValue('completed')

    renderPlayer()
    const endButton = await screen.findByTestId('trigger-ended')

    await act(async () => {
      endButton.click()
    })

    await waitFor(() => {
      const modal = screen.getByTestId('celebration-modal')
      expect(modal).toHaveAttribute('data-type', 'course')
    })
  })

  it('does not call adapter.getLessons() in showCelebration (uses hook data)', async () => {
    // All other lessons must be completed for the course-level celebration to open
    mockGetItemStatus.mockReturnValue('completed')

    renderPlayer()
    const endButton = await screen.findByTestId('trigger-ended')

    // Clear the call count from initial hook load
    mockAdapter.getLessons.mockClear()

    await act(async () => {
      endButton.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('celebration-modal')).toBeInTheDocument()
    })

    // getLessons should NOT have been called by showCelebration
    // (it may still be called by the lesson metadata useEffect, but not by showCelebration)
    // The key assertion is that we removed the duplicate call
    expect(mockAdapter.getLessons).not.toHaveBeenCalled()
  })
})
