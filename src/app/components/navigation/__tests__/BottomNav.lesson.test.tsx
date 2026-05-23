/**
 * BottomNav lesson mode — Unit tests for Unit 4.
 *
 * Tests:
 * - Standard mode renders standard primary nav items
 * - Lesson mode renders lesson-specific primary items (Back, Notes, Completion, More)
 * - Clicking Notes in contextual BottomNav toggles notes panel
 * - Clicking Completion in contextual BottomNav marks lesson complete
 * - Lesson mode More drawer shows lesson tools
 * - Standard mode More drawer shows standard nav items
 * - Theater mode: data-theater-hide wrapper present (tested via Layout integration)
 *
 * @see docs/plans/2026-05-02-001-feat-merge-lesson-toolbar-into-header-plan.md  Unit 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { BottomNav } from '../BottomNav'

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------

let mockNotesOpen = false
let mockHasNotes = false
let mockIsTheater = false
let mockIsReadingMode = false
let mockItemStatus = 'not-started'

const mockToggleNotesWithFocus = vi.fn()
const mockToggleTheater = vi.fn()
const mockToggleReadingMode = vi.fn()
const mockSetItemStatus = vi.fn().mockResolvedValue(undefined)
const mockLoadCourseProgress = vi.fn().mockResolvedValue(undefined)

// Track store state for selector-based mocks
const lessonChromeState = {
  get notesOpen() { return mockNotesOpen },
  get toggleNotesWithFocus() { return mockToggleNotesWithFocus },
  get hasNotes() { return mockHasNotes },
  get isTheater() { return mockIsTheater },
  get toggleTheater() { return mockToggleTheater },
  get isReadingMode() { return mockIsReadingMode },
  get toggleReadingMode() { return mockToggleReadingMode },
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/useLessonChromeStore', () => ({
  useLessonChromeStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(lessonChromeState as unknown as Record<string, unknown>),
}))

vi.mock('@/app/hooks/useLessonItemCompletionStatus', () => ({
  useLessonItemCompletionStatus: (courseId?: string, lessonId?: string) => {
    if (!courseId || !lessonId) return 'not-started'
    return mockItemStatus as 'not-started' | 'in-progress' | 'completed'
  },
}))

vi.mock('@/stores/useContentProgressStore', () => ({
  useContentProgressStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setItemStatus: mockSetItemStatus,
      loadCourseProgress: mockLoadCourseProgress,
    }),
}))

vi.mock('@/app/hooks/useProgressiveDisclosure', () => ({
  useProgressiveDisclosure: () => ({
    isVisible: () => true,
  }),
}))

vi.mock('@/app/components/figma/QAChatPanel', () => ({
  QAChatPanel: () => <div data-testid="qa-chat-panel">QA Chat</div>,
}))

vi.mock('@/app/components/figma/PomodoroTimer', () => ({
  PomodoroTimer: () => <div data-testid="pomodoro-timer">Pomodoro Timer</div>,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderBottomNav(props: {
  mode?: 'standard' | 'lesson'
  courseId?: string
  lessonId?: string
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <BottomNav {...props} />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BottomNav lesson mode', () => {
  beforeEach(() => {
    mockNotesOpen = false
    mockHasNotes = false
    mockIsTheater = false
    mockIsReadingMode = false
    mockItemStatus = 'not-started'

    mockToggleNotesWithFocus.mockClear()
    mockToggleTheater.mockClear()
    mockToggleReadingMode.mockClear()
    mockSetItemStatus.mockClear()
    mockLoadCourseProgress.mockClear()
  })

  // -- Standard mode -----------------------------------------------------------

  it('renders standard primary nav items in standard mode', () => {
    renderBottomNav({ mode: 'standard' })

    // Standard mode shows Overview, Courses, My Class, Notes + More
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Courses')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  // -- Lesson mode primary slots ----------------------------------------------

  it('renders lesson-specific primary items in lesson mode', () => {
    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()

    // Standard nav items should NOT be present
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
  })

  it('shows "Done" label when lesson is completed', () => {
    mockItemStatus = 'completed'

    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
  })

  it('does not render Back button when courseId is missing', () => {
    renderBottomNav({ mode: 'lesson' })

    expect(screen.queryByText('Back')).not.toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  // -- Notes toggle -----------------------------------------------------------

  it('toggles notes panel when Notes button is clicked', () => {
    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    fireEvent.click(screen.getByTestId('bottomnav-notes-toggle'))
    expect(mockToggleNotesWithFocus).toHaveBeenCalledTimes(1)
  })

  it('shows notes indicator dot when hasNotes is true and notes are closed', () => {
    mockHasNotes = true
    mockNotesOpen = false

    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    const notesBtn = screen.getByTestId('bottomnav-notes-toggle')
    // The indicator dot is a span inside the button
    const indicator = notesBtn.querySelector('.size-2.rounded-full')
    expect(indicator).toBeInTheDocument()
  })

  it('does not show indicator dot when notes are open', () => {
    mockHasNotes = true
    mockNotesOpen = true

    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    const notesBtn = screen.getByTestId('bottomnav-notes-toggle')
    const indicator = notesBtn.querySelector('.size-2.rounded-full')
    expect(indicator).not.toBeInTheDocument()
  })

  // -- Completion toggle ------------------------------------------------------

  it('marks lesson complete when Completion button is clicked (from not-started)', async () => {
    mockItemStatus = 'not-started'

    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    fireEvent.click(screen.getByTestId('bottomnav-completion-toggle'))

    await waitFor(() => {
      expect(mockSetItemStatus).toHaveBeenCalledWith('course-1', 'lesson-1', 'completed', [])
    })
  })

  it('marks lesson not-started when Completion button is clicked (from completed)', async () => {
    mockItemStatus = 'completed'

    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    fireEvent.click(screen.getByTestId('bottomnav-completion-toggle'))

    await waitFor(() => {
      expect(mockSetItemStatus).toHaveBeenCalledWith('course-1', 'lesson-1', 'not-started', [])
    })
  })

  // -- More drawer (lesson mode) ----------------------------------------------

  it('opens More drawer with lesson tools in lesson mode', async () => {
    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    fireEvent.click(screen.getByTestId('bottomnav-more-trigger'))

    await waitFor(() => {
      expect(screen.getByText('Lesson Tools')).toBeInTheDocument()
    })
  })

  it('More drawer shows completion and notes toggles in lesson mode', async () => {
    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    fireEvent.click(screen.getByTestId('bottomnav-more-trigger'))

    await waitFor(() => {
      expect(screen.getByTestId('drawer-completion-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('drawer-notes-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('drawer-reading-mode')).toBeInTheDocument()
      expect(screen.getByTestId('drawer-theater-mode')).toBeInTheDocument()
    })
  })

  it('More drawer shows Pomodoro and QA Chat in lesson mode', async () => {
    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    fireEvent.click(screen.getByTestId('bottomnav-more-trigger'))

    await waitFor(() => {
      expect(screen.getByTestId('pomodoro-timer')).toBeInTheDocument()
      expect(screen.getByTestId('qa-chat-panel')).toBeInTheDocument()
    })
  })

  // -- More drawer (standard mode) --------------------------------------------

  it('opens More drawer with standard nav items in standard mode', async () => {
    renderBottomNav({ mode: 'standard' })

    // Click the More button
    const moreButton = screen.getByLabelText('More menu')
    fireEvent.click(moreButton)

    await waitFor(() => {
      expect(screen.getByText('More Options')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  // -- Mode switching ----------------------------------------------------------

  it('reverts to standard primary nav when mode is standard', () => {
    renderBottomNav({ mode: 'standard' })

    // Should show standard nav items, not lesson items
    expect(screen.queryByText('Back')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bottomnav-notes-toggle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bottomnav-completion-toggle')).not.toBeInTheDocument()
  })

  // -- Accessibility -----------------------------------------------------------

  it('uses lesson-specific aria-label on nav in lesson mode', () => {
    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    const nav = screen.getByLabelText('Lesson navigation')
    expect(nav).toBeInTheDocument()
    expect(nav.tagName).toBe('NAV')
  })

  it('uses standard aria-label on nav in standard mode', () => {
    renderBottomNav({ mode: 'standard' })

    const nav = screen.getByLabelText('Mobile navigation')
    expect(nav).toBeInTheDocument()
  })

  // -- Safe area insets -------------------------------------------------------

  it('preserves safe area inset padding in lesson mode', () => {
    renderBottomNav({ mode: 'lesson', courseId: 'course-1', lessonId: 'lesson-1' })

    const nav = screen.getByLabelText('Lesson navigation')
    expect(nav.className).toContain('pb-[env(safe-area-inset-bottom)]')
  })
})
