import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GridColumnControl } from '@/app/components/courses/GridColumnControl'

describe('GridColumnControl (E99-S02)', () => {
  it('renders all five options with accessible labels', () => {
    render(<GridColumnControl value="auto" onChange={() => {}} />)

    expect(screen.getByRole('radio', { name: 'Auto columns' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '2 columns' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '3 columns' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '4 columns' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '5 columns' })).toBeInTheDocument()
  })

  it('marks the active option with data-state="on" and others "off"', () => {
    render(<GridColumnControl value={3} onChange={() => {}} />)

    expect(screen.getByRole('radio', { name: '3 columns' })).toHaveAttribute('data-state', 'on')
    expect(screen.getByRole('radio', { name: 'Auto columns' })).toHaveAttribute('data-state', 'off')
    expect(screen.getByRole('radio', { name: '2 columns' })).toHaveAttribute('data-state', 'off')
    expect(screen.getByRole('radio', { name: '4 columns' })).toHaveAttribute('data-state', 'off')
    expect(screen.getByRole('radio', { name: '5 columns' })).toHaveAttribute('data-state', 'off')
  })

  it('calls onChange with the typed numeric value when a number button is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<GridColumnControl value="auto" onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: '3 columns' }))

    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('calls onChange with "auto" (string) when the Auto button is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<GridColumnControl value={4} onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Auto columns' }))

    expect(onChange).toHaveBeenCalledWith('auto')
  })

  it('does NOT call onChange with empty string when the active item is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<GridColumnControl value="auto" onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Auto columns' }))

    for (const call of onChange.mock.calls) {
      expect(['auto', 2, 3, 4, 5]).toContain(call[0])
    }
  })

  it('exposes an accessible group label', () => {
    render(<GridColumnControl value="auto" onChange={() => {}} />)
    expect(screen.getByLabelText('Course grid column count')).toBeInTheDocument()
  })

  it('applies 44px minimum touch-target classes to every item', () => {
    render(<GridColumnControl value="auto" onChange={() => {}} />)

    for (const label of ['Auto columns', '2 columns', '3 columns', '4 columns', '5 columns']) {
      const item = screen.getByRole('radio', { name: label })
      expect(item.className).toContain('min-h-11')
      expect(item.className).toContain('min-w-11')
    }
  })

  it('renders the mobile-only "Applies on larger screens" hint', () => {
    render(<GridColumnControl value="auto" onChange={() => {}} />)
    const hint = screen.getByTestId('course-grid-columns-mobile-hint')
    expect(hint).toBeInTheDocument()
    expect(hint.textContent).toBe('Applies on larger screens')
    expect(hint.className).toContain('sm:hidden')
  })
})
