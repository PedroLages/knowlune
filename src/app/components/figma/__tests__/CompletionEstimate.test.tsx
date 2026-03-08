import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompletionEstimate } from '../CompletionEstimate'

describe('CompletionEstimate', () => {
  describe('rendering', () => {
    it('should render with data-testid', () => {
      render(<CompletionEstimate sessionsNeeded={5} estimatedDays={5} />)
      expect(screen.getByTestId('completion-estimate')).toBeInTheDocument()
    })

    it('should render Clock icon', () => {
      render(<CompletionEstimate sessionsNeeded={3} estimatedDays={3} />)
      const estimate = screen.getByTestId('completion-estimate')
      const svg = estimate.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg!.classList.contains('lucide-clock')).toBe(true)
    })

    it('should mark icon as aria-hidden', () => {
      render(<CompletionEstimate sessionsNeeded={5} estimatedDays={5} />)
      const estimate = screen.getByTestId('completion-estimate')
      const svg = estimate.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('display logic — sessions vs days', () => {
    it('should display sessions when < 10 sessions needed', () => {
      render(<CompletionEstimate sessionsNeeded={5} estimatedDays={5} />)
      const estimate = screen.getByTestId('completion-estimate')
      expect(estimate).toHaveTextContent('Est. ~5 sessions')
    })

    it('should display days when >= 10 sessions needed', () => {
      render(<CompletionEstimate sessionsNeeded={15} estimatedDays={15} />)
      const estimate = screen.getByTestId('completion-estimate')
      expect(estimate).toHaveTextContent('Est. ~15 days')
    })

    it('should use estimatedDays value when >= 10 sessions', () => {
      // When sessions >= 10, estimatedDays is used (may differ from sessionsNeeded)
      render(<CompletionEstimate sessionsNeeded={15} estimatedDays={20} />)
      const estimate = screen.getByTestId('completion-estimate')
      expect(estimate).toHaveTextContent('Est. ~20 days')
    })

    it('should display sessions at boundary (9 sessions)', () => {
      render(<CompletionEstimate sessionsNeeded={9} estimatedDays={9} />)
      const estimate = screen.getByTestId('completion-estimate')
      expect(estimate).toHaveTextContent('Est. ~9 sessions')
    })

    it('should display days at boundary (10 sessions)', () => {
      render(<CompletionEstimate sessionsNeeded={10} estimatedDays={10} />)
      const estimate = screen.getByTestId('completion-estimate')
      expect(estimate).toHaveTextContent('Est. ~10 days')
    })
  })

  describe('pluralization', () => {
    it('should use singular "session" for 1 session', () => {
      render(<CompletionEstimate sessionsNeeded={1} estimatedDays={1} />)
      expect(screen.getByTestId('completion-estimate')).toHaveTextContent('Est. ~1 session')
    })

    it('should use plural "sessions" for 2+ sessions', () => {
      render(<CompletionEstimate sessionsNeeded={2} estimatedDays={2} />)
      expect(screen.getByTestId('completion-estimate')).toHaveTextContent('Est. ~2 sessions')
    })

    it('should use singular "day" for 1 day (>= 10 sessions)', () => {
      render(<CompletionEstimate sessionsNeeded={10} estimatedDays={1} />)
      expect(screen.getByTestId('completion-estimate')).toHaveTextContent('Est. ~1 day')
    })

    it('should use plural "days" for 2+ days', () => {
      render(<CompletionEstimate sessionsNeeded={20} estimatedDays={20} />)
      expect(screen.getByTestId('completion-estimate')).toHaveTextContent('Est. ~20 days')
    })
  })

  describe('edge cases', () => {
    it('should handle 0 sessions needed', () => {
      render(<CompletionEstimate sessionsNeeded={0} estimatedDays={0} />)
      expect(screen.getByTestId('completion-estimate')).toHaveTextContent('Est. ~0 sessions')
    })

    it('should handle very large session counts', () => {
      render(<CompletionEstimate sessionsNeeded={100} estimatedDays={100} />)
      expect(screen.getByTestId('completion-estimate')).toHaveTextContent('Est. ~100 days')
    })

    it('should handle mismatched sessions/days (sessions < 10, different estimatedDays)', () => {
      // Edge case: should use sessionsNeeded when < 10, ignore estimatedDays
      render(<CompletionEstimate sessionsNeeded={5} estimatedDays={20} />)
      expect(screen.getByTestId('completion-estimate')).toHaveTextContent('Est. ~5 sessions')
    })
  })

  describe('CSS classes', () => {
    it('should have base styling classes', () => {
      render(<CompletionEstimate sessionsNeeded={5} estimatedDays={5} />)
      const estimate = screen.getByTestId('completion-estimate')
      expect(estimate.className).toContain('inline-flex')
      expect(estimate.className).toContain('items-center')
      expect(estimate.className).toContain('gap-1.5')
      expect(estimate.className).toContain('text-sm')
      expect(estimate.className).toContain('text-muted-foreground')
    })

    it('should accept custom className', () => {
      render(<CompletionEstimate sessionsNeeded={5} estimatedDays={5} className="custom-class" />)
      const estimate = screen.getByTestId('completion-estimate')
      expect(estimate.className).toContain('custom-class')
    })
  })

  describe('icon rendering', () => {
    it('should render Clock icon within estimate', () => {
      render(<CompletionEstimate sessionsNeeded={5} estimatedDays={5} />)
      const estimate = screen.getByTestId('completion-estimate')
      const svg = estimate.querySelector('svg')
      expect(svg).toBeTruthy()
    })
  })
})
