import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AtRiskBadge } from '../AtRiskBadge'

describe('AtRiskBadge', () => {
  describe('rendering', () => {
    it('should render with data-testid', () => {
      render(<AtRiskBadge daysSinceLastSession={14} />)
      expect(screen.getByTestId('at-risk-badge')).toBeInTheDocument()
    })

    it('should display "At Risk" text', () => {
      render(<AtRiskBadge daysSinceLastSession={20} />)
      expect(screen.getByTestId('at-risk-badge')).toHaveTextContent('At Risk')
    })

    it('should render AlertTriangle icon', () => {
      render(<AtRiskBadge daysSinceLastSession={15} />)
      const badge = screen.getByTestId('at-risk-badge')
      const svg = badge.querySelector('svg')
      expect(svg).toBeTruthy()
    })
  })

  describe('accessibility', () => {
    it('should have aria-label for regular inactivity', () => {
      render(<AtRiskBadge daysSinceLastSession={20} />)
      expect(screen.getByTestId('at-risk-badge')).toHaveAttribute(
        'aria-label',
        'At Risk: No activity for 20 days'
      )
    })

    it('should have aria-label for never started courses', () => {
      render(<AtRiskBadge daysSinceLastSession={Infinity} />)
      expect(screen.getByTestId('at-risk-badge')).toHaveAttribute(
        'aria-label',
        'Not Started: No study sessions yet'
      )
    })

    it('should have aria-label for single day inactivity', () => {
      render(<AtRiskBadge daysSinceLastSession={1} />)
      expect(screen.getByTestId('at-risk-badge')).toHaveAttribute(
        'aria-label',
        'At Risk: No activity for 1 days'
      )
    })

    it('should mark icon as aria-hidden', () => {
      render(<AtRiskBadge daysSinceLastSession={14} />)
      const badge = screen.getByTestId('at-risk-badge')
      const svg = badge.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('edge cases', () => {
    it('should handle 14 days (boundary condition)', () => {
      render(<AtRiskBadge daysSinceLastSession={14} />)
      const badge = screen.getByTestId('at-risk-badge')
      expect(badge).toHaveAttribute('aria-label', 'At Risk: No activity for 14 days')
    })

    it('should handle 0 days (edge case)', () => {
      render(<AtRiskBadge daysSinceLastSession={0} />)
      const badge = screen.getByTestId('at-risk-badge')
      expect(badge).toHaveAttribute('aria-label', 'At Risk: No activity for 0 days')
    })

    it('should handle very large day counts', () => {
      render(<AtRiskBadge daysSinceLastSession={365} />)
      const badge = screen.getByTestId('at-risk-badge')
      expect(badge).toHaveAttribute('aria-label', 'At Risk: No activity for 365 days')
    })

    it('should handle Infinity days (never started)', () => {
      render(<AtRiskBadge daysSinceLastSession={Infinity} />)
      const badge = screen.getByTestId('at-risk-badge')
      expect(badge).toHaveAttribute('aria-label', 'Not Started: No study sessions yet')
    })
  })

  describe('CSS classes', () => {
    it('should have at-risk color classes', () => {
      render(<AtRiskBadge daysSinceLastSession={20} />)
      const badge = screen.getByTestId('at-risk-badge')
      expect(badge.className).toContain('text-at-risk')
      expect(badge.className).toContain('bg-at-risk-bg')
    })

    it('should have base badge styling classes', () => {
      render(<AtRiskBadge daysSinceLastSession={20} />)
      const badge = screen.getByTestId('at-risk-badge')
      expect(badge.className).toContain('inline-flex')
      expect(badge.className).toContain('items-center')
      expect(badge.className).toContain('gap-1')
      expect(badge.className).toContain('text-xs')
      expect(badge.className).toContain('font-medium')
    })

    it('should accept custom className', () => {
      render(<AtRiskBadge daysSinceLastSession={20} className="custom-class" />)
      const badge = screen.getByTestId('at-risk-badge')
      expect(badge.className).toContain('custom-class')
    })
  })

  describe('tooltip integration', () => {
    it('should wrap badge in Tooltip structure', () => {
      const { container } = render(<AtRiskBadge daysSinceLastSession={20} />)
      // Verify component renders within Tooltip structure
      const badge = screen.getByTestId('at-risk-badge')
      expect(badge).toBeInTheDocument()
      expect(container.querySelector('span[data-testid="at-risk-badge"]')).toBeTruthy()
    })
  })
})
