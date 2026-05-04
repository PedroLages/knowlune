import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { render } from '@testing-library/react'
import { CourseNotesTab } from '../CourseNotesTab'
import { useNoteStore } from '@/stores/useNoteStore'
import type { Note, Module } from '@/data/types'

// Track what notes the export functions receive
let exportedCombinedNotes: Note[] = []
let exportedZipNotes: Note[] = []

// Mock sonner to prevent actual toast calls
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock export functions to verify filtered notes
vi.mock('@/lib/noteExport', async () => {
  const actual = await vi.importActual<typeof import('@/lib/noteExport')>('@/lib/noteExport')
  return {
    ...actual,
    exportCombinedMarkdown: vi.fn((notes: Note[], _courseName: string, _courseSlug: string, _map: unknown) => {
      exportedCombinedNotes = [...notes]
      return { content: 'mock content', filename: 'test.md' }
    }),
    exportNotesZip: vi.fn(async (notes: Note[], _courseName: string, _courseSlug: string, _map: unknown) => {
      exportedZipNotes = [...notes]
      return { blob: new Blob(['test']), filename: 'test.zip' }
    }),
  }
})

// Mock fileDownload to prevent actual browser downloads
vi.mock('@/lib/fileDownload', () => ({
  downloadBlob: vi.fn(),
}))

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    videoId: 'lesson-1',
    content: '<p>Test note content</p>',
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
    tags: [],
    ...overrides,
  }
}

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    id: 'mod-1',
    title: 'Module 1',
    description: 'First module',
    order: 1,
    lessons: [
      {
        id: 'lesson-1',
        title: 'Lesson 1',
        description: 'First lesson',
        order: 1,
        resources: [],
        keyTopics: [],
      },
    ],
    ...overrides,
  }
}

