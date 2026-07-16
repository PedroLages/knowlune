import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { LessonNavigation } from '@/app/components/course/LessonNavigation'
import type { LessonItem } from '@/lib/courseAdapter'

const previous: LessonItem = {
  id: 'lesson-1',
  title: 'Linux Fundamentals',
  type: 'video',
  order: 1,
}
const next: LessonItem = { id: 'lesson-3', title: 'The Shell', type: 'video', order: 3 }

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

function renderNavigation(
  props: Partial<ComponentProps<typeof LessonNavigation>> = {},
  initialEntry = '/courses/course-1/lessons/lesson-2?tool=transcript'
) {
  const onNavigate = vi.fn()
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <LessonNavigation
                courseId="course-1"
                prevLesson={previous}
                nextLesson={next}
                currentIndex={1}
                totalLessons={3}
                onNavigate={onNavigate}
                {...props}
              />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
  return { onNavigate }
}

describe('LessonNavigation', () => {
  it('renders destination titles as real links and preserves the active tool', () => {
    renderNavigation()

    expect(screen.getByRole('link', { name: 'Previous: Linux Fundamentals' })).toHaveAttribute(
      'href',
      '/courses/course-1/lessons/lesson-1?tool=transcript'
    )
    expect(screen.getByRole('link', { name: 'Next: The Shell' })).toHaveAttribute(
      'href',
      '/courses/course-1/lessons/lesson-3?tool=transcript'
    )
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('uses Back to Lesson for a companion material', () => {
    renderNavigation({ parentLesson: previous, prevLesson: null })
    expect(screen.getByRole('link', { name: 'Back to Lesson: Linux Fundamentals' })).toBeVisible()
  })

  it('disables End of Course until the final lesson is complete', () => {
    renderNavigation({ nextLesson: null, currentIndex: 2 })
    expect(screen.getByRole('button', { name: /End of Course/i })).toBeDisabled()
  })

  it('offers Course Overview after completing the final lesson', () => {
    renderNavigation({ nextLesson: null, currentIndex: 2, isCurrentCompleted: true })
    expect(screen.getByRole('link', { name: 'Course Overview' })).toHaveAttribute(
      'href',
      '/courses/course-1'
    )
  })

  it('supports bracket shortcuts and ignores shortcuts inside inputs', () => {
    const { onNavigate } = renderNavigation()
    const input = document.createElement('input')
    document.body.append(input)

    fireEvent.keyDown(input, { key: ']' })
    expect(screen.getByTestId('location')).toHaveTextContent('/lessons/lesson-2')

    fireEvent.keyDown(document, { key: ']' })
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/courses/course-1/lessons/lesson-3?tool=transcript'
    )
    expect(onNavigate).toHaveBeenCalledOnce()
    input.remove()
  })
})
