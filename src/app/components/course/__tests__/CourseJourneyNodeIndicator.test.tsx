import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CourseJourneyNodeIndicator } from '../CourseJourneyNodeIndicator'

describe('CourseJourneyNodeIndicator', () => {
  it('renders completed state with check glyph and accessible label', () => {
    render(<CourseJourneyNodeIndicator status="completed" />)
    const node = screen.getByRole('img', { name: 'Completed module' })
    expect(node).toHaveAttribute('data-status', 'completed')
    expect(node.querySelector('svg')).toBeTruthy()
    expect(node.querySelector('svg polyline, svg path')).toBeTruthy()
    expect(node.querySelector('svg circle')).toBeNull()
  })

  it('renders active state with inner dot and label', () => {
    render(<CourseJourneyNodeIndicator status="active" />)
    const node = screen.getByRole('img', { name: 'Current module' })
    expect(node).toHaveAttribute('data-status', 'active')
    expect(node.querySelector('span.size-2.rounded-full')).toBeInTheDocument()
    expect(node.querySelector('svg')).toBeNull()
  })

  it('renders upcoming state with circle outline glyph and label (not a lock)', () => {
    render(<CourseJourneyNodeIndicator status="upcoming" />)
    const node = screen.getByRole('img', { name: 'Upcoming module' })
    expect(node).toHaveAttribute('data-status', 'upcoming')
    expect(node.querySelector('svg circle')).toBeTruthy()
  })
})
