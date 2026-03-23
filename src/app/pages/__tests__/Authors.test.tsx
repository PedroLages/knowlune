import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Author } from '@/data/types'

// vi.hoisted ensures mockState is available when the vi.mock factory runs (mocks are hoisted above imports)
const mockState = vi.hoisted(() => ({
  authors: [] as Author[],
}))

// Use a getter so allAuthors reads the CURRENT value of mockState.authors on each render
vi.mock('@/data/authors', () => ({
  get allAuthors() {
    return mockState.authors
  },
}))

// Mock getAuthorStats and getAvatarSrc — FeaturedAuthor calls these
vi.mock('@/lib/authors', () => ({
  getAuthorStats: () => ({
    courses: [],
    courseCount: 5,
    totalLessons: 120,
    totalHours: 40,
    totalVideos: 100,
    categories: ['general'],
  }),
  getAvatarSrc: (basePath: string) => ({ src: `${basePath}-96w.jpg` }),
}))

// Import component AFTER all mocks (vi.mock calls are hoisted, so this runs with mocks active)
import { Authors } from '../Authors'

const makeAuthor = (overrides: Partial<Author> = {}): Author => ({
  id: 'test-author',
  name: 'Test Author',
  avatar: '/images/test',
  title: 'Expert',
  bio: 'Full bio text.',
  shortBio: 'Short bio text.',
  specialties: ['Skill A', 'Skill B'],
  yearsExperience: 10,
  socialLinks: {},
  ...overrides,
})

function renderAuthors() {
  return render(
    <MemoryRouter>
      <Authors />
    </MemoryRouter>
  )
}

describe('Authors page', () => {
  beforeEach(() => {
    mockState.authors = []
  })

  describe('single author — featured layout', () => {
    beforeEach(() => {
      mockState.authors = [makeAuthor()]
    })

    it('renders featured layout instead of grid', () => {
      renderAuthors()
      expect(screen.getByTestId('featured-author')).toBeInTheDocument()
      expect(screen.queryByTestId('author-grid')).not.toBeInTheDocument()
    })

    it('shows author name, title, and short bio', () => {
      renderAuthors()
      expect(screen.getByText('Test Author')).toBeInTheDocument()
      expect(screen.getByText('Expert')).toBeInTheDocument()
      expect(screen.getByText('Short bio text.')).toBeInTheDocument()
    })

    it('shows View Full Profile link pointing to author profile', () => {
      renderAuthors()
      const link = screen.getByRole('link', { name: /view full profile/i })
      expect(link).toHaveAttribute('href', '/authors/test-author')
    })

    it('shows specialty badges', () => {
      renderAuthors()
      expect(screen.getByText('Skill A')).toBeInTheDocument()
      expect(screen.getByText('Skill B')).toBeInTheDocument()
    })

    it('displays singular subtitle text', () => {
      renderAuthors()
      expect(screen.getByText('Meet the expert behind your learning journey')).toBeInTheDocument()
    })
  })

  describe('multiple authors — grid layout', () => {
    beforeEach(() => {
      mockState.authors = [
        makeAuthor({ id: 'author-1', name: 'Author One' }),
        makeAuthor({ id: 'author-2', name: 'Author Two' }),
      ]
    })

    it('renders grid instead of featured layout', () => {
      renderAuthors()
      expect(screen.getByTestId('author-grid')).toBeInTheDocument()
      expect(screen.queryByTestId('featured-author')).not.toBeInTheDocument()
    })

    it('shows all author names in grid', () => {
      renderAuthors()
      expect(screen.getByText('Author One')).toBeInTheDocument()
      expect(screen.getByText('Author Two')).toBeInTheDocument()
    })

    it('displays plural subtitle text', () => {
      renderAuthors()
      expect(
        screen.getByText('Meet the 2 experts behind your learning journey')
      ).toBeInTheDocument()
    })
  })
})
