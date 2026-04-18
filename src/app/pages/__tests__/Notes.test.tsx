import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useCourseStore } from '@/stores/useCourseStore'

vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return {
    ...actual,
    useReducedMotion: () => false,
  }
})

vi.mock('@/stores/useNoteStore', () => ({
  useNoteStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      notes: [],
      isLoading: false,
      loadNotes: vi.fn(),
    }),
}))

vi.mock('@/lib/unifiedSearch', () => ({
  search: () => [],
}))

vi.mock('@/lib/progress', () => ({
  getAllNoteTags: () => Promise.resolve([]),
}))

vi.mock('@/lib/searchUtils', () => ({
  highlightMatches: (text: string) => text,
  buildHighlightPatterns: () => [],
}))

vi.mock('@/lib/format', () => ({
  formatTimestamp: (ts: number) => `${ts}s`,
}))

vi.mock('@/lib/textUtils', () => ({
  stripHtml: (html: string) => html,
}))

vi.mock('@/app/components/notes/ReadOnlyContent', () => ({
  ReadOnlyContent: () => <div data-testid="readonly-content" />,
}))

import { Notes } from '../Notes'

beforeEach(() => {
  useCourseStore.setState({
    courses: [
      {
        id: 'c1',
        title: 'Test Course',
        shortTitle: 'Test',
        description: 'desc',
        category: 'behavioral-analysis',
        difficulty: 'beginner',
        totalLessons: 2,
        totalVideos: 2,
        totalPDFs: 0,
        estimatedHours: 1,
        tags: [],
        modules: [
          {
            id: 'm1',
            title: 'Module 1',
            description: '',
            order: 1,
            lessons: [
              {
                id: 'l1',
                title: 'Lesson 1',
                description: '',
                order: 1,
                resources: [],
                keyTopics: [],
              },
            ],
          },
        ],
        isSequential: false,
        basePath: '/test',
        authorId: 'i1',
      },
    ],
    isLoaded: true,
  })
})

afterEach(() => {
  useCourseStore.setState({ courses: [], isLoaded: false })
})

function renderNotes() {
  return render(
    <MemoryRouter>
      <Notes />
    </MemoryRouter>
  )
}

describe('Notes page', () => {
  it('renders without crashing', () => {
    const { container } = renderNotes()
    expect(container).toBeTruthy()
  })

  it('displays the page heading "My Notes"', () => {
    renderNotes()
    expect(screen.getByText(/My Notes/)).toBeInTheDocument()
  })

  it('shows empty state when no notes exist', () => {
    renderNotes()
    expect(screen.getByText('Start a video and take your first note')).toBeInTheDocument()
  })

  it('renders the search input', () => {
    renderNotes()
    expect(screen.getByLabelText('Search notes')).toBeInTheDocument()
  })
})
