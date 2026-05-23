import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotesTab } from '../tabs/NotesTab'

vi.mock('@/app/components/notes/NoteEditor', () => ({
  NoteEditor: ({ fillHeight }: { fillHeight?: boolean }) => (
    <div data-testid="note-editor" data-fill-height={fillHeight ? 'true' : 'false'} />
  ),
}))

vi.mock('@/stores/useNoteStore', () => ({
  useNoteStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      notes: [],
      loadNotesByLesson: vi.fn(),
      saveNote: vi.fn(),
      addNote: vi.fn(),
      isLoading: false,
      pendingNoteLinkSuggestions: null,
      clearPendingNoteLinkSuggestions: vi.fn(),
    }),
}))

vi.mock('@/db', () => ({
  db: { importedVideos: { get: vi.fn().mockResolvedValue(null) } },
}))

vi.mock('@/ai/knowledgeGaps/noteLinkSuggestions', () => ({
  acceptNoteLinkSuggestion: vi.fn(),
  dismissNoteLinkPair: vi.fn(),
}))

describe('NotesTab fillHeight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes fillHeight prop to NoteEditor when enabled', () => {
    render(<NotesTab courseId="c1" lessonId="l1" fillHeight />)

    const editor = screen.getByTestId('note-editor')
    expect(editor.getAttribute('data-fill-height')).toBe('true')
  })

  it('does not pass fillHeight to NoteEditor by default', () => {
    render(<NotesTab courseId="c1" lessonId="l1" />)

    const editor = screen.getByTestId('note-editor')
    expect(editor.getAttribute('data-fill-height')).toBe('false')
  })
})

describe('NotesTab fillHeight loading skeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders flex-1 skeleton when fillHeight and loading', async () => {
    vi.resetModules()
    vi.doMock('@/stores/useNoteStore', () => ({
      useNoteStore: (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
          notes: [],
          loadNotesByLesson: vi.fn(),
          saveNote: vi.fn(),
          addNote: vi.fn(),
          isLoading: true,
          pendingNoteLinkSuggestions: null,
          clearPendingNoteLinkSuggestions: vi.fn(),
        }),
    }))
    vi.doMock('@/app/components/notes/NoteEditor', () => ({
      NoteEditor: () => <div data-testid="note-editor" />,
    }))
    vi.doMock('@/db', () => ({ db: { importedVideos: { get: vi.fn().mockResolvedValue(null) } } }))
    vi.doMock('@/ai/knowledgeGaps/noteLinkSuggestions', () => ({
      acceptNoteLinkSuggestion: vi.fn(),
      dismissNoteLinkPair: vi.fn(),
    }))

    const { NotesTab: LoadingNotesTab } = await import('../tabs/NotesTab')
    const { container } = render(<LoadingNotesTab courseId="c1" lessonId="l1" fillHeight />)

    const root = container.firstElementChild
    expect(root?.className).toContain('flex-1')
    expect(root?.className).toContain('min-h-0')
    const editorSkeleton = root?.querySelector('.min-h-\\[250px\\]')
    expect(editorSkeleton).toBeTruthy()
  })
})
