import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ControlBarSection } from '@/app/components/courses/ControlBarSection'

describe('ControlBarSection', () => {
  it('renders label text and children', () => {
    render(
      <ControlBarSection label="Filter" showDivider={false}>
        <button type="button">Test child</button>
      </ControlBarSection>
    )

    expect(screen.getByText('Filter')).toBeInTheDocument()
    expect(screen.getByText('Test child')).toBeInTheDocument()
  })

  it('renders vertical separator when showDivider is true (default)', () => {
    const { container } = render(
      <ControlBarSection label="Sort">
        <button type="button">Child</button>
      </ControlBarSection>
    )

    // Separator component renders a div with data-slot="separator-root" and orientation vertical
    const separator = container.querySelector('[data-slot="separator-root"]')
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveAttribute('data-orientation', 'vertical')
  })

  it('does not render vertical separator when showDivider is false', () => {
    const { container } = render(
      <ControlBarSection label="Filter" showDivider={false}>
        <button type="button">Child</button>
      </ControlBarSection>
    )

    expect(container.querySelector('[data-slot="separator-root"]')).not.toBeInTheDocument()
  })

  it('renders label with uppercase tracking-wider styling', () => {
    render(
      <ControlBarSection label="View" showDivider={false}>
        <button type="button">Child</button>
      </ControlBarSection>
    )

    const label = screen.getByText('View')
    expect(label).toHaveClass('uppercase')
    expect(label).toHaveClass('tracking-wider')
    expect(label).toHaveClass('text-xs')
  })
})
