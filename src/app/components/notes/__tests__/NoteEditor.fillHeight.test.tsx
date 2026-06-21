import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NoteEditor } from '../NoteEditor'

const mockEditor = {
  isDestroyed: false,
  isEmpty: true,
  isActive: () => false,
  getAttributes: () => ({}),
  getHTML: () => '<p></p>',
  chain: () => ({
    focus: () => ({
      toggleBold: () => ({ run: vi.fn() }),
      toggleItalic: () => ({ run: vi.fn() }),
      toggleUnderline: () => ({ run: vi.fn() }),
      toggleHighlight: () => ({ run: vi.fn() }),
      toggleHeading: () => ({ run: vi.fn() }),
      setTextAlign: () => ({ run: vi.fn() }),
      toggleBulletList: () => ({ run: vi.fn() }),
      toggleOrderedList: () => ({ run: vi.fn() }),
      toggleTaskList: () => ({ run: vi.fn() }),
      toggleCodeBlock: () => ({ run: vi.fn() }),
      setDetails: () => ({ run: vi.fn() }),
      insertTable: () => ({ run: vi.fn() }),
      setLink: () => ({ run: vi.fn() }),
      unsetLink: () => ({ run: vi.fn() }),
      setYoutubeVideo: () => ({ run: vi.fn() }),
      insertContent: () => ({ run: vi.fn() }),
      insertFrameCapture: () => ({ run: vi.fn() }),
      run: vi.fn(),
    }),
  }),
  commands: { setContent: vi.fn() },
  storage: {
    characterCount: { words: () => 0 },
    frameCapture: { onSeek: null },
  },
  state: {
    selection: { from: 0, to: 0 },
    doc: { textBetween: () => '' },
  },
  on: vi.fn(),
  off: vi.fn(),
  view: { dom: document.createElement('div') },
}

vi.mock('@tiptap/react', () => ({
  useEditor: () => mockEditor,
  EditorContent: () => <div data-testid="editor-content" />,
  ReactNodeViewRenderer: () => null,
}))

