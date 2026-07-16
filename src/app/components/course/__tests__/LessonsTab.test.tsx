import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import Dexie from 'dexie'
import { LessonsTab } from '@/app/components/course/tabs/LessonsTab'
import { formatLessonDuration } from '@/app/components/course/tabs/LessonsTabHighlightedTitle'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import type { CourseAdapter } from '@/lib/courseAdapter'
import type { CourseSection, LessonGroupItem } from '@/lib/lessonBasedCurriculum'

beforeAll(() => {
  if (!HTMLAnchorElement.prototype.scrollIntoView) {
    HTMLAnchorElement.prototype.scrollIntoView = vi.fn()
  }
})

function makeItem(overrides: Partial<LessonGroupItem> = {}): LessonGroupItem {
  return {
    id: 'lesson-1',
    title: 'Test Lesson',
    displayTitle: 'Test Lesson',
    type: 'video',
    duration: 300,
    filename: '001 Test Lesson.mp4',
    path: 'Section 1/001 Test Lesson.mp4',
    isPrimary: true,
    ...overrides,
  }
}

function makeSection(
  title: string,
  lessons: Array<{ primary: LessonGroupItem; materials?: LessonGroupItem[] }>
): CourseSection {
  return {
    numericPrefix: '1',
    title,
    lessons: lessons.map(({ primary, materials = [] }, index) => ({
      numericPrefix: String(index + 1),
      primary,
      materials,
    })),
  }
}

function makeAdapter(sections: CourseSection[], pending = false): CourseAdapter {
  return {
    getLessonBasedCurriculum: vi
      .fn()
      .mockReturnValue(pending ? new Promise(() => undefined) : Promise.resolve(sections)),
  } as unknown as CourseAdapter
}

function renderTab(
  sections: CourseSection[],
  lessonId = 'lesson-1',
  initialEntry = '/courses/course-1/lessons/lesson-1?tool=transcript'
) {
  const onLessonSelect = vi.fn()
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LessonsTab
        courseId="course-1"
        lessonId={lessonId}
        adapter={makeAdapter(sections)}
        onLessonSelect={onLessonSelect}
      />
    </MemoryRouter>
  )
  return { onLessonSelect }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  useContentProgressStore.setState({ statusMap: {}, isLoading: false, error: null })
})

describe('LessonsTab', () => {
  it('renders primary lessons with current status and preserved tool query', async () => {
    const lesson = makeItem({ id: 'lesson-1', displayTitle: 'Linux Fundamentals' })
    renderTab([makeSection('Foundations', [{ primary: lesson }])])

    const link = await screen.findByRole('link', { name: /Linux Fundamentals/i })
    expect(link).toHaveAttribute('href', '/courses/course-1/lessons/lesson-1?tool=transcript')
    expect(screen.getByRole('img', { name: 'Now playing' })).toBeInTheDocument()
    expect(screen.getByText('Now Playing')).toBeInTheDocument()
  })

  it('shows stable skeleton rows while curriculum loads', () => {
    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="lesson-1" adapter={makeAdapter([], true)} />
      </MemoryRouter>
    )

    expect(document.querySelectorAll('.animate-shimmer')).toHaveLength(6)
  })

  it('communicates completed and in-progress states with accessible text', async () => {
    useContentProgressStore.setState({
      statusMap: {
        'course-1:lesson-1': 'completed',
        'course-1:lesson-2': 'in-progress',
      },
    })
    const sections = [
      makeSection('Foundations', [
        { primary: makeItem({ id: 'lesson-1', displayTitle: 'Completed Lesson' }) },
        { primary: makeItem({ id: 'lesson-2', displayTitle: 'Current Lesson' }) },
      ]),
    ]
    renderTab(sections, 'missing')

    expect(await screen.findByRole('img', { name: 'Completed' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'In progress' })).toBeInTheDocument()
  })

  it('filters by primary lesson and material titles', async () => {
    const sections = [
      makeSection('Foundations', [
        { primary: makeItem({ id: 'lesson-1', displayTitle: 'Shell Basics' }) },
        { primary: makeItem({ id: 'lesson-2', displayTitle: 'Permissions' }) },
      ]),
    ]
    renderTab(sections)
    const search = await screen.findByRole('searchbox', { name: 'Filter lessons by title' })

    fireEvent.change(search, { target: { value: 'permissions' } })
    expect(screen.queryByText('Shell Basics')).not.toBeInTheDocument()
    expect(screen.getByText('Permissions')).toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 2 lessons')).toBeInTheDocument()
  })

  it('renders and collapses companion materials with 44px toggle targets', async () => {
    const primary = makeItem({ id: 'lesson-1', displayTitle: 'Directory Structure' })
    const material = makeItem({
      id: 'material-1',
      displayTitle: 'Directory Cheat Sheet',
      type: 'pdf',
      filename: '001 cheat-sheet.pdf',
      isPrimary: false,
    })
    renderTab([makeSection('Foundations', [{ primary, materials: [material] }])], 'material-1')

    expect(await screen.findByText('Directory Cheat Sheet')).toBeInTheDocument()
    const toggle = screen.getByTestId('materials-collapse-lesson-1')
    expect(toggle.className).toContain('min-h-11')
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.queryByText('Directory Cheat Sheet')).not.toBeInTheDocument())
  })

  it('expands only the active section by default', async () => {
    const sections = [
      makeSection('Overview', [{ primary: makeItem({ id: 'lesson-1', displayTitle: 'Welcome' }) }]),
      makeSection('Advanced', [
        { primary: makeItem({ id: 'lesson-2', displayTitle: 'Networking' }) },
      ]),
    ]
    renderTab(sections, 'lesson-2')

    expect(await screen.findByText('Networking')).toBeInTheDocument()
    expect(screen.queryByText('Welcome')).not.toBeInTheDocument()
  })

  it('closes an overlay through onLessonSelect after choosing a lesson', async () => {
    const sections = [
      makeSection('Foundations', [
        { primary: makeItem({ id: 'lesson-1', displayTitle: 'Choose Me' }) },
      ]),
    ]
    const { onLessonSelect } = renderTab(sections)
    fireEvent.click(await screen.findByRole('link', { name: /Choose Me/i }))
    expect(onLessonSelect).toHaveBeenCalledOnce()
  })

  it('virtualizes when more than 100 rows are visible', async () => {
    const lessons = Array.from({ length: 500 }, (_, index) => ({
      primary: makeItem({
        id: `lesson-${index + 1}`,
        displayTitle: `Lesson ${index + 1}`,
      }),
    }))
    renderTab([makeSection('Large Course', lessons)], 'lesson-250')

    expect(await screen.findByTestId('virtualized-lesson-list')).toBeInTheDocument()
  })
})

describe('formatLessonDuration', () => {
  it('formats minutes and hours with tabular-friendly padding', () => {
    expect(formatLessonDuration(65)).toBe('1:05')
    expect(formatLessonDuration(3661)).toBe('1:01:01')
  })
})
