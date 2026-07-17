/**
 * NoteEditor — Unit tests for the rich-text NoteEditor component.
 *
 * Verifies:
 * - Eager-first-save: doSave is called immediately on first content change
 * - Debounced save: subsequent changes use debounce
 * - Unmount cleanup: pending saves are well-guarded
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, fireEvent, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock state shared between test setup and the mocked modules
// ---------------------------------------------------------------------------

let mockOnUpdate: (({ editor }: { editor: any }) => void) | null = null
let mockOnCreate: (({ editor }: { editor: any }) => void) | null = null
let mockGetHtml = vi.fn().mockReturnValue('<p>initial</p>')

function createMockEditor() {
  return {
    isDestroyed: false,
    getHTML: mockGetHtml,
    isEmpty: false,
    isActive: () => false,
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        run: vi.fn(),
        setContent: () => ({ run: vi.fn() }),
      }),
    }),
    commands: { setContent: vi.fn() },
    state: { selection: { from: 0, to: 0 }, doc: { textBetween: () => '' } },
    storage: {
      characterCount: { words: () => 0 },
      frameCapture: {},
    },
    view: {
      dom: document.createElement('div'),
    },
    on: vi.fn(),
    off: vi.fn(),
    getAttributes: () => ({}),
    can: () => true,
    isEditable: true,
  }
}

let mockEditor: ReturnType<typeof createMockEditor> | null = null

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(({ onUpdate, onCreate }: { onUpdate?: any; onCreate?: any }) => {
    mockOnUpdate = onUpdate ?? null
    mockOnCreate = onCreate ?? null
    mockEditor ??= createMockEditor()
    return mockEditor
  }),
  EditorContent: () => <div data-testid="mock-editor-content" />,
  ReactNodeViewRenderer: () => () => null,
  useCurrentEditor: () => ({ editor: null }),
  BubbleMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

/** Create a chainable Tiptap extension mock that supports both .configure() and .extend() */
function chainableExt() {
  const ext: any = {}
  ext.configure = () => ext
  ext.extend = () => ext
  return ext
}

