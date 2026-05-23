import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotesPanel } from '../NotesPanel'

vi.mock('../tabs/NotesTab', () => ({
  NotesTab: ({ fillHeight }: { fillHeight?: boolean }) => (
    <div data-testid="notes-tab" data-fill-height={fillHeight ? 'true' : 'false'} />
  ),
}))

vi.mock('@/stores/useLessonChromeStore', () => ({
  useLessonChromeStore: (selector: (s: { pendingNoteFocus: boolean; clearPendingNoteFocus: () => void }) => unknown) =>
    selector({ pendingNoteFocus: false, clearPendingNoteFocus: vi.fn() }),
}))

describe('NotesPanel', () => {
  const defaultProps = {
    courseId: 'course-1',
    lessonId: 'lesson-1',
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders flex column shell without outer ScrollArea', () => {
    render(<NotesPanel {...defaultProps} />)

    const shell = document.getElementById('lesson-notes-panel')
    expect(shell).toBeInTheDocument()
    expect(shell?.className).toContain('flex')
    expect(shell?.className).toContain('flex-col')
    expect(shell?.className).toContain('overflow-hidden')
  })

  it('has id="lesson-notes-panel" on outer shell', () => {
    render(<NotesPanel {...defaultProps} />)
    expect(document.getElementById('lesson-notes-panel')).toBeInTheDocument()
  })

  it('passes fillHeight to NotesTab', () => {
    render(<NotesPanel {...defaultProps} />)

    const notesTab = screen.getByTestId('notes-tab')
    expect(notesTab.getAttribute('data-fill-height')).toBe('true')
  })

  it('uses viewport height cap for non-theater mode', () => {
    render(<NotesPanel {...defaultProps} />)

    const shell = document.getElementById('lesson-notes-panel')
    expect(shell?.className).toContain('max-h-[calc(100svh-3rem)]')
  })

  it('uses theater height cap when isTheater is true', () => {
    render(<NotesPanel {...defaultProps} isTheater />)

    const shell = document.getElementById('lesson-notes-panel')
    expect(shell?.className).toContain('max-h-[calc(100svh-1rem)]')
  })
})
