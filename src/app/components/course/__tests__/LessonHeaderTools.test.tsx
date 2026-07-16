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
import type { ButtonHTMLAttributes, ReactNode } from 'react'
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
  selectIsGuestMode: (s: { initialized: boolean; user: unknown }) => !s.initialized || !s.user,
}))

vi.mock('@/app/components/figma/PomodoroTimer', () => ({
  PomodoroTimer: () => <div data-testid="pomodoro-timer">Pomodoro</div>,
}))

vi.mock('@/app/components/figma/QAChatPanel', () => ({
  QAChatPanel: () => <div data-testid="qa-chat-panel">QA Chat</div>,
}))

// Keep this component test focused on lesson actions rather than Radix portal mechanics.
vi.mock('@/app/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({
    children,
    onSelect,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
}))

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function setGuestMode(guest: boolean) {
  mockIsGuest = guest
}

function openMoreMenu() {
  fireEvent.pointerDown(screen.getByTestId('tablet-kebab-trigger'), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
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
    expect(screen.getByTestId('tablet-kebab-trigger')).toHaveAccessibleName('More lesson tools')
    expect(screen.getByTestId('notes-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('completion-toggle')).toBeInTheDocument()

    openMoreMenu()
    expect(screen.getByTestId('kebab-reading-mode')).toBeInTheDocument()
    expect(screen.getByTestId('kebab-theater-mode')).toBeInTheDocument()
    expect(screen.getByTestId('kebab-autoplay')).toBeInTheDocument()
    expect(screen.getByTestId('kebab-qa-panel')).toBeInTheDocument()
  })

  // -- Theater toggle ---------------------------------------------------------

  it('calls toggleTheater when theater button is clicked', () => {
    render(<LessonHeaderTools />)
    openMoreMenu()
    fireEvent.click(screen.getByTestId('kebab-theater-mode'))
    expect(toggleTheater).toHaveBeenCalledTimes(1)
  })

  it('shows an exit action when theater mode is active', () => {
    mockIsTheater = true
    render(<LessonHeaderTools />)
    openMoreMenu()
    expect(screen.getByTestId('kebab-theater-mode')).toHaveTextContent('Exit Theater')
  })

  it('shows an enter action when theater mode is inactive', () => {
    mockIsTheater = false
    render(<LessonHeaderTools />)
    openMoreMenu()
    expect(screen.getByTestId('kebab-theater-mode')).toHaveTextContent('Theater Mode')
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
    expect(screen.getByTestId('notes-toggle')).toBeInTheDocument()
    openMoreMenu()
    expect(screen.getByTestId('kebab-reading-mode')).toBeInTheDocument()
    expect(screen.getByTestId('kebab-theater-mode')).toBeInTheDocument()
  })

  // -- data-theater-hide attribute --------------------------------------------

  it('wraps all tools in a data-theater-hide container', () => {
    render(<LessonHeaderTools />)
    const container = screen.getByTestId('pomodoro-timer').closest('[data-theater-hide]')
    expect(container).toBeInTheDocument()
  })

  // -- Reading mode toggle ----------------------------------------------------

  it('shows an exit action when reading mode is active', () => {
    mockIsReadingMode = true
    render(<LessonHeaderTools />)
    openMoreMenu()
    expect(screen.getByTestId('kebab-reading-mode')).toHaveTextContent('Exit Reading Mode')
  })

  it('calls toggleReadingMode when reading mode button is clicked', () => {
    render(<LessonHeaderTools />)
    openMoreMenu()
    fireEvent.click(screen.getByTestId('kebab-reading-mode'))
    expect(toggleReadingMode).toHaveBeenCalledTimes(1)
  })

  // -- Auto-play toggle --------------------------------------------------------

  it('shows auto-play as on in the More menu', () => {
    mockAutoPlay = true
    render(<LessonHeaderTools />)
    openMoreMenu()
    expect(screen.getByTestId('kebab-autoplay')).toHaveTextContent('Auto-play: On')
  })

  it('shows auto-play as off in the More menu', () => {
    mockAutoPlay = false
    render(<LessonHeaderTools />)
    openMoreMenu()
    expect(screen.getByTestId('kebab-autoplay')).toHaveTextContent('Auto-play: Off')
  })

  it('calls toggleAutoPlay when auto-play button is clicked', () => {
    render(<LessonHeaderTools />)
    openMoreMenu()
    fireEvent.click(screen.getByTestId('kebab-autoplay'))
    expect(toggleAutoPlay).toHaveBeenCalledTimes(1)
  })

  it('labels auto-play as on when autoPlay is ON', () => {
    mockAutoPlay = true
    render(<LessonHeaderTools />)
    openMoreMenu()
    expect(screen.getByTestId('kebab-autoplay')).toHaveAccessibleName('Auto-play: On')
  })

  it('labels auto-play as off when autoPlay is OFF', () => {
    mockAutoPlay = false
    render(<LessonHeaderTools />)
    openMoreMenu()
    expect(screen.getByTestId('kebab-autoplay')).toHaveAccessibleName('Auto-play: Off')
  })
})
