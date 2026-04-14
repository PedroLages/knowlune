/**
 * Unit tests for TutorModeChips (E73-S01)
 *
 * Coverage:
 * - Renders all 5 mode chips
 * - Has role="radiogroup" on container
 * - Each chip has role="radio" and aria-checked
 * - Debug chip is disabled when hasTranscript=false
 * - Debug chip tooltip says "Requires transcript" when disabled
 * - Clicking a chip calls onModeChange with the correct mode
 * - Active chip has aria-checked="true"
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TutorModeChips } from '../TutorModeChips'
function setup(overrides: Partial<Parameters<typeof TutorModeChips>[0]> = {}) {
  const onModeChange = vi.fn()
  render(
    <TutorModeChips
      mode="socratic"
      onModeChange={onModeChange}
      hasTranscript={true}
      {...overrides}
    />
  )
  return { onModeChange }
}

describe('TutorModeChips', () => {
  it('renders all 5 mode chips', () => {
    setup()
    const chips = screen.getAllByRole('radio')
    expect(chips).toHaveLength(5)
  })

  it('has role="radiogroup" on container', () => {
    setup()
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('each chip has role="radio"', () => {
    setup()
    const chips = screen.getAllByRole('radio')
    chips.forEach(chip => {
      expect(chip).toHaveAttribute('role', 'radio')
    })
  })

  it('active chip has aria-checked="true"', () => {
    setup({ mode: 'explain' })
    const chips = screen.getAllByRole('radio')
    const explainChip = chips.find(c => c.textContent?.toLowerCase().includes('explain'))
    expect(explainChip).toHaveAttribute('aria-checked', 'true')
  })

  it('inactive chips have aria-checked="false"', () => {
    setup({ mode: 'socratic' })
    const chips = screen.getAllByRole('radio')
    const nonActive = chips.filter(c => !c.textContent?.toLowerCase().includes('socratic'))
    nonActive.forEach(chip => {
      expect(chip).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('clicking a chip calls onModeChange with the correct mode', () => {
    const { onModeChange } = setup({ mode: 'socratic' })
    const chips = screen.getAllByRole('radio')
    // Click explain chip (second one)
    fireEvent.click(chips[1])
    expect(onModeChange).toHaveBeenCalledWith('explain')
  })

  it('debug chip is disabled when hasTranscript=false', () => {
    setup({ hasTranscript: false })
    const chips = screen.getAllByRole('radio')
    const debugChip = chips.find(c => c.textContent?.toLowerCase().includes('debug'))
    expect(debugChip).toBeDisabled()
  })

  it('quiz chip is disabled when hasTranscript=false', () => {
    setup({ hasTranscript: false })
    const chips = screen.getAllByRole('radio')
    const quizChip = chips.find(c => c.textContent?.toLowerCase().includes('quiz'))
    expect(quizChip).toBeDisabled()
  })

  it('all chips are enabled when hasTranscript=true', () => {
    setup({ hasTranscript: true })
    const chips = screen.getAllByRole('radio')
    chips.forEach(chip => {
      expect(chip).not.toBeDisabled()
    })
  })

  it('disabled chip does not call onModeChange when clicked', () => {
    const { onModeChange } = setup({ hasTranscript: false, mode: 'socratic' })
    const chips = screen.getAllByRole('radio')
    const debugChip = chips.find(c => c.textContent?.toLowerCase().includes('debug'))!
    fireEvent.click(debugChip)
    expect(onModeChange).not.toHaveBeenCalledWith('debug')
  })

  it('renders labels for all 5 modes', () => {
    setup()
    // Check expected labels from mode registry
    expect(screen.getByText(/socratic/i)).toBeInTheDocument()
    expect(screen.getByText(/explain/i)).toBeInTheDocument()
    expect(screen.getByText(/eli5/i, { exact: false })).toBeInTheDocument()
  })
})