describe('CourseNotesTab export', () => {
  beforeEach(() => {
    useNoteStore.setState({ notes: [], isLoading: false })
    vi.clearAllMocks()
    exportedCombinedNotes = []
    exportedZipNotes = []
  })

  it('shows export button when notes exist', () => {
    useNoteStore.setState({
      notes: [makeNote({ id: 'n1', courseId: 'course-1' })],
    })

    const { getByTestId } = render(
      <CourseNotesTab
        courseId="course-1"
        courseName="Test Course"
        modules={[makeModule()]}
      />
    )

    expect(getByTestId('export-notes-button')).toBeTruthy()
  })

  it('shows empty state when no notes exist (no export button)', () => {
    useNoteStore.setState({ notes: [] })

    const { queryByTestId, getByText } = render(
      <CourseNotesTab
        courseId="course-1"
        courseName="Test Course"
        modules={[makeModule()]}
      />
    )

    // Empty state renders; export button is not present
    expect(queryByTestId('export-notes-button')).toBeNull()
    expect(getByText(/No notes yet/)).toBeTruthy()
  })

  it('export button is disabled when all notes have empty content', () => {
    useNoteStore.setState({
      notes: [makeNote({ id: 'n1', courseId: 'course-1', content: '' })],
    })

    const { getByTestId } = render(
      <CourseNotesTab
        courseId="course-1"
        courseName="Test Course"
        modules={[makeModule()]}
      />
    )

    const btn = getByTestId('export-notes-button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('export button click opens popover with format options', () => {
    useNoteStore.setState({
      notes: [makeNote({ id: 'n1', courseId: 'course-1' })],
    })

    const { getByTestId, getByText } = render(
      <CourseNotesTab
        courseId="course-1"
        courseName="Test Course"
        modules={[makeModule()]}
      />
    )

    const btn = getByTestId('export-notes-button')
    act(() => {
      btn.click()
    })

    // Popover content should be visible
    expect(getByText('Export format')).toBeTruthy()
    expect(getByTestId('export-combined-md')).toBeTruthy()
    expect(getByTestId('export-zip')).toBeTruthy()
  })
})

describe('CourseNotesTab export filtering (integration)', () => {
  beforeEach(() => {
    useNoteStore.setState({ notes: [], isLoading: false })
    vi.clearAllMocks()
    exportedCombinedNotes = []
    exportedZipNotes = []
  })

  async function triggerExport(format: 'combined-markdown' | 'zip') {
    const { getByTestId } = render(
      <CourseNotesTab
        courseId="course-1"
        courseName="Test Course"
        modules={[makeModule()]}
      />
    )

    // Open popover
    const btn = getByTestId('export-notes-button')
    act(() => {
      btn.click()
    })

    // Click the format button
    const testId = format === 'combined-markdown' ? 'export-combined-md' : 'export-zip'
    const formatBtn = getByTestId(testId)
    await act(async () => {
      formatBtn.click()
    })
  }

  it('excludes soft-deleted notes from combined markdown export', async () => {
    useNoteStore.setState({
      notes: [
        makeNote({ id: 'n1', courseId: 'course-1', content: '<p>Active note</p>' }),
        makeNote({ id: 'n2', courseId: 'course-1', content: '<p>Deleted note</p>', deleted: true }),
      ],
    })

    await triggerExport('combined-markdown')

    expect(exportedCombinedNotes).toHaveLength(1)
    expect(exportedCombinedNotes[0].id).toBe('n1')
    expect(exportedCombinedNotes.some(n => n.id === 'n2')).toBe(false)
  })

  it('excludes soft-deleted notes from ZIP export', async () => {
    useNoteStore.setState({
      notes: [
        makeNote({ id: 'n1', courseId: 'course-1', content: '<p>Active note</p>' }),
        makeNote({ id: 'n2', courseId: 'course-1', content: '<p>Deleted note</p>', deleted: true }),
      ],
    })

    await triggerExport('zip')

    expect(exportedZipNotes).toHaveLength(1)
    expect(exportedZipNotes[0].id).toBe('n1')
    expect(exportedZipNotes.some(n => n.id === 'n2')).toBe(false)
  })

  it('excludes notes with empty content from combined markdown export', async () => {
    useNoteStore.setState({
      notes: [
        makeNote({ id: 'n1', courseId: 'course-1', content: '<p>Has content</p>' }),
        makeNote({ id: 'n2', courseId: 'course-1', content: '' }),
        makeNote({ id: 'n3', courseId: 'course-1', content: '   ' }),
      ],
    })

    await triggerExport('combined-markdown')

    expect(exportedCombinedNotes).toHaveLength(1)
    expect(exportedCombinedNotes[0].id).toBe('n1')
  })

  it('excludes notes with empty content from ZIP export', async () => {
    useNoteStore.setState({
      notes: [
        makeNote({ id: 'n1', courseId: 'course-1', content: '<p>Has content</p>' }),
        makeNote({ id: 'n2', courseId: 'course-1', content: '' }),
      ],
    })

    await triggerExport('zip')

    expect(exportedZipNotes).toHaveLength(1)
    expect(exportedZipNotes[0].id).toBe('n1')
  })

  it('excludes both soft-deleted and empty-content notes simultaneously', async () => {
    useNoteStore.setState({
      notes: [
        makeNote({ id: 'n1', courseId: 'course-1', content: '<p>Active with content</p>' }),
        makeNote({ id: 'n2', courseId: 'course-1', content: '<p>Deleted with content</p>', deleted: true }),
        makeNote({ id: 'n3', courseId: 'course-1', content: '' }),
      ],
    })

    await triggerExport('combined-markdown')

    expect(exportedCombinedNotes).toHaveLength(1)
    expect(exportedCombinedNotes[0].id).toBe('n1')
  })

  it('does not include soft-deleted note with content in exported data', async () => {
    // Core F3 scenario: a soft-deleted note that has rich content must still
    // be excluded from exports — the !n.deleted gate applies regardless of content.
    useNoteStore.setState({
      notes: [
        makeNote({
          id: 'n-kept',
          courseId: 'course-1',
          content: '<h1>Important Study Notes</h1><ul><li>Concept A</li><li>Concept B</li></ul>',
        }),
        makeNote({
          id: 'n-deleted-rich',
          courseId: 'course-1',
          content: '<h2>Soft-deleted but rich</h2><p>This note has lots of valuable content but was soft-deleted by the user.</p>',
          deleted: true,
        }),
      ],
    })

    await triggerExport('combined-markdown')

    expect(exportedCombinedNotes).toHaveLength(1)
    expect(exportedCombinedNotes[0].id).toBe('n-kept')
    expect(exportedCombinedNotes.some(n => n.id === 'n-deleted-rich')).toBe(false)

    // Verify the deleted note was not in the content passed to the export function
    for (const n of exportedCombinedNotes) {
      expect(n.content).not.toContain('Soft-deleted but rich')
    }
  })
})

describe('CourseNotesTab sorting', () => {
  beforeEach(() => {
    useNoteStore.setState({ notes: [], isLoading: false })
    vi.clearAllMocks()
  })

  it('sorts by video-order by default', () => {
    useNoteStore.setState({
      notes: [makeNote({ id: 'n1' })],
    })

    const { getByText } = render(
      <CourseNotesTab
        courseId="course-1"
        courseName="Test Course"
        modules={[makeModule()]}
      />
    )

    expect(getByText('Video Order')).toBeTruthy()
  })

  it('toggles sort mode on click', () => {
    useNoteStore.setState({
      notes: [makeNote({ id: 'n1' })],
    })

    const { getByLabelText, getByText } = render(
      <CourseNotesTab
        courseId="course-1"
        courseName="Test Course"
        modules={[makeModule()]}
      />
    )

    const sortBtn = getByLabelText('Sort notes')
    act(() => {
      sortBtn.click()
    })

    expect(getByText('Date Created')).toBeTruthy()
  })
})
