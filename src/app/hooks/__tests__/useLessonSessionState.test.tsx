import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { useLessonSessionState } from '@/app/hooks/useLessonSessionState'

function Harness({ isPdf = false }: { isPdf?: boolean }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const location = useLocation()
  const { activeTool, setActiveTool } = useLessonSessionState({
    courseId: 'course-1',
    lessonId: 'lesson-1',
    isPdf,
    titleRef,
  })

  return (
    <>
      <div id="main-content" />
      <h1 ref={titleRef}>Lesson</h1>
      <output data-testid="tool">{activeTool}</output>
      <output data-testid="search">{location.search}</output>
      <button type="button" onClick={() => setActiveTool('transcript')}>
        Open Transcript
      </button>
    </>
  )
}

beforeEach(() => {
  sessionStorage.clear()
  HTMLElement.prototype.scrollTo = vi.fn()
})

describe('useLessonSessionState', () => {
  it('uses the tool query as source of truth and updates it without adding history', () => {
    render(
      <MemoryRouter initialEntries={['/courses/course-1/lessons/lesson-1?tool=bookmarks']}>
        <Harness />
      </MemoryRouter>
    )

    expect(screen.getByTestId('tool')).toHaveTextContent('bookmarks')
    fireEvent.click(screen.getByRole('button', { name: 'Open Transcript' }))
    expect(screen.getByTestId('tool')).toHaveTextContent('transcript')
    expect(screen.getByTestId('search')).toHaveTextContent('?tool=transcript')
    expect(sessionStorage.getItem('knowlune:lesson-session:v1:course-1:lesson-1')).toContain(
      'transcript'
    )
  })

  it('falls back to Materials for a PDF when the query is invalid', () => {
    render(
      <MemoryRouter initialEntries={['/courses/course-1/lessons/lesson-1?tool=invalid']}>
        <Harness isPdf />
      </MemoryRouter>
    )

    expect(screen.getByTestId('tool')).toHaveTextContent('materials')
  })
})
