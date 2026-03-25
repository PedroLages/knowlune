import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useAuthorStore } from '@/stores/useAuthorStore'
import type { ImportedAuthor } from '@/data/types'

// Mock allAuthors (pre-seeded static data) — empty by default, populated per-test
const mockPreseededAuthors = vi.hoisted(() => ({
  authors: [] as Array<{
    id: string
    name: string
    avatar: string
    title: string
    bio: string
    shortBio: string
    specialties: string[]
    yearsExperience: number
    socialLinks: Record<string, string>
    featuredQuote?: string
  }>,
}))

vi.mock('@/data/authors', () => ({
  get allAuthors() {
    return mockPreseededAuthors.authors
  },
}))

// Mock useCourseStore for getAuthorStats / getMergedAuthors
vi.mock('@/stores/useCourseStore', () => ({
  useCourseStore: Object.assign(
    vi.fn((selector: (state: { courses: unknown[] }) => unknown) => selector({ courses: [] })),
    {
      getState: () => ({ courses: [] }),
    }
  ),
}))

// Import component AFTER all mocks
import { Authors } from '../Authors'

function makeImportedAuthor(overrides: Partial<ImportedAuthor> = {}): ImportedAuthor {
  return {
    id: 'imported-1',
    name: 'Imported Author',
    bio: 'Bio text for imported author.',
    photoUrl: '',
    courseIds: [],
    specialties: ['TypeScript', 'React'],
    socialLinks: {},
    isPreseeded: false,
    createdAt: '2026-03-25T10:00:00.000Z',
    updatedAt: '2026-03-25T10:00:00.000Z',
    ...overrides,
  }
}

function renderAuthors() {
  return render(
    <MemoryRouter>
      <Authors />
    </MemoryRouter>
  )
}