vi.mock('@tiptap/starter-kit', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-placeholder', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-highlight', () => ({ default: {} }))
vi.mock('@tiptap/extension-task-list', () => ({ default: {} }))
vi.mock('@tiptap/extension-task-item', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-typography', () => ({ default: {} }))
vi.mock('@tiptap/extension-character-count', () => ({ default: {} }))
vi.mock('@tiptap/extension-text-align', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-code-block-lowlight', () => ({
  default: { configure: () => ({ extend: () => ({}) }) },
}))
vi.mock('@tiptap/extension-image', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-file-handler', () => ({ FileHandler: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-youtube', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-details', () => ({
  Details: { extend: () => ({}) },
  DetailsContent: {},
  DetailsSummary: {},
}))
vi.mock('@tiptap/extension-color', () => ({ default: {} }))
vi.mock('@tiptap/extension-text-style', () => ({ TextStyle: {} }))
vi.mock('@tiptap/extension-emoji', () => ({ Emoji: { configure: () => ({}) }, emojis: [] }))
vi.mock('@tiptap/extension-table-of-contents', () => ({
  TableOfContents: { configure: () => ({}) },
}))
vi.mock('@tiptap/extension-table', () => ({ TableKit: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-drag-handle-react', () => ({
  DragHandle: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('lowlight', () => ({ createLowlight: () => ({}) }))
vi.mock('highlight.js/lib/languages/javascript', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/typescript', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/python', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/css', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/xml', () => ({ default: {} }))
vi.mock('highlight.js/lib/languages/bash', () => ({ default: {} }))

vi.mock('../CodeBlockView', () => ({ CodeBlockView: () => null }))
vi.mock('../BubbleMenuBar', () => ({ BubbleMenuBar: () => null }))
vi.mock('../CreateFlashcardDialog', () => ({ CreateFlashcardDialog: () => null }))
vi.mock('../slash-command', () => ({
  SlashCommand: { configure: () => ({}) },
  getSlashCommandItems: () => [],
}))
vi.mock('../slash-command/suggestion-render', () => ({ createSlashCommandRender: () => ({}) }))
vi.mock('../emoji-suggestion-render', () => ({ createEmojiSuggestionRender: () => ({}) }))
vi.mock('../search-replace', () => ({
  SearchReplace: {},
  FindReplacePanel: () => null,
}))
vi.mock('../TableOfContentsPanel', () => ({ TableOfContentsPanel: () => null }))
vi.mock('../TableGridPicker', () => ({ TableGridPicker: () => null }))
vi.mock('../TableContextMenu', () => ({
  TableContextMenu: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../frame-capture', () => ({ FrameCaptureExtension: {} }))

describe('NoteEditor fillHeight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies flex column layout classes when fillHeight is true', () => {
    render(<NoteEditor courseId="c1" lessonId="l1" fillHeight />)

    const root = screen.getByTestId('note-editor')
    expect(root.className).toContain('flex')
    expect(root.className).toContain('flex-col')
    expect(root.className).toContain('flex-1')
    expect(root.className).toContain('min-h-0')
    expect(root.className).toContain('h-full')
  })

  it('does not apply flex-1 on root when fillHeight is false', () => {
    render(<NoteEditor courseId="c1" lessonId="l1" />)

    const root = screen.getByTestId('note-editor')
    expect(root.className).not.toContain('flex-1')
    expect(root.className).not.toContain('h-full')
  })

  it('wraps editor body in scrollable flex container when fillHeight is true', () => {
    render(<NoteEditor courseId="c1" lessonId="l1" fillHeight />)

    const body = screen.getByTestId('note-editor-body')
    expect(body.className).toContain('flex-1')
    expect(body.className).toContain('min-h-0')
    expect(body.className).toContain('overflow-y-auto')
  })

  it('does not render editor body wrapper when fillHeight is false', () => {
    render(<NoteEditor courseId="c1" lessonId="l1" />)

    expect(screen.queryByTestId('note-editor-body')).not.toBeInTheDocument()
  })

  it('keeps toolbar and status bar in DOM when fillHeight is true', () => {
    render(<NoteEditor courseId="c1" lessonId="l1" fillHeight />)

    expect(screen.getByTestId('note-editor-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('note-word-count')).toBeInTheDocument()
  })

  describe('compact fillHeight toolbar structure', () => {
    it('hides trailing action cluster in compact mode (actions go to overflow dropdown)', () => {
      render(<NoteEditor courseId="c1" lessonId="l1" compact fillHeight />)

      expect(screen.queryByTestId('note-editor-toolbar-actions')).not.toBeInTheDocument()
    })

    it('renders trailing action cluster when NOT compact', () => {
      render(<NoteEditor courseId="c1" lessonId="l1" fillHeight />)

      const cluster = screen.getByTestId('note-editor-toolbar-actions')
      expect(cluster).toBeInTheDocument()
      expect(cluster.className).toContain('ml-auto')
    })

    it('contains Add Timestamp and Download buttons in trailing cluster when not compact', () => {
      render(<NoteEditor courseId="c1" lessonId="l1" fillHeight />)

      const cluster = screen.getByTestId('note-editor-toolbar-actions')
      const timestampBtn = cluster.querySelector('[aria-label="Add Timestamp"]')
      const downloadBtn = cluster.querySelector('[aria-label="Download note as Markdown"]')
      expect(timestampBtn).toBeInTheDocument()
      expect(downloadBtn).toBeInTheDocument()
    })

    it('adds min-w-0 and w-full to toolbar root when compact && fillHeight', () => {
      render(<NoteEditor courseId="c1" lessonId="l1" compact fillHeight />)

      const toolbar = screen.getByTestId('note-editor-toolbar')
      expect(toolbar.className).toContain('min-w-0')
      expect(toolbar.className).toContain('w-full')
    })

    it('does not add panel-specific classes when fillHeight is false', () => {
      render(<NoteEditor courseId="c1" lessonId="l1" compact />)

      const toolbar = screen.getByTestId('note-editor-toolbar')
      expect(toolbar.className).not.toContain('min-w-0')
      expect(toolbar.className).not.toContain('w-full')
    })

    it('keeps h-11 on Add Timestamp and Download buttons in non-compact trailing cluster', () => {
      render(<NoteEditor courseId="c1" lessonId="l1" fillHeight />)

      const cluster = screen.getByTestId('note-editor-toolbar-actions')
      const timestampBtn = cluster.querySelector('[aria-label="Add Timestamp"]')
      const downloadBtn = cluster.querySelector('[aria-label="Download note as Markdown"]')
      expect(timestampBtn?.className).toContain('h-11')
      expect(downloadBtn?.className).toContain('h-11')
    })
  })
})
