import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress } from '../progress'

describe('Progress', () => {
  describe('Value Normalization', () => {
    it('normalizes values below 0 to 0', () => {
      render(<Progress value={-10} showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
      expect(screen.getByText('0% complete')).toBeInTheDocument()
    })

    it('normalizes values above 100 to 100', () => {
      render(<Progress value={150} showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '100')
      expect(screen.getByText('100% complete')).toBeInTheDocument()
    })

    it('preserves values within 0-100 range', () => {
      render(<Progress value={65} showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '65')
      expect(screen.getByText('65% complete')).toBeInTheDocument()
    })

    it('handles NaN by normalizing to 0', () => {
      render(<Progress value={NaN} showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
    })

    it('handles undefined value by defaulting to 0', () => {
      render(<Progress showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
      expect(screen.getByText('0% complete')).toBeInTheDocument()
    })

    it('handles fractional values correctly', () => {
      render(<Progress value={33.7} showLabel />)
      screen.getByRole('progressbar')
      // Math.min/max preserves decimals, but display should round
      expect(screen.getByText('33.7% complete')).toBeInTheDocument()
    })
  })

  describe('ARIA Attributes', () => {
    it('includes required ARIA attributes', () => {
      render(<Progress value={50} />)
      const progressBar = screen.getByRole('progressbar')

      expect(progressBar).toHaveAttribute('role', 'progressbar')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      expect(progressBar).toHaveAttribute('aria-valuenow', '50')
      expect(progressBar).toHaveAttribute('aria-label', '50% complete')
    })

    it('updates aria-valuenow when value changes', () => {
      const { rerender } = render(<Progress value={30} />)
      let progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '30')

      rerender(<Progress value={75} />)
      progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
    })

    it('updates aria-label with custom labelFormat', () => {
      render(<Progress value={50} labelFormat={v => `${v}% done`} />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', '50% done')
    })
  })

  describe('Label Display', () => {
    it('hides label by default', () => {
      render(<Progress value={50} />)
      expect(screen.queryByText('50% complete')).not.toBeInTheDocument()
    })

    it('shows label when showLabel is true', () => {
      render(<Progress value={50} showLabel />)
      expect(screen.getByText('50% complete')).toBeInTheDocument()
    })

    it('uses default labelFormat when not provided', () => {
      render(<Progress value={42} showLabel />)
      expect(screen.getByText('42% complete')).toBeInTheDocument()
    })

    it('uses custom labelFormat when provided', () => {
      render(<Progress value={80} showLabel labelFormat={v => `Progress: ${v}%`} />)
      expect(screen.getByText('Progress: 80%')).toBeInTheDocument()
    })

    it('applies aria-hidden to visible label to avoid duplication', () => {
      render(<Progress value={50} showLabel />)
      const label = screen.getByText('50% complete')
      expect(label).toHaveAttribute('aria-hidden', 'true')
    })

    it('applies tabular-nums class to label for consistent width', () => {
      render(<Progress value={50} showLabel />)
      const label = screen.getByText('50% complete')
      expect(label).toHaveClass('tabular-nums')
    })
  })

  describe('Edge Cases', () => {
    it('handles 0% correctly', () => {
      render(<Progress value={0} showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
      expect(screen.getByText('0% complete')).toBeInTheDocument()
    })

    it('handles 100% correctly', () => {
      render(<Progress value={100} showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '100')
      expect(screen.getByText('100% complete')).toBeInTheDocument()
    })

    it('handles very small positive values', () => {
      render(<Progress value={0.1} showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0.1')
    })

    it('handles very large negative values', () => {
      render(<Progress value={-999} showLabel />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
    })
  })

  describe('Styling and Customization', () => {
    it('accepts custom className', () => {
      render(<Progress value={50} className="h-4 custom-class" />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveClass('h-4', 'custom-class')
    })

    it('renders progress indicator with correct data-slot', () => {
      const { container } = render(<Progress value={50} />)
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      expect(indicator).toBeInTheDocument()
    })

    it('applies motion-reduce classes for accessibility', () => {
      const { container } = render(<Progress value={50} />)
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      expect(indicator).toHaveClass('motion-reduce:transition-none')
      expect(indicator).toHaveClass('motion-safe:transition-all')
    })
  })

  describe('Visual Progress Representation', () => {
    it('sets correct transform for 0%', () => {
      const { container } = render(<Progress value={0} />)
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' })
    })

    it('sets correct transform for 50%', () => {
      const { container } = render(<Progress value={50} />)
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      expect(indicator).toHaveStyle({ transform: 'translateX(-50%)' })
    })

    it('sets correct transform for 100%', () => {
      const { container } = render(<Progress value={100} />)
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      // translateX(-0%) is equivalent to translateX(0%), both represent full progress
      expect(indicator).toHaveStyle({ transform: 'translateX(-0%)' })
    })
  })

  describe('Integration with Radix UI', () => {
    it('passes value prop to Radix ProgressPrimitive.Root', () => {
      render(<Progress value={75} />)
      const progressBar = screen.getByRole('progressbar')
      // Radix sets data-state based on value prop
      // value={75} should set data-state="loading" (partial progress)
      expect(progressBar).toHaveAttribute('data-value', '75')
    })

    it('includes data-slot for styling hooks', () => {
      const { container } = render(<Progress value={50} />)
      const root = container.querySelector('[data-slot="progress"]')
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      expect(root).toBeInTheDocument()
      expect(indicator).toBeInTheDocument()
    })
  })
})
