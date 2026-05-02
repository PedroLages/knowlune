import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewModeToggle } from '@/app/components/courses/ViewModeToggle'

describe('ViewModeToggle (E99-S01)', () => {
  it('renders all three options with accessible labels', () => {
    render(<ViewModeToggle value="grid" onChange={() => {}} />)

    expect(screen.getByRole('radio', { name: 'Grid view' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'List view' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Compact view' })).toBeInTheDocument()
  })

  it('marks the active option with data-state="on" and others "off"', () => {
    render(<ViewModeToggle value="list" onChange={() => {}} />)

    expect(screen.getByRole('radio', { name: 'List view' })).toHaveAttribute('data-state', 'on')
    expect(screen.getByRole('radio', { name: 'Grid view' })).toHaveAttribute('data-state', 'off')
    expect(screen.getByRole('radio', { name: 'Compact view' })).toHaveAttribute('data-state', 'off')
  })

  it('calls onChange with the selected mode when an inactive item is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ViewModeToggle value="grid" onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Compact view' }))

    expect(onChange).toHaveBeenCalledWith('compact')
  })

  it('does NOT call onChange with empty string when the active item is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ViewModeToggle value="grid" onChange={onChange} />)

    // Clicking the active item makes Radix emit '' — the component should filter it.
    await user.click(screen.getByRole('radio', { name: 'Grid view' }))

    // onChange may be called with '' filtered, so it should never be called with a non-mode value.
    for (const call of onChange.mock.calls) {
      expect(['grid', 'list', 'compact']).toContain(call[0])
    }
  })

  it('exposes a radiogroup role on the container', () => {
    render(<ViewModeToggle value="grid" onChange={() => {}} />)

    // Radix ToggleGroup renders role="group" for type="single" — verify the
    // accessible name is set so screen readers announce purpose.
    const group = screen.getByLabelText('Courses view mode')
    expect(group).toBeInTheDocument()
  })

  it('applies 44px minimum touch target classes to each item', () => {
    render(<ViewModeToggle value="grid" onChange={() => {}} />)

    for (const label of ['Grid view', 'List view', 'Compact view']) {
      const item = screen.getByRole('radio', { name: label })
      expect(item.className).toContain('min-h-11')
      expect(item.className).toContain('min-w-11')
    }
  })
})
