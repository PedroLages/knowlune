import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ContinueLearningBento } from '@/app/components/learning-path/ContinueLearningBento'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'

const baseEntry: LearningPathEntry = {
  id: 'entry-1',
  pathId: 'path-1',
  courseId: 'course-1',
  courseType: 'catalog',
  position: 1,
  isManuallyOrdered: false,
}

const baseCourseInfo: PathCourseInfo = {
  name: 'Test Course',
  type: 'catalog',
  authorName: 'Test Author',
  completionPct: 50,
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ContinueLearningBento', () => {
  it('renders course name and author', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} courseInfo={baseCourseInfo} />)
    expect(screen.getByText('Test Course')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })

  it('renders play button with correct link', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} courseInfo={baseCourseInfo} />)
    const playLink = screen.getByLabelText('Continue Test Course')
    expect(playLink).toBeInTheDocument()
    expect(playLink).toHaveAttribute('href', '/courses/course-1')
  })

  it('renders continue lesson button', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} courseInfo={baseCourseInfo} />)
    expect(screen.getByText('Continue lesson')).toBeInTheDocument()
  })

  it('renders view curriculum button when onViewCurriculum provided', () => {
    renderWithRouter(
      <ContinueLearningBento
        entry={baseEntry}
        courseInfo={baseCourseInfo}
        onViewCurriculum={() => {}}
      />
    )
    expect(screen.getByText('View curriculum')).toBeInTheDocument()
  })

  it('renders progress percentage', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} courseInfo={baseCourseInfo} />)
    expect(screen.getByText('50% complete')).toBeInTheDocument()
  })

  it('renders progress bar with correct width from completion percentage', () => {
    renderWithRouter(
      <ContinueLearningBento
        entry={baseEntry}
        courseInfo={{ ...baseCourseInfo, completionPct: 30 }}
      />
    )
    // Progress bar width reflects completion percentage
    const progressBar = document.querySelector('.bg-brand.h-full.rounded-full')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveStyle({ width: '30%' })
    // Completion text shows the percentage
    expect(screen.getByText('30% complete')).toBeInTheDocument()
  })

  it('handles missing thumbnail without crashing', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} courseInfo={baseCourseInfo} />)
    // Should render BookOpen fallback icon
    expect(screen.getByText('Test Course')).toBeInTheDocument()
    expect(screen.getByText('Continue lesson')).toBeInTheDocument()
  })

  it('handles missing course info gracefully', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} />)
    expect(screen.getByText('Unknown Course')).toBeInTheDocument()
    expect(screen.getByText('Continue lesson')).toBeInTheDocument()
  })
})