describe('Authors page', () => {
  beforeEach(() => {
    mockPreseededAuthors.authors = []
    useAuthorStore.setState({
      authors: [],
      isLoading: false,
      isLoaded: true,
      error: null,
    })
  })

  afterEach(() => {
    useAuthorStore.setState({
      authors: [],
      isLoading: false,
      isLoaded: false,
      error: null,
    })
  })

  describe('empty state', () => {
    it('renders empty state when no authors exist', () => {
      renderAuthors()
      expect(screen.getByText('No Authors Yet')).toBeInTheDocument()
      expect(screen.getByTestId('empty-add-author-button')).toBeInTheDocument()
    })

    it('shows correct subtitle for no authors', () => {
      renderAuthors()
      expect(
        screen.getByText('No authors yet. Add your first author to get started.')
      ).toBeInTheDocument()
    })
  })

  describe('single author', () => {
    beforeEach(() => {
      useAuthorStore.setState({
        authors: [makeImportedAuthor()],
        isLoading: false,
        isLoaded: true,
        error: null,
      })
    })

    it('renders author card with name', () => {
      renderAuthors()
      expect(screen.getByText('Imported Author')).toBeInTheDocument()
    })

    it('shows singular subtitle text', () => {
      renderAuthors()
      expect(screen.getByText('Meet the expert behind your learning journey')).toBeInTheDocument()
    })

    it('shows specialty badges', () => {
      renderAuthors()
      expect(screen.getByText('TypeScript')).toBeInTheDocument()
      expect(screen.getByText('React')).toBeInTheDocument()
    })

    it('shows course count', () => {
      renderAuthors()
      const countEl = screen.getByTestId('author-course-count')
      expect(countEl).toHaveTextContent('0')
    })

    it('links to author profile page', () => {
      renderAuthors()
      const card = screen.getByTestId('author-card')
      expect(card).toHaveAttribute('href', '/authors/imported-1')
    })
  })

  describe('multiple authors', () => {
    beforeEach(() => {
      useAuthorStore.setState({
        authors: [
          makeImportedAuthor({ id: 'a1', name: 'Alice', createdAt: '2026-03-20T10:00:00.000Z' }),
          makeImportedAuthor({ id: 'a2', name: 'Bob', createdAt: '2026-03-25T10:00:00.000Z' }),
        ],
        isLoading: false,
        isLoaded: true,
        error: null,
      })
    })

    it('renders multiple author cards', () => {
      renderAuthors()
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it('shows plural subtitle text', () => {
      renderAuthors()
      expect(
        screen.getByText('Meet the 2 experts behind your learning journey')
      ).toBeInTheDocument()
    })

    it('each card links to correct profile', () => {
      renderAuthors()
      const cards = screen.getAllByTestId('author-card')
      const hrefs = cards.map(c => c.getAttribute('href'))
      expect(hrefs).toContain('/authors/a1')
      expect(hrefs).toContain('/authors/a2')
    })
  })

  describe('search', () => {
    beforeEach(() => {
      useAuthorStore.setState({
        authors: [
          makeImportedAuthor({ id: 'a1', name: 'Alice Johnson', specialties: ['Python'] }),
          makeImportedAuthor({ id: 'a2', name: 'Bob Smith', specialties: ['React'] }),
        ],
        isLoading: false,
        isLoaded: true,
        error: null,
      })
    })

    it('renders search input', () => {
      renderAuthors()
      expect(screen.getByTestId('author-search-input')).toBeInTheDocument()
    })

    it('filters authors by name', async () => {
      const user = userEvent.setup()
      renderAuthors()
      const input = screen.getByTestId('author-search-input')
      await user.type(input, 'Alice')
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()
    })

    it('filters authors by specialty', async () => {
      const user = userEvent.setup()
      renderAuthors()
      const input = screen.getByTestId('author-search-input')
      await user.type(input, 'React')
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument()
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    })

    it('shows no results message when search matches nothing', async () => {
      const user = userEvent.setup()
      renderAuthors()
      const input = screen.getByTestId('author-search-input')
      await user.type(input, 'ZZZ nonexistent')
      expect(screen.getByText('No Authors Found')).toBeInTheDocument()
    })
  })

  describe('sort', () => {
    beforeEach(() => {
      useAuthorStore.setState({
        authors: [
          makeImportedAuthor({
            id: 'a1',
            name: 'Zara',
            createdAt: '2026-03-20T10:00:00.000Z',
          }),
          makeImportedAuthor({
            id: 'a2',
            name: 'Alice',
            createdAt: '2026-03-25T10:00:00.000Z',
          }),
        ],
        isLoading: false,
        isLoaded: true,
        error: null,
      })
    })

    it('renders sort select', () => {
      renderAuthors()
      expect(screen.getByTestId('author-sort-select')).toBeInTheDocument()
    })

    it('sorts alphabetically by default', () => {
      renderAuthors()
      const cards = screen.getAllByTestId('author-card')
      // Alice should be before Zara alphabetically
      const names = cards.map(c => within(c).getByRole('heading', { level: 2 }).textContent)
      expect(names).toEqual(['Alice', 'Zara'])
    })
  })

  describe('loading state', () => {
    it('shows skeletons while loading', () => {
      // Prevent loadAuthors from actually running by mocking it
      const mockLoadAuthors = vi.fn()
      useAuthorStore.setState({
        authors: [],
        isLoading: true,
        isLoaded: false,
        error: null,
        loadAuthors: mockLoadAuthors,
      })
      const { container } = renderAuthors()
      // Should render skeleton elements
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('pre-seeded author fallback', () => {
    it('shows pre-seeded authors when store is empty', () => {
      mockPreseededAuthors.authors = [
        {
          id: 'chase-hughes',
          name: 'Chase Hughes',
          avatar: '/images/instructors/chase-hughes',
          title: 'Behavioral Intelligence Expert',
          bio: 'Expert bio.',
          shortBio: 'Short bio.',
          specialties: ['Behavioral Analysis'],
          yearsExperience: 20,
          socialLinks: {},
        },
      ]
      useAuthorStore.setState({
        authors: [],
        isLoading: false,
        isLoaded: true,
        error: null,
      })
      renderAuthors()
      expect(screen.getByText('Chase Hughes')).toBeInTheDocument()
    })

    it('prefers store author over pre-seeded when IDs match', () => {
      mockPreseededAuthors.authors = [
        {
          id: 'chase-hughes',
          name: 'Chase Hughes (Static)',
          avatar: '/images/instructors/chase-hughes',
          title: 'Behavioral Intelligence Expert',
          bio: 'Static bio.',
          shortBio: 'Short.',
          specialties: ['Behavioral Analysis'],
          yearsExperience: 20,
          socialLinks: {},
        },
      ]
      useAuthorStore.setState({
        authors: [
          makeImportedAuthor({
            id: 'chase-hughes',
            name: 'Chase Hughes (Edited)',
            isPreseeded: true,
          }),
        ],
        isLoading: false,
        isLoaded: true,
        error: null,
      })
      renderAuthors()
      expect(screen.getByText('Chase Hughes (Edited)')).toBeInTheDocument()
      expect(screen.queryByText('Chase Hughes (Static)')).not.toBeInTheDocument()
    })
  })

  describe('add author button', () => {
    it('renders Add Author button in header', () => {
      renderAuthors()
      expect(screen.getByTestId('add-author-button')).toBeInTheDocument()
    })
  })
})
