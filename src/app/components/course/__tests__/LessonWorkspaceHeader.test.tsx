import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LessonWorkspaceHeader } from '@/app/components/course/LessonWorkspaceHeader'

vi.mock('@/app/components/course/LessonHeaderTools', () => ({
  LessonHeaderTools: () => <div>Lesson tools</div>,
}))

describe('LessonWorkspaceHeader', () => {
  it('keeps the lesson title prominent without repeating sidebar metadata', () => {
    render(
      <MemoryRouter>
        <LessonWorkspaceHeader
          courseId="course-1"
          courseName="Linux Administration"
          sectionTitle="Linux Fundamentals"
          lessonTitle="The Linux Directory Structure"
          currentPosition={12}
          totalLessons={74}
          titleRef={createRef<HTMLHeadingElement>()}
          syllabusVisible
          onToggleSyllabus={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Linux Directory Structure' })
    ).toBeVisible()
    expect(screen.queryByText('Lesson 12 of 74 · Linux Fundamentals')).not.toBeInTheDocument()
  })
})
