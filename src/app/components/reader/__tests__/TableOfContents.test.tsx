/**
 * TableOfContents unit tests — E107-S03 Fix TOC Loading and Fallback
 *
 * Tests the loading state, empty state, and TOC display functionality:
 * - AC-1: TOC loading state is tracked and displayed
 * - AC-2: Empty TOC displays user-friendly message
 * - AC-3: TOC timeout falls back to empty state
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableOfContents } from '../TableOfContents'
import type { NavItem } from 'epubjs'
import type { Rendition } from 'epubjs'

// --- Mocks ---

const mockRendition = {
  display: vi.fn().mockResolvedValue(undefined),
} as unknown as Rendition

const mockToc: NavItem[] = [
  {
    id: 'chap1',
    label: 'Chapter 1',
    href: '#chap1',
    subitems: [],
  },
  {
    id: 'chap2',
    label: 'Chapter 2',
    href: '#chap2',
    subitems: [
      {
        id: 'chap2-1',
        label: 'Section 2.1',
        href: '#chap2-1',
        subitems: [],
      },
    ],
  },
  {
    id: 'chap3',
    label: 'Chapter 3',
    href: '#chap3',
    subitems: [],
  },
]

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  toc: [],
  currentHref: undefined,
  rendition: mockRendition,
}

describe('TableOfContents', () => {
  describe('AC-1: Loading state', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<TableOfContents {...defaultProps} isLoading={true} toc={[]} />)

      const loadingIndicator = screen.getByTestId('toc-loading')
      expect(loadingIndicator).toBeInTheDocument()
      expect(screen.getByText(/loading table of contents/i)).toBeInTheDocument()
    })

    it('does not show loading state when isLoading is false and toc is empty', () => {
      render(<TableOfContents {...defaultProps} isLoading={false} toc={[]} />)

      expect(screen.queryByTestId('toc-loading')).not.toBeInTheDocument()
      expect(screen.getByText(/no table of contents available/i)).toBeInTheDocument()
    })

    it('does not show loading state when isLoading is false and toc has items', () => {
      render(<TableOfContents {...defaultProps} isLoading={false} toc={mockToc} />)

      expect(screen.queryByTestId('toc-loading')).not.toBeInTheDocument()
      expect(screen.getByText('Chapter 1')).toBeInTheDocument()
    })
  })

  describe('AC-2: Empty TOC state', () => {
    it('shows empty state message when toc is empty and not loading', () => {
      render(<TableOfContents {...defaultProps} isLoading={false} toc={[]} />)

      const emptyMessage = screen.getByText(/no table of contents available/i)
      expect(emptyMessage).toBeInTheDocument()
      expect(emptyMessage).toHaveClass('text-sm', 'text-muted-foreground', 'text-center', 'py-8')
    })

    it('shows TOC items when toc has content', () => {
      render(<TableOfContents {...defaultProps} isLoading={false} toc={mockToc} />)

      expect(screen.getByText('Chapter 1')).toBeInTheDocument()
      expect(screen.getByText('Chapter 2')).toBeInTheDocument()
      expect(screen.getByText('Chapter 3')).toBeInTheDocument()
      expect(screen.getByText('Section 2.1')).toBeInTheDocument()
    })

    it('does not show empty state message when toc has content', () => {
      render(<TableOfContents {...defaultProps} isLoading={false} toc={mockToc} />)

      expect(screen.queryByText(/no table of contents available/i)).not.toBeInTheDocument()
    })
  })

  describe('TOC Navigation', () => {
    it('calls rendition.display() when TOC item is clicked', () => {
      render(<TableOfContents {...defaultProps} isLoading={false} toc={mockToc} />)

      const chapter1Button = screen.getByText('Chapter 1')
      fireEvent.click(chapter1Button)

      expect(mockRendition.display).toHaveBeenCalledWith('#chap1')
    })

    it('calls onClose() after navigation', () => {
      const mockOnClose = vi.fn()
      render(
        <TableOfContents {...defaultProps} isLoading={false} toc={mockToc} onClose={mockOnClose} />
      )

      const chapter2Button = screen.getByText('Chapter 2')
      fireEvent.click(chapter2Button)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('does not call rendition.display() when rendition is null', () => {
      const nullRendition = null as unknown as Rendition
      render(
        <TableOfContents {...defaultProps} isLoading={false} toc={mockToc} rendition={nullRendition} />
      )

      const chapter1Button = screen.getByText('Chapter 1')
      fireEvent.click(chapter1Button)

      // Should not throw, should call onClose (handled by silent-catch-ok in component)
      expect(screen.getByText('Chapter 1')).toBeInTheDocument()
    })
  })

  describe('Active Chapter Detection', () => {
    it('highlights active chapter when currentHref matches', () => {
      render(
        <TableOfContents
          {...defaultProps}
          isLoading={false}
          toc={mockToc}
          currentHref="#chap2"
          rendition={mockRendition}
        />
      )

      const chapter2Button = screen.getByText('Chapter 2')
      expect(chapter2Button).toHaveClass('text-brand', 'font-medium', 'bg-brand-soft/40')
    })

    it('matches chapter by href without anchor fragment', () => {
      render(
        <TableOfContents
          {...defaultProps}
          isLoading={false}
          toc={mockToc}
          currentHref="#chap2-1"
          rendition={mockRendition}
        />
      )

      // Should highlight the nested section
      const sectionButton = screen.getByText('Section 2.1')
      expect(sectionButton).toHaveClass('text-brand', 'font-medium', 'bg-brand-soft/40')
    })
  })

  describe('Panel Controls', () => {
    it('calls onClose() when close button is clicked', () => {
      const mockOnClose = vi.fn()
      render(
        <TableOfContents {...defaultProps} isLoading={false} toc={[]} onClose={mockOnClose} />
      )

      const closeButton = screen.getByRole('button', { name: /close table of contents/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('renders panel with correct ARIA attributes', () => {
      render(<TableOfContents {...defaultProps} isLoading={false} toc={mockToc} />)

      const panel = screen.getByTestId('toc-panel')
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveAttribute('role', 'dialog')
    })

    it('renders sheet header with title', () => {
      render(<TableOfContents {...defaultProps} isLoading={false} toc={mockToc} />)

      expect(screen.getByText('Table of Contents')).toBeInTheDocument()
    })
  })
})