// All Tiptap extensions — NoteEditor.tsx calls .configure() and .extend()
// on these at render time (before passing to useEditor, which is our mock).
vi.mock('@tiptap/starter-kit', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-placeholder', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-highlight', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-task-list', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-task-item', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-typography', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-character-count', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-text-align', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-code-block-lowlight', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-image', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-file-handler', () => ({ FileHandler: chainableExt() }))
vi.mock('@tiptap/extension-youtube', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-details', () => ({
  Details: chainableExt(),
  DetailsContent: {},
  DetailsSummary: {},
}))
vi.mock('@tiptap/extension-color', () => ({ default: chainableExt() }))
vi.mock('@tiptap/extension-text-style', () => ({
  TextStyle: chainableExt(),
  default: chainableExt(),
}))
vi.mock('@tiptap/extension-emoji', () => ({ Emoji: chainableExt(), emojis: [] }))
vi.mock('@tiptap/extension-drag-handle-react', () => ({
  DragHandle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Table extensions
vi.mock('@tiptap/extension-table-of-contents', () => ({ TableOfContents: chainableExt() }))
vi.mock('@tiptap/extension-table', () => ({ TableKit: chainableExt() }))

// Lowlight + syntax highlighting
vi.mock('lowlight', () => ({ createLowlight: () => ({}) }))
vi.mock('highlight.js/lib/languages/javascript', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/typescript', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/python', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/css', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/xml', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/bash', () => ({ default: {} }))

// sonner toast
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }))

// Local modules — heavy components that NoteEditor renders
vi.mock('../CodeBlockView', () => ({ CodeBlockView: () => null }))
vi.mock('../BubbleMenuBar', () => ({ BubbleMenuBar: () => null }))
vi.mock('../CreateFlashcardDialog', () => ({ CreateFlashcardDialog: () => null }))

// Slash command modules
vi.mock('../slash-command', () => ({
  SlashCommand: { configure: () => ({}) },
  getSlashCommandItems: () => [],
}))
vi.mock('../slash-command/suggestion-render', () => ({ createSlashCommandRender: () => ({}) }))
vi.mock('../emoji-suggestion-render', () => ({ createEmojiSuggestionRender: () => ({}) }))

// Search/replace
vi.mock('../search-replace', () => ({
  SearchReplace: {},
  FindReplacePanel: () => null,
}))

// Table of Contents
vi.mock('../TableOfContentsPanel', () => ({ TableOfContentsPanel: () => null }))
vi.mock('../TableGridPicker', () => ({ TableGridPicker: () => null }))
vi.mock('../TableContextMenu', () => ({
  TableContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Frame capture extension
vi.mock('../frame-capture', () => ({ FrameCaptureExtension: {} }))

// Markdown extension
vi.mock('@tiptap/markdown', () => ({ Markdown: chainableExt() }))

// Paste markdown extension
vi.mock('../paste-markdown', () => ({ PasteMarkdown: {} }))

// External utilities
vi.mock('@/lib/format', () => ({ formatTimestamp: () => '00:00' }))
vi.mock('@/lib/noteExport', () => ({
  exportSingleNoteAsMarkdown: () => ({ content: '', filename: '' }),
}))
vi.mock('@/lib/download', () => ({ downloadAsFile: vi.fn() }))

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { NoteEditor } from '../NoteEditor'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NoteEditor — eager-first-save (finding 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpdate = null
    mockOnCreate = null
    mockGetHtml = vi.fn().mockReturnValue('<p>initial</p>')
    mockEditor = null
  })

  afterEach(() => {
    mockOnUpdate = null
    mockOnCreate = null
  })

  it('calls onSave immediately on first content change (eager-first-save)', async () => {
    const onSave = vi.fn()
    render(<NoteEditor courseId="c1" lessonId="l1" onSave={onSave} />)

    // Wait for component to mount: useEditor was called
    await vi.waitFor(() => {
      expect(mockOnCreate).not.toBeNull()
    })

    // Fire the onCreate callback to set initial word count
    act(() => {
      mockOnCreate?.({ editor: { storage: { characterCount: { words: () => 0 } } } } as any)
    })

    // Simulate first content change — user types something new
    act(() => {
      mockGetHtml.mockReturnValue('<p>new content</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 2 } }, getHTML: mockGetHtml },
      } as any)
    })

    // onSave should have been called immediately (no debounce wait)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('<p>new content</p>', [])
  })

  it('does not call onSave when content matches last saved content on first update', async () => {
    const onSave = vi.fn()
    render(
      <NoteEditor courseId="c1" lessonId="l1" initialContent="<p>initial</p>" onSave={onSave} />
    )

    await vi.waitFor(() => {
      expect(mockOnCreate).not.toBeNull()
    })

    act(() => {
      mockOnCreate?.({ editor: { storage: { characterCount: { words: () => 1 } } } } as any)
    })

    // Simulate onUpdate with content that matches initial (content was set by
    // the lesson-change effect before onUpdate fires — see lines 432-442)
    act(() => {
      mockGetHtml.mockReturnValue('<p>initial</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 1 } }, getHTML: mockGetHtml },
      } as any)
    })

    // onSave should NOT be called because content matches
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not persist TipTap empty markup before the learner types', async () => {
    mockGetHtml = vi.fn().mockReturnValue('<p></p>')
    const onSave = vi.fn()
    render(<NoteEditor courseId="c1" lessonId="l1" onSave={onSave} />)

    await vi.waitFor(() => expect(mockOnUpdate).not.toBeNull())
    act(() => {
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 0 } }, getHTML: mockGetHtml },
      } as any)
    })
    expect(onSave).not.toHaveBeenCalled()

    act(() => {
      mockGetHtml.mockReturnValue('<p>actual learner note</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 3 } }, getHTML: mockGetHtml },
      } as any)
    })

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith('<p>actual learner note</p>', [])
  })

  it('calls onSave with extracted tags on first change', async () => {
    const onSave = vi.fn()
    render(<NoteEditor courseId="c1" lessonId="l1" onSave={onSave} />)

    await vi.waitFor(() => {
      expect(mockOnCreate).not.toBeNull()
    })

    act(() => {
      mockOnCreate?.({ editor: { storage: { characterCount: { words: () => 0 } } } } as any)
    })

    // Simulate typing content with hashtags
    act(() => {
      mockGetHtml.mockReturnValue('<p>learning about #react and #typescript</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 4 } }, getHTML: mockGetHtml },
      } as any)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(
      '<p>learning about #react and #typescript</p>',
      expect.arrayContaining(['react', 'typescript'])
    )
  })

  it('defers subsequent saves via debounce after the eager-first-save', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn()
    render(<NoteEditor courseId="c1" lessonId="l1" onSave={onSave} />)

    await vi.waitFor(() => {
      expect(mockOnCreate).not.toBeNull()
    })

    act(() => {
      mockOnCreate?.({ editor: { storage: { characterCount: { words: () => 0 } } } } as any)
      // First change — eager save fires immediately
      mockGetHtml.mockReturnValue('<p>first</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 1 } }, getHTML: mockGetHtml },
      } as any)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('<p>first</p>', [])
    onSave.mockClear()

    // Second change — should be debounced, not immediate
    act(() => {
      mockGetHtml.mockReturnValue('<p>second</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 1 } }, getHTML: mockGetHtml },
      } as any)
    })

    // onSave should NOT have been called again yet (debounce hasn't fired)
    expect(onSave).toHaveBeenCalledTimes(0)

    // Advance past the 3-second debounce
    act(() => {
      vi.advanceTimersByTime(3500)
    })

    // Now onSave should have been called with the second content
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('<p>second</p>', [])

    vi.useRealTimers()
  })

  it('announces Saving before an async write resolves, then Saved', async () => {
    let resolveSave: (() => void) | undefined
    const onSave = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSave = resolve
        })
    )
    render(<NoteEditor courseId="c1" lessonId="l1" onSave={onSave} />)

    await vi.waitFor(() => expect(mockOnCreate).not.toBeNull())
    act(() => {
      mockGetHtml.mockReturnValue('<p>pending content</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 2 } }, getHTML: mockGetHtml },
      } as any)
    })

    expect(screen.getByTestId('note-autosave-indicator')).toHaveTextContent('Saving…')
    await act(async () => resolveSave?.())
    expect(screen.getByTestId('note-autosave-indicator')).toHaveTextContent('Saved')
  })

  it('shows a persistent retry action when the async write fails', async () => {
    const onSave = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(undefined)
    render(<NoteEditor courseId="c1" lessonId="l1" onSave={onSave} />)

    await vi.waitFor(() => expect(mockOnCreate).not.toBeNull())
    act(() => {
      mockGetHtml.mockReturnValue('<p>retry content</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 2 } }, getHTML: mockGetHtml },
      } as any)
    })

    expect(await screen.findByText('Not saved')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('flushes pending content to the previous lesson when the keyed editor changes', async () => {
    vi.useFakeTimers()
    const saveLessonOne = vi.fn().mockResolvedValue(undefined)
    const saveLessonTwo = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <NoteEditor
        key="c1:l1"
        courseId="c1"
        lessonId="l1"
        noteId="note-1"
        initialContent="<p>initial</p>"
        onSave={saveLessonOne}
      />
    )

    act(() => {
      mockGetHtml.mockReturnValue('<p>lesson one draft</p>')
      mockOnUpdate?.({
        editor: { storage: { characterCount: { words: () => 3 } }, getHTML: mockGetHtml },
      } as any)
    })

    expect(saveLessonOne).not.toHaveBeenCalled()

    rerender(
      <NoteEditor
        key="c1:l2"
        courseId="c1"
        lessonId="l2"
        initialContent=""
        onSave={saveLessonTwo}
      />
    )

    expect(saveLessonOne).toHaveBeenCalledWith('<p>lesson one draft</p>', [])
    expect(saveLessonTwo).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
