/**
 * ReaderHeader unit tests
 *
 * Tests chapter display fallback, theme application, and visibility.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReaderHeader } from '../ReaderHeader'
import type { ReaderTheme } from '@/stores/useReaderStore'

// --- Mocks ---

const mockNavigate = vi.fn()
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock useAppColorScheme — default to 'professional'
vi.mock('../readerThemeConfig', async () => {
  const actual =
    await vi.importActual<typeof import('../readerThemeConfig')>('../readerThemeConfig')
  return {
    ...actual,
    useAppColorScheme: () => 'professional',
  }
})

const defaultProps = {
  title: 'Test Book',
  currentChapter: 'Chapter 1',
  theme: 'light' as ReaderTheme,
  visible: true,
  onTocOpen: vi.fn(),
  onSettingsOpen: vi.fn(),
  onHighlightsOpen: vi.fn(),
}

describe('ReaderHeader', () => {
  describe('AC-4: Chapter display fallback', () => {
    it('shows chapter name when currentChapter is provided', () => {
      render(<ReaderHeader {...defaultProps} currentChapter="Chapter 1" />)

      const chapterDisplay = screen.getByTestId('reader-chapter-title')
      expect(chapterDisplay).toBeInTheDocument()
      expect(chapterDisplay).toHaveTextContent('Chapter 1')
    })

    it('shows progress percentage when currentChapter is empty and readingProgress is provided', () => {
      render(<ReaderHeader {...defaultProps} currentChapter="" readingProgress={0.25} />)

      const chapterDisplay = screen.getByTestId('reader-chapter-title')
      expect(chapterDisplay).toBeInTheDocument()
      expect(chapterDisplay).toHaveTextContent('25%')
    })

    it('shows progress percentage when currentChapter is undefined and readingProgress is provided', () => {
      render(<ReaderHeader {...defaultProps} currentChapter={undefined} readingProgress={0.5} />)

      const chapterDisplay = screen.getByTestId('reader-chapter-title')
      expect(chapterDisplay).toBeInTheDocument()
      expect(chapterDisplay).toHaveTextContent('50%')
    })

    it('rounds progress percentage correctly', () => {
      render(<ReaderHeader {...defaultProps} currentChapter="" readingProgress={0.334} />)

      const chapterDisplay = screen.getByTestId('reader-chapter-title')
      expect(chapterDisplay).toHaveTextContent('33%')
    })

    it('shows 100% when progress is complete', () => {
      render(<ReaderHeader {...defaultProps} currentChapter="" readingProgress={1.0} />)

      const chapterDisplay = screen.getByTestId('reader-chapter-title')
      expect(chapterDisplay).toHaveTextContent('100%')
    })

    it('shows 0% when progress is at start', () => {
      render(<ReaderHeader {...defaultProps} currentChapter="" readingProgress={0.0} />)

      const chapterDisplay = screen.getByTestId('reader-chapter-title')
      expect(chapterDisplay).toHaveTextContent('0%')
    })

    it('hides chapter display when both currentChapter and readingProgress are unavailable', () => {
      render(<ReaderHeader {...defaultProps} currentChapter="" readingProgress={undefined} />)

      const chapterDisplay = screen.queryByTestId('reader-chapter-title')
      expect(chapterDisplay).not.toBeInTheDocument()
    })

    it('prefers chapter name over progress percentage when both are available', () => {
      render(<ReaderHeader {...defaultProps} currentChapter="Chapter 1" readingProgress={0.25} />)

      const chapterDisplay = screen.getByTestId('reader-chapter-title')
      expect(chapterDisplay).toHaveTextContent('Chapter 1')
      expect(chapterDisplay).not.toHaveTextContent('25%')
    })
  })

  describe('Theme application', () => {
    it('applies light theme colors (professional)', () => {
      render(<ReaderHeader {...defaultProps} theme="light" />)

      const header = screen.getByTestId('reader-header')
      expect(header).toHaveClass('bg-[#faf5ee]/60', 'text-[#1c1d2b]')
    })

    it('applies sepia theme colors', () => {
      render(<ReaderHeader {...defaultProps} theme="sepia" />)

      const header = screen.getByTestId('reader-header')
      expect(header).toHaveClass('bg-[#f4ecd8]/60', 'text-[#3a2a1a]')
    })

    it('applies dark theme colors', () => {
      render(<ReaderHeader {...defaultProps} theme="dark" />)

      const header = screen.getByTestId('reader-header')
      expect(header).toHaveClass('bg-[#1a1b26]/60', 'text-[#e8e9f0]')
    })
  })

  describe('Visibility', () => {
    it('is visible when visible prop is true', () => {
      render(<ReaderHeader {...defaultProps} visible={true} />)

      const header = screen.getByTestId('reader-header')
      expect(header).toHaveClass('translate-y-0', 'opacity-100')
      expect(header).not.toHaveClass('-translate-y-full', 'opacity-0')
    })

    it('is hidden when visible prop is false', () => {
      render(<ReaderHeader {...defaultProps} visible={false} />)

      const header = screen.getByTestId('reader-header')
      expect(header).toHaveClass('-translate-y-full', 'opacity-0')
      expect(header).not.toHaveClass('translate-y-0', 'opacity-100')
    })

    it('has aria-hidden attribute matching visibility', () => {
      const { rerender } = render(<ReaderHeader {...defaultProps} visible={true} />)

      let header = screen.getByTestId('reader-header')
      expect(header).toHaveAttribute('aria-hidden', 'false')

      rerender(<ReaderHeader {...defaultProps} visible={false} />)
      header = screen.getByTestId('reader-header')
      expect(header).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Navigation buttons', () => {
    it('renders back button', () => {
      render(<ReaderHeader {...defaultProps} />)

      const backButton = screen.getByTestId('reader-back-button')
      expect(backButton).toBeInTheDocument()
      expect(backButton).toHaveAttribute('aria-label', 'Back to library')
    })

    it('calls navigate when back button is clicked', () => {
      render(<ReaderHeader {...defaultProps} />)

      const backButton = screen.getByTestId('reader-back-button')
      backButton.click()

      expect(mockNavigate).toHaveBeenCalledWith('/library')
    })

    it('renders menu button', () => {
      render(<ReaderHeader {...defaultProps} />)

      const menuButton = screen.getByTestId('reader-menu-button')
      expect(menuButton).toBeInTheDocument()
      expect(menuButton).toHaveAttribute('aria-label', 'Reader menu')
    })
  })

  describe('Book title display', () => {
    it('shows book title', () => {
      render(<ReaderHeader {...defaultProps} title="My Amazing Book" />)

      const titleElement = screen.getByTestId('reader-book-title')
      expect(titleElement).toBeInTheDocument()
      expect(titleElement).toHaveTextContent('My Amazing Book')
    })

    it('truncates long titles', () => {
      render(
        <ReaderHeader
          {...defaultProps}
          title="This is a very long book title that should be truncated with an ellipsis"
        />
      )

      const titleElement = screen.getByTestId('reader-book-title')
      expect(titleElement).toHaveClass('truncate')
    })
  })
})
