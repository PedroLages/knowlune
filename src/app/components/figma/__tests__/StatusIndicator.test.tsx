import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusIndicator } from '../StatusIndicator'

describe('StatusIndicator', () => {
  describe('interactive mode (default)', () => {
    it('should render a button element', () => {
      render(<StatusIndicator status="not-started" itemId="test-1" />)
      const el = screen.getByTestId('status-indicator-test-1')
      expect(el.tagName).toBe('BUTTON')
    })

    it('should have min-h-11 min-w-11 for 44px touch target', () => {
      render(<StatusIndicator status="not-started" itemId="test-1" />)
      const el = screen.getByTestId('status-indicator-test-1')
      expect(el.className).toContain('min-h-11')
      expect(el.className).toContain('min-w-11')
    })

    it('should call onClick when clicked', async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()
      render(<StatusIndicator status="not-started" itemId="test-1" onClick={handleClick} />)
      await user.click(screen.getByTestId('status-indicator-test-1'))
      expect(handleClick).toHaveBeenCalledOnce()
    })

    it('should set data-status attribute', () => {
      render(<StatusIndicator status="in-progress" itemId="test-1" />)
      expect(screen.getByTestId('status-indicator-test-1')).toHaveAttribute(
        'data-status',
        'in-progress'
      )
    })
  })

  describe('display mode', () => {
    it('should render a span element (not a button)', () => {
      render(<StatusIndicator status="not-started" itemId="test-1" mode="display" />)
      const el = screen.getByTestId('status-indicator-test-1')
      expect(el.tagName).toBe('SPAN')
    })

    it('should set data-status attribute', () => {
      render(<StatusIndicator status="completed" itemId="test-1" mode="display" />)
      expect(screen.getByTestId('status-indicator-test-1')).toHaveAttribute(
        'data-status',
        'completed'
      )
    })
  })

  describe('status rendering', () => {
    it('should render Check icon for completed status', () => {
      render(<StatusIndicator status="completed" itemId="test-1" />)
      const el = screen.getByTestId('status-indicator-test-1')
      const svg = el.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg!.classList.contains('lucide-check')).toBe(true)
    })

    it('should render Circle icon for not-started status', () => {
      render(<StatusIndicator status="not-started" itemId="test-1" />)
      const el = screen.getByTestId('status-indicator-test-1')
      const svg = el.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg!.classList.contains('lucide-circle')).toBe(true)
    })

    it('should render filled Circle for in-progress status', () => {
      render(<StatusIndicator status="in-progress" itemId="test-1" />)
      const el = screen.getByTestId('status-indicator-test-1')
      const svg = el.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg!.classList.contains('lucide-circle')).toBe(true)
      expect(svg!.classList.contains('fill-current')).toBe(true)
    })
  })

  describe('accessibility', () => {
    it('should have aria-label for not-started', () => {
      render(<StatusIndicator status="not-started" itemId="test-1" />)
      expect(screen.getByTestId('status-indicator-test-1')).toHaveAttribute(
        'aria-label',
        'Not Started'
      )
    })

    it('should have aria-label for in-progress', () => {
      render(<StatusIndicator status="in-progress" itemId="test-1" />)
      expect(screen.getByTestId('status-indicator-test-1')).toHaveAttribute(
        'aria-label',
        'In Progress'
      )
    })

    it('should have aria-label for completed', () => {
      render(<StatusIndicator status="completed" itemId="test-1" />)
      expect(screen.getByTestId('status-indicator-test-1')).toHaveAttribute(
        'aria-label',
        'Completed'
      )
    })
  })

  describe('color classes', () => {
    it('should use text-blue-600 for in-progress', () => {
      render(<StatusIndicator status="in-progress" itemId="test-1" />)
      const el = screen.getByTestId('status-indicator-test-1')
      expect(el.className).toContain('text-blue-600')
    })

    it('should use text-green-600 for completed', () => {
      render(<StatusIndicator status="completed" itemId="test-1" />)
      const el = screen.getByTestId('status-indicator-test-1')
      expect(el.className).toContain('text-green-600')
    })

    it('should use text-muted-foreground/60 for not-started', () => {
      render(<StatusIndicator status="not-started" itemId="test-1" />)
      const el = screen.getByTestId('status-indicator-test-1')
      expect(el.className).toContain('text-muted-foreground/60')
    })
  })
})
