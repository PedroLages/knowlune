import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { CourseSyllabusPanel } from '@/app/components/course/CourseSyllabusPanel'
import type { CourseAdapter } from '@/lib/courseAdapter'

const media = vi.hoisted(() => ({ wide: true, mobile: false }))

vi.mock('@/app/hooks/useMediaQuery', () => ({
  useMediaQuery: (query: string) =>
    query.includes('min-width: 1440px') ? media.wide : media.mobile,
}))

vi.mock('@/app/components/course/tabs/LessonsTab', () => ({
  LessonsTab: ({ onLessonSelect }: { onLessonSelect?: () => void }) => (
    <button type="button" onClick={onLessonSelect}>
      Select Lesson
    </button>
  ),
}))

const adapter = {} as CourseAdapter

function renderPanel(overrides: Partial<ComponentProps<typeof CourseSyllabusPanel>> = {}) {
  const onInlineClose = vi.fn()
  const onOverlayOpenChange = vi.fn()
  render(
    <CourseSyllabusPanel
      courseId="course-1"
      lessonId="lesson-2"
      courseName="Linux Administration"
      adapter={adapter}
      currentPosition={2}
      totalLessons={10}
      progressPercent={20}
      inlineOpen
      overlayOpen={false}
      onInlineClose={onInlineClose}
      onOverlayOpenChange={onOverlayOpenChange}
      {...overrides}
    />
  )
  return { onInlineClose, onOverlayOpenChange }
}

describe('CourseSyllabusPanel', () => {
  it('renders a labelled inline syllabus with progress on wide screens', () => {
    media.wide = true
    media.mobile = false
    const { onInlineClose } = renderPanel()

    expect(screen.getByRole('complementary', { name: 'Course content' })).toHaveClass(
      'h-[calc(100dvh-7rem)]'
    )
    expect(screen.getByText('Linux Administration')).toBeVisible()
    expect(screen.getByText('Lesson 2 of 10')).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Course progress' })).toHaveAttribute(
      'aria-valuenow',
      '20'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hide course content' }))
    expect(onInlineClose).toHaveBeenCalledOnce()
  })

  it('uses an overlay below the wide breakpoint and closes after lesson selection', () => {
    media.wide = false
    media.mobile = false
    const { onOverlayOpenChange } = renderPanel({ overlayOpen: true })

    fireEvent.click(screen.getByRole('button', { name: 'Select Lesson' }))
    expect(onOverlayOpenChange).toHaveBeenCalledWith(false)
  })
})
