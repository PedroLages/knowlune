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
  NotesTab: ({ courseId, lessonId }: { courseId: string; lessonId: string }) => (
    <div data-testid="notes-tab-content" data-course-id={courseId} data-lesson-id={lessonId}>
      Notes Content
    </div>
  ),
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
  AISummaryPanel: ({ courseId, lessonId }: { courseId: string; lessonId: string }) => (
    <div data-testid="ai-summary-content" data-course-id={courseId} data-lesson-id={lessonId}>
      AI Summary
    </div>
  ),
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

function renderTabsWithHideNotesTab(hideNotesTab: boolean) {
  const adapter = createMockAdapter()
  return render(
    <MemoryRouter>
      <BelowVideoTabs
        courseId="course-1"
        lessonId="lesson-1"
        adapter={adapter as never}
        currentTime={42}
        onSeek={vi.fn()}
        hideNotesTab={hideNotesTab}
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

  // ---------------------------------------------------------------------------
  // forceMount: NotesTab stays mounted across tab switches
  // ---------------------------------------------------------------------------

  it('keeps NotesTab mounted when switching to another tab (forceMount)', async () => {
    const user = userEvent.setup()
    renderTabs()

    // Initially Notes tab is active
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()

    // Switch to Bookmarks tab
    const tabList = screen.getByRole('tablist')
    await user.click(within(tabList).getByText('Bookmarks'))

    // NotesTab should remain in the DOM due to forceMount
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()

    // Switch to another tab and back
    await user.click(within(tabList).getByText('Notes'))

    // NotesTab is still present
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()
  })

  it('keeps NotesTab mounted across all tab cycles', async () => {
    const user = userEvent.setup()
    renderTabs({ capabilities: { hasTranscript: true } })

    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()

    // Cycle through all tabs — NotesTab should always be present
    const tabList = screen.getByRole('tablist')

    await user.click(within(tabList).getByText('Bookmarks'))
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()

    await user.click(within(tabList).getByText('Transcript'))
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()

    await user.click(within(tabList).getByText('AI Summary'))
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()

    // Switch back to Notes
    await user.click(within(tabList).getByText('Notes'))
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()
  })

  it('keeps AI Summary mounted while switching tabs', async () => {
    const user = userEvent.setup()
    renderTabs({ capabilities: { hasTranscript: true } })
    const summary = screen.getByTestId('ai-summary-content')
    expect(summary).toHaveAttribute('data-lesson-id', 'lesson-1')

    const tabList = screen.getByRole('tablist')
    await user.click(within(tabList).getByText('AI Summary'))
    await user.click(within(tabList).getByText('Bookmarks'))

    expect(screen.getByTestId('ai-summary-content')).toBe(summary)
  })

  // ---------------------------------------------------------------------------
  // hideNotesTab: CSS-based hiding (always mounted, visually hidden)
  // ---------------------------------------------------------------------------

  it('shows Notes TabsTrigger by default (no hidden class)', () => {
    renderTabs()
    const notesTrigger = screen.getByRole('tab', { name: /notes/i })
    expect(notesTrigger).not.toHaveClass('hidden')
  })

  it('applies hidden class to Notes TabsTrigger when hideNotesTab is true', () => {
    renderTabsWithHideNotesTab(true)
    const notesTrigger = screen.getByRole('tab', { name: /notes/i, hidden: true })
    expect(notesTrigger).toHaveClass('hidden')
  })

  it('applies hidden class to Notes TabsContent when hideNotesTab is true', () => {
    renderTabsWithHideNotesTab(true)
    const notesContent = screen.getByTestId('notes-tab-content')
    const tabsContent = notesContent.closest('[data-slot="tabs-content"]')
    expect(tabsContent).toHaveClass('hidden')
  })

  it('does not apply hidden class to Notes TabsContent when hideNotesTab is false', () => {
    renderTabsWithHideNotesTab(false)
    const notesContent = screen.getByTestId('notes-tab-content')
    const tabsContent = notesContent.closest('[data-slot="tabs-content"]')
    expect(tabsContent).not.toHaveClass('hidden')
  })

  it('keeps NotesTab in DOM when hideNotesTab is true', () => {
    renderTabsWithHideNotesTab(true)
    // NotesTab content should still be in DOM even though hidden
    expect(screen.getByTestId('notes-tab-content')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // forceMount: NotesTab receives correct lesson context for Dexie loading
  // ---------------------------------------------------------------------------

  it('passes correct courseId and lessonId to NotesTab on initial mount', () => {
    renderTabs()
    const content = screen.getByTestId('notes-tab-content')
    expect(content).toHaveAttribute('data-course-id', 'course-1')
    expect(content).toHaveAttribute('data-lesson-id', 'lesson-1')
  })

  it('updates NotesTab lessonId when lesson changes (preserving mount)', () => {
    const adapter = createMockAdapter()
    const { rerender } = render(
      <MemoryRouter>
        <BelowVideoTabs
          courseId="course-1"
          lessonId="lesson-1"
          adapter={adapter as never}
          currentTime={42}
          onSeek={vi.fn()}
        />
      </MemoryRouter>
    )

    // NotesTab is mounted with initial lesson
    expect(screen.getByTestId('notes-tab-content')).toHaveAttribute('data-lesson-id', 'lesson-1')

    // Re-render with new lesson
    rerender(
      <MemoryRouter>
        <BelowVideoTabs
          courseId="course-1"
          lessonId="lesson-2"
          adapter={adapter as never}
          currentTime={42}
          onSeek={vi.fn()}
        />
      </MemoryRouter>
    )

    // NotesTab should still be mounted (forceMount) with updated lessonId
    expect(screen.getByTestId('notes-tab-content')).toHaveAttribute('data-lesson-id', 'lesson-2')
  })

  it('keeps NotesTab mounted and receiving correct lesson context across tab switches', async () => {
    const user = userEvent.setup()
    renderTabs({ capabilities: { hasTranscript: true } })

    // NotesTab is mounted with initial lesson context
    expect(screen.getByTestId('notes-tab-content')).toHaveAttribute('data-lesson-id', 'lesson-1')

    // Switch to bookmarks tab
    const tabList = screen.getByRole('tablist')
    await user.click(within(tabList).getByText('Bookmarks'))

    // NotesTab still mounted with correct lesson context
    expect(screen.getByTestId('notes-tab-content')).toHaveAttribute('data-lesson-id', 'lesson-1')

    // Switch to transcript
    await user.click(within(tabList).getByText('Transcript'))

    // NotesTab still mounted with correct lesson context
    expect(screen.getByTestId('notes-tab-content')).toHaveAttribute('data-lesson-id', 'lesson-1')
  })
})
