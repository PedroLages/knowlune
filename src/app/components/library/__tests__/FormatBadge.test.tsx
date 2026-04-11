/**
 * Unit tests for FormatBadge component — E108-S02
 *
 * Covers AC-2 (icons/colors per format) and AC-3 (ARIA labels).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormatBadge } from '../FormatBadge'

describe('FormatBadge', () => {
  describe('EPUB format', () => {
    it('renders the EPUB label', () => {
      render(<FormatBadge format="epub" />)
      expect(screen.getByText('EPUB')).toBeInTheDocument()
    })

    it('has correct aria-label for screen readers', () => {
      render(<FormatBadge format="epub" />)
      expect(screen.getByLabelText('EPUB format')).toBeInTheDocument()
    })

    it('renders with format-specific data-testid', () => {
      render(<FormatBadge format="epub" />)
      expect(screen.getByTestId('format-badge-epub')).toBeInTheDocument()
    })

    it('uses design token classes (no hardcoded colors)', () => {
      render(<FormatBadge format="epub" />)
      const badge = screen.getByTestId('format-badge-epub')
      expect(badge.className).toContain('bg-brand-soft')
      expect(badge.className).toContain('text-brand-soft-foreground')
    })
  })

  describe('Audiobook format', () => {
    it('renders the Audiobook label', () => {
      render(<FormatBadge format="audiobook" />)
      expect(screen.getByText('Audiobook')).toBeInTheDocument()
    })

    it('has correct aria-label for screen readers', () => {
      render(<FormatBadge format="audiobook" />)
      expect(screen.getByLabelText('Audiobook format')).toBeInTheDocument()
    })

    it('renders with format-specific data-testid', () => {
      render(<FormatBadge format="audiobook" />)
      expect(screen.getByTestId('format-badge-audiobook')).toBeInTheDocument()
    })

    it('uses design token classes (no hardcoded colors)', () => {
      render(<FormatBadge format="audiobook" />)
      const badge = screen.getByTestId('format-badge-audiobook')
      expect(badge.className).toContain('bg-warning')
      expect(badge.className).toContain('text-warning')
    })
  })

  describe('PDF format', () => {
    it('renders the PDF label', () => {
      render(<FormatBadge format="pdf" />)
      expect(screen.getByText('PDF')).toBeInTheDocument()
    })

    it('has correct aria-label for screen readers', () => {
      render(<FormatBadge format="pdf" />)
      expect(screen.getByLabelText('PDF format')).toBeInTheDocument()
    })

    it('renders with format-specific data-testid', () => {
      render(<FormatBadge format="pdf" />)
      expect(screen.getByTestId('format-badge-pdf')).toBeInTheDocument()
    })

    it('uses design token classes (no hardcoded colors)', () => {
      render(<FormatBadge format="pdf" />)
      const badge = screen.getByTestId('format-badge-pdf')
      expect(badge.className).toContain('bg-muted')
      expect(badge.className).toContain('text-muted-foreground')
    })
  })

  describe('Icons', () => {
    it('renders an icon element for each format', () => {
      const formats = ['epub', 'audiobook', 'pdf'] as const
      for (const format of formats) {
        const { container, unmount } = render(<FormatBadge format={format} />)
        // Lucide icons render as SVG elements
        const svg = container.querySelector('svg')
        expect(svg, `Expected SVG icon for ${format}`).not.toBeNull()
        expect(svg?.getAttribute('aria-hidden')).toBe('true')
        unmount()
      }
    })
  })

  describe('unknown format fallback', () => {
    it('renders the raw format string when format is unrecognised', () => {
      // Cast to bypass TypeScript — tests runtime guard behaviour
      render(<FormatBadge format={'mobi' as never} />)
      expect(screen.getByText('mobi')).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    it('accepts an additional className', () => {
      render(<FormatBadge format="epub" className="custom-class" />)
      const badge = screen.getByTestId('format-badge-epub')
      expect(badge.className).toContain('custom-class')
    })
  })
})
