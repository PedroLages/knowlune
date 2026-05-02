import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import Dexie from 'dexie'
import { LessonsTab, formatLessonDuration, LESSON_SEARCH_THRESHOLD } from '@/app/components/course/tabs/LessonsTab'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import type { CourseAdapter, LessonItem, MaterialGroup } from '@/lib/courseAdapter'

function makeLesson(overrides: Partial<LessonItem> = {}): LessonItem {
  return {
    id: 'lesson-1',
    title: 'Test Lesson',
    order: 1,
    type: 'video',
    duration: 300,
    thumbnailUrl: '',
    resources: [],
    ...overrides,
  } as LessonItem
}

function makeGroup(lesson: LessonItem, materials: LessonItem[] = []): MaterialGroup {
  return { primary: lesson, materials }
}

function makeAdapter(groups: MaterialGroup[]): CourseAdapter {
  return {
    getGroupedLessons: vi.fn().mockResolvedValue(groups),
    getCapabilities: vi.fn().mockReturnValue({
      hasVideo: true,
      hasPdf: false,
      hasTranscript: false,
      supportsNotes: true,
      supportsQuiz: false,
      supportsPrevNext: true,
      supportsBreadcrumbs: true,
      requiresNetwork: false,
      supportsRefresh: false,
      supportsFileVerification: false,
    }),
  } as unknown as CourseAdapter
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
})

describe('LessonsTab', () => {
  it('renders lesson rows', async () => {
    const lesson = makeLesson({ id: 'les-1', title: 'Hello World' })
    const adapter = makeAdapter([makeGroup(lesson)])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="les-1" adapter={adapter} />
      </MemoryRouter>
    )

    expect(await screen.findByText('Hello World')).toBeDefined()
  })

  it('renders index numbers for not-started lessons', async () => {
    const lesson = makeLesson({ id: 'les-1' })
    const adapter = makeAdapter([makeGroup(lesson)])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="les-2" adapter={adapter} />
      </MemoryRouter>
    )

    expect(await screen.findByText('1')).toBeDefined()
  })

  it('renders loading skeletons while adapter resolves', () => {
    const adapter = {
      getGroupedLessons: vi.fn().mockReturnValue(new Promise(() => {})),
    } as unknown as CourseAdapter

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="les-1" adapter={adapter} />
      </MemoryRouter>
    )

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

describe('LessonLink completion checkmark', () => {
  it('shows CheckCircle2 when lesson is completed', async () => {
    useContentProgressStore.setState({
      statusMap: { 'course-1:les-1': 'completed' },
    })

    const lesson = makeLesson({ id: 'les-1', title: 'Completed Lesson' })
    const adapter = makeAdapter([makeGroup(lesson)])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="les-2" adapter={adapter} />
      </MemoryRouter>
    )

    const checkmark = await screen.findByTestId('completion-check-les-1')
    expect(checkmark).toBeDefined()

    const title = screen.getByText('Completed Lesson')
    expect(title.className).toContain('line-through')
  })

  it('shows index number when lesson is in-progress', async () => {
    useContentProgressStore.setState({
      statusMap: { 'course-1:les-1': 'in-progress' },
    })

    const lesson = makeLesson({ id: 'les-1', title: 'In Progress Lesson' })
    const adapter = makeAdapter([makeGroup(lesson)])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="les-2" adapter={adapter} />
      </MemoryRouter>
    )

    expect(await screen.findByText('1')).toBeDefined()
    expect(screen.queryByTestId('completion-check-les-1')).toBeNull()
  })

  it('shows index number when lesson is not-started', async () => {
    useContentProgressStore.setState({
      statusMap: { 'course-1:les-1': 'not-started' },
    })

    const lesson = makeLesson({ id: 'les-1', title: 'Not Started Lesson' })
    const adapter = makeAdapter([makeGroup(lesson)])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="les-2" adapter={adapter} />
      </MemoryRouter>
    )

    expect(await screen.findByText('1')).toBeDefined()
    expect(screen.queryByTestId('completion-check-les-1')).toBeNull()
  })
})

describe('formatLessonDuration', () => {
  it('formats seconds as M:SS', () => {
    expect(formatLessonDuration(65)).toBe('1:05')
  })

  it('formats hours', () => {
    expect(formatLessonDuration(3661)).toBe('1:01:01')
  })
})

describe('LESSON_SEARCH_THRESHOLD', () => {
  it('is a positive number', () => {
    expect(LESSON_SEARCH_THRESHOLD).toBeGreaterThan(0)
  })
})
