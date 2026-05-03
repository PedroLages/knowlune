import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineEditableField } from '../InlineEditableField'

describe('InlineEditableField', () => {
  it('renders read-only text when not editing', () => {
    render(<InlineEditableField value="Hello" onSave={vi.fn()} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('enters edit mode on click with input pre-filled', async () => {
    const user = userEvent.setup()
    render(<InlineEditableField value="Hello" onSave={vi.fn()} />)

    await user.click(screen.getByText('Hello'))

    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Hello')
  })

  it('saves on Enter key press', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<InlineEditableField value="Hello" onSave={onSave} />)

    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'World')
    await user.keyboard('{Enter}')

    expect(onSave).toHaveBeenCalledWith('World')
    // Back in read-only mode
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('saves on blur', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<InlineEditableField value="Hello" onSave={onSave} />)

    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Blurred')
    await user.tab() // blur

    expect(onSave).toHaveBeenCalledWith('Blurred')
  })

  it('reverts on Escape without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<InlineEditableField value="Original" onSave={onSave} />)

    await user.click(screen.getByText('Original'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Changed')
    await user.keyboard('{Escape}')

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Original')).toBeInTheDocument()
  })

  it('calls onSave even with unchanged value', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<InlineEditableField value="Same" onSave={onSave} />)

    await user.click(screen.getByText('Same'))
    await user.keyboard('{Enter}')

    expect(onSave).toHaveBeenCalledWith('Same')
  })

  it('calls onSave even with empty value (validation is callers responsibility)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<InlineEditableField value="Has Value" onSave={onSave} />)

    await user.click(screen.getByText('Has Value'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.keyboard('{Enter}')

    expect(onSave).toHaveBeenCalledWith('')
  })

  it('renders as textarea when as="textarea" prop is set', async () => {
    const user = userEvent.setup()
    render(
      <InlineEditableField
        value="Description"
        onSave={vi.fn()}
        as="textarea"
        ariaLabel="Edit description"
      />
    )

    await user.click(screen.getByText('Description'))
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
  })

  it('applies aria-label to input in edit mode', async () => {
    const user = userEvent.setup()
    render(
      <InlineEditableField
        value="Hello"
        onSave={vi.fn()}
        ariaLabel="Edit path name: Hello"
      />
    )

    await user.click(screen.getByText('Hello'))
    expect(screen.getByLabelText('Edit path name: Hello')).toBeInTheDocument()
  })

  it('uses fallback aria-label when not provided', async () => {
    const user = userEvent.setup()
    render(<InlineEditableField value="Fallback" onSave={vi.fn()} />)

    await user.click(screen.getByText('Fallback'))
    expect(screen.getByLabelText('Edit field')).toBeInTheDocument()
  })

  it('shows placeholder when value is empty', () => {
    render(
      <InlineEditableField
        value=""
        onSave={vi.fn()}
        placeholder="Add a description..."
      />
    )
    expect(screen.getByText('Add a description...')).toBeInTheDocument()
  })

  it('shows "Click to edit" when value is empty and no placeholder', () => {
    render(<InlineEditableField value="" onSave={vi.fn()} />)
    expect(screen.getByText('Click to edit')).toBeInTheDocument()
  })

  it('supports keyboard activation via Enter key on read-only text', async () => {
    const user = userEvent.setup()
    render(<InlineEditableField value="Keyboard" onSave={vi.fn()} />)

    const text = screen.getByText('Keyboard')
    text.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows visual confirmation (success border) after save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<InlineEditableField value="Confirm" onSave={onSave} />)

    await user.click(screen.getByText('Confirm'))
    await user.keyboard('{Enter}')

    // After save, the read-only text should have border-success class
    const display = screen.getByText('Confirm')
    expect(display.className).toContain('border-success')
  })

  it('syncs external value change when not editing', async () => {
    const { rerender } = render(
      <InlineEditableField value="Initial" onSave={vi.fn()} />
    )
    expect(screen.getByText('Initial')).toBeInTheDocument()

    rerender(<InlineEditableField value="Updated" onSave={vi.fn()} />)
    expect(screen.getByText('Updated')).toBeInTheDocument()
  })
})
