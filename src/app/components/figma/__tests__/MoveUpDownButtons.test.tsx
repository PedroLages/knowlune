import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MoveUpDownButtons } from '../MoveUpDownButtons'

describe('MoveUpDownButtons', () => {
  const baseProps = {
    index: 1,
    total: 3,
    itemLabel: 'React Basics',
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
  }

  describe('rendering', () => {
    it('renders Move Up and Move Down buttons with item-derived aria-labels', () => {
      render(<MoveUpDownButtons {...baseProps} />)
      expect(screen.getByRole('button', { name: 'Move React Basics up' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Move React Basics down' })).toBeInTheDocument()
    })

    it('marks chevron icons as aria-hidden', () => {
      const { container } = render(<MoveUpDownButtons {...baseProps} />)
      container.querySelectorAll('svg').forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true')
      })
    })

    it('meets 44x44 minimum touch target with default size', () => {
      render(<MoveUpDownButtons {...baseProps} />)
      const upBtn = screen.getByRole('button', { name: /up/ })
      expect(upBtn.className).toContain('min-w-11')
      expect(upBtn.className).toContain('min-h-11')
    })
  })

  describe('disabled boundaries (aria-disabled, not HTML disabled)', () => {
    it('disables Move Up at first position with aria-disabled="true"', () => {
      render(<MoveUpDownButtons {...baseProps} index={0} />)
      const upBtn = screen.getByRole('button', { name: /up/ })
      expect(upBtn).toHaveAttribute('aria-disabled', 'true')
      // Stays focusable for screen readers
      expect(upBtn).not.toHaveAttribute('disabled')
    })

    it('disables Move Down at last position with aria-disabled="true"', () => {
      render(<MoveUpDownButtons {...baseProps} index={2} total={3} />)
      const downBtn = screen.getByRole('button', { name: /down/ })
      expect(downBtn).toHaveAttribute('aria-disabled', 'true')
      expect(downBtn).not.toHaveAttribute('disabled')
    })

    it('disables both buttons when total === 1', () => {
      render(<MoveUpDownButtons {...baseProps} index={0} total={1} />)
      expect(screen.getByRole('button', { name: /up/ })).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByRole('button', { name: /down/ })).toHaveAttribute('aria-disabled', 'true')
    })

    it('does not invoke onMoveUp when disabled', () => {
      const onMoveUp = vi.fn()
      render(<MoveUpDownButtons {...baseProps} index={0} onMoveUp={onMoveUp} />)
      fireEvent.click(screen.getByRole('button', { name: /up/ }))
      expect(onMoveUp).not.toHaveBeenCalled()
    })

    it('does not invoke onMoveDown when disabled', () => {
      const onMoveDown = vi.fn()
      render(<MoveUpDownButtons {...baseProps} index={2} total={3} onMoveDown={onMoveDown} />)
      fireEvent.click(screen.getByRole('button', { name: /down/ }))
      expect(onMoveDown).not.toHaveBeenCalled()
    })
  })

  describe('active click handlers', () => {
    it('invokes onMoveUp when clicked at a non-boundary position', () => {
      const onMoveUp = vi.fn()
      render(<MoveUpDownButtons {...baseProps} onMoveUp={onMoveUp} />)
      fireEvent.click(screen.getByRole('button', { name: /up/ }))
      expect(onMoveUp).toHaveBeenCalledTimes(1)
    })

    it('invokes onMoveDown when clicked at a non-boundary position', () => {
      const onMoveDown = vi.fn()
      render(<MoveUpDownButtons {...baseProps} onMoveDown={onMoveDown} />)
      fireEvent.click(screen.getByRole('button', { name: /down/ }))
      expect(onMoveDown).toHaveBeenCalledTimes(1)
    })
  })

  describe('layout variants', () => {
    it('uses flex-col by default (vertical orientation)', () => {
      const { container } = render(<MoveUpDownButtons {...baseProps} />)
      expect(container.firstChild).toHaveClass('flex-col')
    })

    it('uses flex-row when orientation is horizontal', () => {
      const { container } = render(<MoveUpDownButtons {...baseProps} orientation="horizontal" />)
      expect(container.firstChild).toHaveClass('flex-row')
    })

    it('uses 28px buttons when size="sm"', () => {
      render(<MoveUpDownButtons {...baseProps} size="sm" />)
      const upBtn = screen.getByRole('button', { name: /up/ })
      expect(upBtn.className).toContain('size-7')
    })
  })

  describe('refs and testids', () => {
    it('forwards refs to underlying buttons', () => {
      const upRef = { current: null as HTMLButtonElement | null }
      const downRef = { current: null as HTMLButtonElement | null }
      render(<MoveUpDownButtons {...baseProps} upRef={upRef} downRef={downRef} />)
      expect(upRef.current).toBeInstanceOf(HTMLButtonElement)
      expect(downRef.current).toBeInstanceOf(HTMLButtonElement)
    })

    it('emits scoped data-testid when testIdPrefix is provided', () => {
      render(<MoveUpDownButtons {...baseProps} testIdPrefix="course-row-1" />)
      expect(screen.getByTestId('course-row-1-up')).toBeInTheDocument()
      expect(screen.getByTestId('course-row-1-down')).toBeInTheDocument()
    })
  })
})
