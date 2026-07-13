import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByRole('heading', { name: 'Test Course' })).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })

  it('renders play button with correct link', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} courseInfo={baseCourseInfo} />)
    const playLink = screen.getByLabelText('Resume Test Course')
    expect(playLink).toBeInTheDocument()
    expect(playLink).toHaveAttribute('href', '/courses/course-1')
  })

  it('renders resume lesson button', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} courseInfo={baseCourseInfo} />)
    expect(screen.getByText('Resume lesson')).toBeInTheDocument()
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
    expect(screen.getByTestId('continue-learning-placeholder')).toBeInTheDocument()
    expect(screen.getByText('Resume lesson')).toBeInTheDocument()
  })

  it('handles missing course info gracefully', () => {
    renderWithRouter(<ContinueLearningBento entry={baseEntry} />)
    expect(screen.getByText('Unknown Course')).toBeInTheDocument()
    expect(screen.getByText('Resume lesson')).toBeInTheDocument()
  })

  it('prefers an image thumbnail over the server video preview', () => {
    renderWithRouter(
      <ContinueLearningBento
        entry={baseEntry}
        courseInfo={baseCourseInfo}
        thumbnailUrl="https://media.example/thumb.jpg"
        videoPreviewUrl="https://media.example/lesson.mp4"
      />
    )

    expect(screen.getByTestId('continue-learning-thumbnail')).toHaveAttribute(
      'src',
      'https://media.example/thumb.jpg'
    )
    expect(screen.queryByTestId('continue-learning-video-preview')).not.toBeInTheDocument()
  })

  it('falls back to the server video when the thumbnail fails', () => {
    renderWithRouter(
      <ContinueLearningBento
        entry={baseEntry}
        courseInfo={baseCourseInfo}
        thumbnailUrl="https://media.example/broken.jpg"
        videoPreviewUrl="https://media.example/lesson.mp4"
      />
    )

    fireEvent.error(screen.getByTestId('continue-learning-thumbnail'))

    expect(screen.queryByTestId('continue-learning-thumbnail')).not.toBeInTheDocument()
    expect(screen.getByTestId('continue-learning-video-preview')).toHaveAttribute(
      'src',
      'https://media.example/lesson.mp4'
    )
  })

  it('renders a muted, paused, non-interactive static video preview', () => {
    renderWithRouter(
      <ContinueLearningBento
        entry={baseEntry}
        courseInfo={baseCourseInfo}
        videoPreviewUrl="https://media.example/lesson.mp4"
      />
    )

    const video = screen.getByTestId('continue-learning-video-preview') as HTMLVideoElement
    expect(video).toHaveAttribute('preload', 'metadata')
    expect(video.muted).toBe(true)
    expect(video.autoplay).toBe(false)
    expect(video.controls).toBe(false)
    expect(video.playsInline).toBe(true)
    expect(video).toHaveAttribute('tabindex', '-1')
    expect(video).toHaveClass('pointer-events-none', 'opacity-0')

    fireEvent.loadedData(video)
    expect(video).toHaveClass('opacity-100')
  })

  it.each([
    { duration: 20, expectedTime: 2 },
    { duration: 120, expectedTime: 3 },
  ])('seeks a $duration-second preview to $expectedTime seconds', ({ duration, expectedTime }) => {
    renderWithRouter(
      <ContinueLearningBento
        entry={baseEntry}
        courseInfo={baseCourseInfo}
        videoPreviewUrl="https://media.example/lesson.mp4"
      />
    )

    const video = screen.getByTestId('continue-learning-video-preview') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { configurable: true, value: duration })

    fireEvent.loadedMetadata(video)

    expect(video.currentTime).toBe(expectedTime)
  })

  it('keeps the placeholder visible and hides a failed video preview', () => {
    renderWithRouter(
      <ContinueLearningBento
        entry={baseEntry}
        courseInfo={baseCourseInfo}
        videoPreviewUrl="https://media.example/broken.mp4"
      />
    )

    const video = screen.getByTestId('continue-learning-video-preview')
    fireEvent.loadedData(video)
    expect(video).toHaveClass('opacity-100')

    fireEvent.error(video)

    expect(screen.getByTestId('continue-learning-placeholder')).toBeInTheDocument()
    expect(video).toHaveClass('opacity-0')
  })
})
