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
const mockGetAuthorStats = vi.hoisted(() =>
  vi.fn(() => ({
    courses: [],
    courseCount: 5,
    totalLessons: 120,
    totalHours: 40,
    totalVideos: 100,
    categories: ['general'],
  }))
)

vi.mock('@/lib/authors', () => ({
  getAuthorStats: mockGetAuthorStats,
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
    mockGetAuthorStats.mockReturnValue({
      courses: [],
      courseCount: 5,
      totalLessons: 120,
      totalHours: 40,
      totalVideos: 100,
      categories: ['general'],
    })
  })

  describe('no authors — empty state', () => {
    it('renders empty state message without featured layout or grid', () => {
      renderAuthors()
      expect(screen.getByText(/no authors available/i)).toBeInTheDocument()
      expect(screen.queryByTestId('featured-author')).not.toBeInTheDocument()
      expect(screen.queryByTestId('author-grid')).not.toBeInTheDocument()
    })

    it('does not render subtitle text', () => {
      renderAuthors()
      expect(screen.queryByText(/meet the/i)).not.toBeInTheDocument()
    })
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

    it('falls back to full bio when shortBio is empty', () => {
      mockState.authors = [makeAuthor({ shortBio: '' })]
      renderAuthors()
      expect(screen.getByText('Full bio text.')).toBeInTheDocument()
    })

    it('renders no bio paragraph when both shortBio and bio are empty', () => {
      mockState.authors = [makeAuthor({ shortBio: '', bio: '' })]
      renderAuthors()
      expect(screen.queryByTestId('featured-bio')).not.toBeInTheDocument()
    })

    it('shows stat values from getAuthorStats', () => {
      renderAuthors()
      const card = screen.getByTestId('featured-author')
      expect(card).toHaveTextContent('5')
      expect(card).toHaveTextContent('40h')
      expect(card).toHaveTextContent('120')
      expect(card).toHaveTextContent('10y')
    })

    it('shows singular Course label when courseCount is 1', () => {
      mockGetAuthorStats.mockReturnValue({
        courses: [],
        courseCount: 1,
        totalLessons: 10,
        totalHours: 5,
        totalVideos: 8,
        categories: ['general'],
      })
      renderAuthors()
      expect(screen.getByText('Course')).toBeInTheDocument()
      expect(screen.queryByText('Courses')).not.toBeInTheDocument()
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

    it('caps specialty badges at 5 with overflow indicator', () => {
      mockState.authors = [
        makeAuthor({
          specialties: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        }),
      ]
      renderAuthors()
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('E')).toBeInTheDocument()
      expect(screen.getByText('+2')).toBeInTheDocument()
      expect(screen.queryByText('F')).not.toBeInTheDocument()
      expect(screen.queryByText('G')).not.toBeInTheDocument()
    })

    it('renders no badge container when specialties is empty', () => {
      mockState.authors = [makeAuthor({ specialties: [] })]
      renderAuthors()
      expect(screen.queryByTestId('specialty-badges')).not.toBeInTheDocument()
    })

    it('does not render quote when featuredQuote is absent', () => {
      renderAuthors()
      expect(screen.queryByTestId('featured-quote')).not.toBeInTheDocument()
    })

    it('renders quote when featuredQuote is set', () => {
      mockState.authors = [makeAuthor({ featuredQuote: 'Learning is a lifelong journey.' })]
      renderAuthors()
      expect(screen.getByTestId('featured-quote')).toBeInTheDocument()
      expect(screen.getByText(/Learning is a lifelong journey/i)).toBeInTheDocument()
    })

    it('displays singular subtitle text', () => {
      renderAuthors()
      expect(screen.getByText('Meet the expert behind your learning journey')).toBeInTheDocument()
    })

    it('clamps negative yearsExperience to 0', () => {
      mockState.authors = [makeAuthor({ yearsExperience: -5 })]
      renderAuthors()
      const card = screen.getByTestId('featured-author')
      expect(card).toHaveTextContent('0y')
    })

    it('has responsive Tailwind classes for mobile/tablet/desktop (AC4)', () => {
      renderAuthors()
      const card = screen.getByTestId('featured-author')
      // Hero section: stacked on mobile (flex-col), horizontal on sm+ (sm:flex-row)
      const heroSection = card.querySelector('.flex.flex-col.sm\\:flex-row')
      expect(heroSection).toBeInTheDocument()
      // Stats grid: 2 cols on mobile (grid-cols-2), 4 cols on sm+ (sm:grid-cols-4)
      const statsGrid = card.querySelector('.grid.grid-cols-2.sm\\:grid-cols-4')
      expect(statsGrid).toBeInTheDocument()
      // Avatar: centered on mobile (self-center), start-aligned on sm+ (sm:self-start)
      const avatar = card.querySelector('.self-center.sm\\:self-start')
      expect(avatar).toBeInTheDocument()
    })

    it('renders bio with line-clamp overflow safeguard', () => {
      renderAuthors()
      const bio = screen.getByTestId('featured-bio')
      expect(bio).toHaveClass('line-clamp-6')
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

    it('each grid card links to the correct author profile', () => {
      renderAuthors()
      const link1 = screen.getByRole('link', { name: /Author One/i })
      const link2 = screen.getByRole('link', { name: /Author Two/i })
      expect(link1).toHaveAttribute('href', '/authors/author-1')
      expect(link2).toHaveAttribute('href', '/authors/author-2')
    })

    it('displays plural subtitle text', () => {
      renderAuthors()
      expect(
        screen.getByText('Meet the 2 experts behind your learning journey')
      ).toBeInTheDocument()
    })
  })
})
