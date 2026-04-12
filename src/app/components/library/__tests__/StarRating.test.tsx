/**
 * Unit tests for StarRating component — E113-S01
 *
 * Covers AC-1 (interactive star rating with half-star support) and
 * AC-6 (read-only display on BookCard).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StarRating } from '../StarRating'

describe('StarRating — AC-6: read-only display', () => {
  it('renders with role=img in readonly mode', () => {
    render(<StarRating value={4} readonly />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('shows correct aria-label for a full rating', () => {
    render(<StarRating value={3} readonly />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Rating: 3 out of 5 stars')
  })

  it('shows correct aria-label for a half-star rating', () => {
    render(<StarRating value={3.5} readonly />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Rating: 3.5 out of 5 stars')
  })

  it('is not keyboard focusable in readonly mode', () => {
    render(<StarRating value={4} readonly />)
    const el = screen.getByRole('img')
    expect(el).not.toHaveAttribute('tabindex')
  })

  it('does not call onChange when clicked in readonly mode', () => {
    const onChange = vi.fn()
    render(<StarRating value={3} readonly onChange={onChange} />)
    const container = screen.getByRole('img')
    fireEvent.click(container)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('StarRating — AC-1: interactive rating', () => {
  it('renders with role=slider when interactive', () => {
    render(<StarRating value={0} onChange={vi.fn()} />)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('is keyboard focusable when interactive', () => {
    render(<StarRating value={0} onChange={vi.fn()} />)
    expect(screen.getByRole('slider')).toHaveAttribute('tabindex', '0')
  })

  it('reports aria-valuenow and aria-valuemax', () => {
    render(<StarRating value={3} onChange={vi.fn()} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuenow', '3')
    expect(slider).toHaveAttribute('aria-valuemax', '5')
  })

  it('calls onChange with increased rating on ArrowRight', () => {
    const onChange = vi.fn()
    render(<StarRating value={2} onChange={onChange} />)
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(2.5)
  })

  it('calls onChange with decreased rating on ArrowLeft', () => {
    const onChange = vi.fn()
    render(<StarRating value={3} onChange={onChange} />)
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(2.5)
  })

  it('clamps keyboard navigation at minimum 0.5', () => {
    const onChange = vi.fn()
    render(<StarRating value={0.5} onChange={onChange} />)
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('clamps keyboard navigation at maximum 5', () => {
    const onChange = vi.fn()
    render(<StarRating value={5} onChange={onChange} />)
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(5)
  })
})
