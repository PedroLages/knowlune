import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BookStatusBadge } from '@/app/components/library/BookStatusBadge'

describe('BookStatusBadge', () => {
  it('renders nothing for unread status', () => {
    const { container } = render(<BookStatusBadge status="unread" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows Reading for reading status', () => {
    render(<BookStatusBadge status="reading" />)
    expect(screen.getByText('Reading')).toBeInTheDocument()
  })

  it('shows Finished for finished status', () => {
    render(<BookStatusBadge status="finished" />)
    expect(screen.getByText('Finished')).toBeInTheDocument()
  })

  it('shows Abandoned for abandoned status', () => {
    render(<BookStatusBadge status="abandoned" />)
    expect(screen.getByText('Abandoned')).toBeInTheDocument()
  })
})
