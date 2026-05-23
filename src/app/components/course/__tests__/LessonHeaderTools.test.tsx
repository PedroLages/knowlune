/**
 * LessonHeaderTools — Unit tests for Unit 3.
 *
 * Tests:
 * - On lesson route, renders all tool buttons
 * - Clicking theater toggle calls toggleTheater() on store
 * - Clicking notes toggle calls toggleNotes() on store
 * - Completion dropdown shows current status
 * - Guest user → completion hidden, other tools visible
 * - Theater mode → all tools carry data-theater-hide attr
 *
 * @see docs/plans/2026-05-02-001-feat-merge-lesson-toolbar-into-header-plan.md  Unit 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LessonHeaderTools } from '../LessonHeaderTools'

// ---------------------------------------------------------------------------
// Mock state factories
// ---------------------------------------------------------------------------

let mockIsTheater: boolean
let mockIsReadingMode: boolean
let mockNotesOpen: boolean
let mockHasNotes: boolean
let mockCourseId: string | null
let mockLessonId: string | null
let mockIsGuest: boolean
let mockItemStatus: string
let mockAutoPlay: boolean

const toggleTheater = vi.fn()
const toggleReadingMode = vi.fn()
const toggleNotesWithFocus = vi.fn()
const setHasNotes = vi.fn()
const setItemStatus = vi.fn()
const toggleAutoPlay = vi.fn()

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/useLessonChromeStore', () => ({
  useLessonChromeStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      isTheater: mockIsTheater,
      toggleTheater,
      isReadingMode: mockIsReadingMode,
      toggleReadingMode,
      notesOpen: mockNotesOpen,
      toggleNotesWithFocus,
      hasNotes: mockHasNotes,
      setHasNotes,
      autoPlay: mockAutoPlay,
      toggleAutoPlay,
    }),
}))

vi.mock('@/app/hooks/useLessonItemCompletionStatus', () => ({
  useLessonItemCompletionStatus: () => mockItemStatus,
}))

vi.mock('@/stores/useContentProgressStore', () => ({
  useContentProgressStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setItemStatus,
      loadCourseProgress: vi.fn(),
    }),
}))

vi.mock('@/app/hooks/useCourseRoute', () => ({
  useCourseRoute: () => ({
    isLessonRoute: mockCourseId !== null && mockLessonId !== null,
    isCourseRoute: mockCourseId !== null,
    courseId: mockCourseId,
    lessonId: mockLessonId,
    courseName: 'React Patterns',
  }),
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: mockIsGuest ? null : { id: 'test-user' }, initialized: true }),
  selectIsGuestMode: (s: { initialized: boolean; user: unknown }) =>
    !s.initialized || !s.user,
}))

vi.mock('@/app/components/figma/PomodoroTimer', () => ({
  PomodoroTimer: () => <div data-testid="pomodoro-timer">Pomodoro</div>,
}))

vi.mock('@/app/components/figma/QAChatPanel', () => ({
  QAChatPanel: () => <div data-testid="qa-chat-panel">QA Chat</div>,
}))

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function setGuestMode(guest: boolean) {
  mockIsGuest = guest
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LessonHeaderTools', () => {
  beforeEach(() => {
    mockIsTheater = false
    mockIsReadingMode = false
    mockNotesOpen = false
    mockHasNotes = false
    mockCourseId = 'course-1'
    mockLessonId = 'lesson-1'
    mockIsGuest = false
    mockItemStatus = 'not-started'
    mockAutoPlay = true

    toggleTheater.mockClear()
    toggleReadingMode.mockClear()
    toggleNotesWithFocus.mockClear()
    setHasNotes.mockClear()
    setItemStatus.mockClear()
    toggleAutoPlay.mockClear()
  })

  // -- Happy path: all tools render -------------------------------------------

  it('renders all tool buttons on a lesson route', async () => {
    render(<LessonHeaderTools />)

    await waitFor(() => {
      expect(screen.getByTestId('qa-chat-panel')).toBeInTheDocument()
    })

    expect(screen.getByTestId('pomodoro-timer')).toBeInTheDocument()
    expect(screen.getByTestId('reading-mode-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('theater-mode-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('notes-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('completion-toggle')).toBeInTheDocument()
  })

  // -- Theater toggle ---------------------------------------------------------

  it('calls toggleTheater when theater button is clicked', () => {
    render(<LessonHeaderTools />)
    fireEvent.click(screen.getByTestId('theater-mode-toggle'))
    expect(toggleTheater).toHaveBeenCalledTimes(1)
  })

  it('shows Minimize2 icon when theater mode is active', () => {
    mockIsTheater = true
    render(<LessonHeaderTools />)
    const btn = screen.getByTestId('theater-mode-toggle')
    expect(btn.getAttribute('aria-label')).toContain('Exit theater mode')
  })

  it('shows Maximize2 icon when theater mode is inactive', () => {
    mockIsTheater = false
    render(<LessonHeaderTools />)
    const btn = screen.getByTestId('theater-mode-toggle')
    expect(btn.getAttribute('aria-label')).toContain('Enter theater mode')
  })

  // -- Notes toggle -----------------------------------------------------------

  it('calls toggleNotesWithFocus when notes button is clicked', () => {
    render(<LessonHeaderTools />)
    fireEvent.click(screen.getByTestId('notes-toggle'))
    expect(toggleNotesWithFocus).toHaveBeenCalledTimes(1)
  })

  it('sets aria-expanded on notes button based on notesOpen', () => {
    mockNotesOpen = true
    render(<LessonHeaderTools />)
    expect(screen.getByTestId('notes-toggle').getAttribute('aria-expanded')).toBe('true')
  })

  // -- Completion dropdown ----------------------------------------------------

  it('shows current completion status from store', () => {
    mockItemStatus = 'in-progress'
    render(<LessonHeaderTools />)
    const btn = screen.getByTestId('completion-toggle')
    expect(btn.getAttribute('aria-label')).toContain('In Progress')
  })

  it('shows "Not Started" as default status', () => {
    mockItemStatus = 'not-started'
    render(<LessonHeaderTools />)
    const btn = screen.getByTestId('completion-toggle')
    expect(btn.getAttribute('aria-label')).toContain('Not Started')
  })

  // -- Guest user -------------------------------------------------------------

  it('hides completion dropdown for guest users', () => {
    setGuestMode(true)
    render(<LessonHeaderTools />)
    expect(screen.queryByTestId('completion-toggle')).not.toBeInTheDocument()
  })

  it('shows other tools when guest user (completion hidden)', async () => {
    setGuestMode(true)
    render(<LessonHeaderTools />)

    await waitFor(() => {
      expect(screen.getByTestId('qa-chat-panel')).toBeInTheDocument()
    })

    expect(screen.getByTestId('pomodoro-timer')).toBeInTheDocument()
    expect(screen.getByTestId('reading-mode-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('theater-mode-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('notes-toggle')).toBeInTheDocument()
  })

  // -- data-theater-hide attribute --------------------------------------------

  it('wraps all tools in a data-theater-hide container', () => {
    render(<LessonHeaderTools />)
    const container = screen.getByTestId('pomodoro-timer').closest('[data-theater-hide]')
    expect(container).toBeInTheDocument()
  })

  // -- Reading mode toggle ----------------------------------------------------

  it('sets aria-pressed on reading mode button', () => {
    mockIsReadingMode = true
    render(<LessonHeaderTools />)
    expect(screen.getByTestId('reading-mode-toggle').getAttribute('aria-pressed')).toBe('true')
  })

  it('calls toggleReadingMode when reading mode button is clicked', () => {
    render(<LessonHeaderTools />)
    fireEvent.click(screen.getByTestId('reading-mode-toggle'))
    expect(toggleReadingMode).toHaveBeenCalledTimes(1)
  })

  // -- Auto-play toggle --------------------------------------------------------

  it('renders auto-play toggle with aria-pressed="true" when autoPlay is ON', () => {
    mockAutoPlay = true
    render(<LessonHeaderTools />)
    expect(screen.getByTestId('autoplay-toggle').getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('renders auto-play toggle with aria-pressed="false" when autoPlay is OFF', () => {
    mockAutoPlay = false
    render(<LessonHeaderTools />)
    expect(screen.getByTestId('autoplay-toggle').getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('calls toggleAutoPlay when auto-play button is clicked', () => {
    render(<LessonHeaderTools />)
    fireEvent.click(screen.getByTestId('autoplay-toggle'))
    expect(toggleAutoPlay).toHaveBeenCalledTimes(1)
  })

  it('shows "Auto-play: On" tooltip when autoPlay is ON', () => {
    mockAutoPlay = true
    render(<LessonHeaderTools />)
    expect(screen.getByTestId('autoplay-toggle').getAttribute('aria-label')).toBe(
      'Auto-play is on',
    )
  })

  it('shows "Auto-play: Off" tooltip when autoPlay is OFF', () => {
    mockAutoPlay = false
    render(<LessonHeaderTools />)
    expect(screen.getByTestId('autoplay-toggle').getAttribute('aria-label')).toBe(
      'Auto-play is off',
    )
  })
})
