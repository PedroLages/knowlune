import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PathProgressSidebar } from '@/app/components/learning-path/PathProgressSidebar'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

function makeProgress(overrides: Partial<PathProgressSummary> = {}): PathProgressSummary {
  return {
    completionPct: 0,
    completedLessons: 0,
    totalLessons: 10,
    completedCourses: 0,
    totalCourses: 5,
    estimatedRemainingHours: 20,
    courseProgress: new Map(),
    ...overrides,
  }
}

describe('PathProgressSidebar', () => {
  it('renders progress ring with correct percentage', () => {
    render(<PathProgressSidebar progress={makeProgress({ completionPct: 42 })} />)
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('renders modules completed stat', () => {
    render(<PathProgressSidebar progress={makeProgress({ completedCourses: 3, totalCourses: 5 })} />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('renders estimated time left', () => {
    render(<PathProgressSidebar progress={makeProgress({ estimatedRemainingHours: 15 })} />)
    expect(screen.getByText('~15h')).toBeInTheDocument()
  })

  it('renders 0h when no remaining hours', () => {
    render(<PathProgressSidebar progress={makeProgress({ estimatedRemainingHours: 0 })} />)
    expect(screen.getByText('0h')).toBeInTheDocument()
  })

  it('renders skill tags from props', () => {
    render(
      <PathProgressSidebar
        progress={makeProgress()}
        skillTags={['React', 'TypeScript', 'Node.js']}
      />
    )
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Node.js')).toBeInTheDocument()
  })

  it('hides skills section when no tags provided', () => {
    render(<PathProgressSidebar progress={makeProgress()} />)
    expect(screen.queryByText("Skills you'll gain")).not.toBeInTheDocument()
  })

  it('hides skills section when empty tags array', () => {
    render(<PathProgressSidebar progress={makeProgress()} skillTags={[]} />)
    expect(screen.queryByText("Skills you'll gain")).not.toBeInTheDocument()
  })

  it('renders certificate card with trophy', () => {
    render(<PathProgressSidebar progress={makeProgress()} />)
    expect(screen.getByText('Earn a Certificate')).toBeInTheDocument()
    expect(screen.getByText(/Complete all modules/)).toBeInTheDocument()
  })

  it('progress ring has correct aria attributes', () => {
    render(<PathProgressSidebar progress={makeProgress({ completionPct: 75 })} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '75')
  })

  it('renders 0% state correctly', () => {
    render(<PathProgressSidebar progress={makeProgress({ completionPct: 0, completedCourses: 0 })} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('renders 100% state correctly', () => {
    render(
      <PathProgressSidebar
        progress={makeProgress({ completionPct: 100, completedCourses: 5, estimatedRemainingHours: 0 })}
      />
    )
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('5/5')).toBeInTheDocument()
    expect(screen.getByText('0h')).toBeInTheDocument()
  })
})
