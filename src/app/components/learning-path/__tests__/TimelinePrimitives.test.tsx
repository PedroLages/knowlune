import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LessonRow } from '@/app/components/learning-path/TimelinePrimitives'
import type { ImportedVideo } from '@/data/types'

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  return {
    id: 'v1',
    courseId: 'c1',
    filename: 'Lesson.mp4',
    path: '',
    duration: 125,
    format: 'mp4',
    order: 0,
    fileHandle: null,
    ...overrides,
  }
}

describe('LessonRow', () => {
  it('renders clock-formatted duration in seconds when duration > 0', () => {
    render(
      <MemoryRouter>
        <LessonRow video={makeVideo({ duration: 125 })} courseId="c1" isCompleted={false} />
      </MemoryRouter>
    )
    expect(screen.getByText('2:05')).toBeInTheDocument()
  })

  it('does not render a duration badge when duration is 0', () => {
    render(
      <MemoryRouter>
        <LessonRow video={makeVideo({ duration: 0 })} courseId="c1" isCompleted={false} />
      </MemoryRouter>
    )
    expect(screen.queryByText(/^[0-9]+:[0-9]{2}$/)).not.toBeInTheDocument()
  })

  it('renders hour-padded clock string for durations >= 1 hour', () => {
    render(
      <MemoryRouter>
        <LessonRow video={makeVideo({ duration: 3665 })} courseId="c1" isCompleted={false} />
      </MemoryRouter>
    )
    expect(screen.getByText('1:01:05')).toBeInTheDocument()
  })
})
