/**
 * Unit tests for DebugTrafficLight (E73-S04)
 *
 * Coverage:
 * - Renders green variant with correct label
 * - Renders yellow variant with correct label
 * - Renders red variant with correct label
 * - Outer span has aria-label
 * - Visible text has aria-hidden="true"
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DebugTrafficLight } from '../DebugTrafficLight'

describe('DebugTrafficLight', () => {
  it('renders "green" variant with label "Solid"', () => {
    render(<DebugTrafficLight assessment="green" />)
    expect(screen.getByText('Solid')).toBeInTheDocument()
  })

  it('renders "yellow" variant with label "Gaps found"', () => {
    render(<DebugTrafficLight assessment="yellow" />)
    expect(screen.getByText('Gaps found')).toBeInTheDocument()
  })

  it('renders "red" variant with label "Misconception"', () => {
    render(<DebugTrafficLight assessment="red" />)
    expect(screen.getByText('Misconception')).toBeInTheDocument()
  })

  it('has aria-label on the outer span', () => {
    const { container } = render(<DebugTrafficLight assessment="green" />)
    const span = container.querySelector('[aria-label]')
    expect(span).not.toBeNull()
    expect(span?.getAttribute('aria-label')).toContain('Assessment')
  })

  it('visible text has aria-hidden="true"', () => {
    const { container } = render(<DebugTrafficLight assessment="red" />)
    const hiddenSpan = container.querySelector('[aria-hidden="true"]')
    expect(hiddenSpan).not.toBeNull()
    expect(hiddenSpan?.textContent).toBe('Misconception')
  })
})
