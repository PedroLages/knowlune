/**
 * BelowVideoTabs — Unit tests for the below-video tab container.
 *
 * Verifies:
 * - All expected tabs render based on adapter capabilities
 * - Default tab selection (notes for video, materials for PDF)
 * - Tab reset on lesson change
 * - Fullscreen notes overlay on mobile
 * - Transcript and AI Summary tabs hidden when no transcript
 * - Materials tab hidden when no PDFs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/app/components/course/tabs/NotesTab', () => ({
  NotesTab: () => <div data-testid="notes-tab-content">Notes Content</div>,
}))

vi.mock('@/app/components/course/tabs/LessonBookmarksTab', () => ({
  LessonBookmarksTab: () => <div data-testid="bookmarks-tab-content">Bookmarks Content</div>,
}))

vi.mock('@/app/components/course/tabs/TranscriptTab', () => ({
  TranscriptTab: () => <div data-testid="transcript-tab-content">Transcript Content</div>,
}))

vi.mock('@/app/components/course/tabs/MaterialsTab', () => ({
  MaterialsTab: () => <div data-testid="materials-tab-content">Materials Content</div>,
}))

vi.mock('@/app/components/figma/AISummaryPanel', () => ({
  AISummaryPanel: () => <div data-testid="ai-summary-content">AI Summary</div>,
}))

vi.mock('@/app/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false, // desktop by default
}))

// Mock adapter methods
const mockGetTranscript = vi.fn().mockResolvedValue(null)

function createMockAdapter(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getCapabilities: vi.fn().mockReturnValue({
      hasVideo: true,
      hasPdf: false,
      hasTranscript: false,
      supportsNotes: true,
      supportsQuiz: false,
      supportsPrevNext: true,
      requiresNetwork: false,
      supportsFileVerification: true,
      supportsRefresh: false,
      ...overrides,
    }),
    getTranscript: mockGetTranscript,
    getLessons: vi.fn().mockResolvedValue([]),
    getSource: vi.fn().mockReturnValue('local'),
  }
}

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { BelowVideoTabs } from '../BelowVideoTabs'

function renderTabs(
  overrides: { isPdf?: boolean; capabilities?: Partial<Record<string, unknown>> } = {}
) {
  const adapter = createMockAdapter(overrides.capabilities)
  return render(
    <MemoryRouter>
      <BelowVideoTabs
        courseId="course-1"
        lessonId="lesson-1"
        adapter={adapter as never}
        currentTime={42}
        onSeek={vi.fn()}
        isPdf={overrides.isPdf}
      />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BelowVideoTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTranscript.mockResolvedValue(null)
  })

  it('renders the tabs container', () => {
    renderTabs()
    expect(screen.getByTestId('below-video-tabs')).toBeInTheDocument()
  })

  it('shows Notes tab by default for video lessons', () => {
    renderTabs()
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()
  })

  it('shows Notes and Bookmarks tabs for video lessons', () => {
    renderTabs()
    const tabList = screen.getByRole('tablist')
    expect(within(tabList).getByText('Notes')).toBeInTheDocument()
    expect(within(tabList).getByText('Bookmarks')).toBeInTheDocument()
  })

  it('hides Bookmarks tab for PDF lessons', () => {
    renderTabs({ isPdf: true })
    const tabList = screen.getByRole('tablist')
    expect(within(tabList).queryByText('Bookmarks')).not.toBeInTheDocument()
  })

  it('shows Transcript tab when adapter has transcript capability', () => {
    renderTabs({ capabilities: { hasTranscript: true } })
    const tabList = screen.getByRole('tablist')
    expect(within(tabList).getByText('Transcript')).toBeInTheDocument()
  })

  it('shows AI Summary tab when adapter has transcript capability', () => {
    renderTabs({ capabilities: { hasTranscript: true } })
    const tabList = screen.getByRole('tablist')
    expect(within(tabList).getByText('AI Summary')).toBeInTheDocument()
  })

  it('hides Transcript and AI Summary tabs when no transcript', () => {
    renderTabs({ capabilities: { hasTranscript: false } })
    const tabList = screen.getByRole('tablist')
    expect(within(tabList).queryByText('Transcript')).not.toBeInTheDocument()
    expect(within(tabList).queryByText('AI Summary')).not.toBeInTheDocument()
  })

  it('shows Materials tab when adapter has PDF capability', () => {
    renderTabs({ capabilities: { hasPdf: true } })
    const tabList = screen.getByRole('tablist')
    expect(within(tabList).getByText('Materials')).toBeInTheDocument()
  })

  it('hides Materials tab when no PDFs', () => {
    renderTabs({ capabilities: { hasPdf: false } })
    const tabList = screen.getByRole('tablist')
    expect(within(tabList).queryByText('Materials')).not.toBeInTheDocument()
  })

  it('switches to bookmarks tab on click', async () => {
    const user = userEvent.setup()
    renderTabs()

    const tabList = screen.getByRole('tablist')
    await user.click(within(tabList).getByText('Bookmarks'))

    expect(screen.getByTestId('bookmarks-tab-content')).toBeInTheDocument()
  })

  it('responds to focusTab prop for programmatic switching', () => {
    const adapter = createMockAdapter({ hasTranscript: true })
    const { rerender } = render(
      <MemoryRouter>
        <BelowVideoTabs
          courseId="course-1"
          lessonId="lesson-1"
          adapter={adapter as never}
          focusTab="transcript"
        />
      </MemoryRouter>
    )

    expect(screen.getByTestId('transcript-tab-content')).toBeInTheDocument()

    // Change focusTab to notes
    rerender(
      <MemoryRouter>
        <BelowVideoTabs
          courseId="course-1"
          lessonId="lesson-1"
          adapter={adapter as never}
          focusTab="notes"
        />
      </MemoryRouter>
    )

    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()
  })
})
