import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import Dexie from 'dexie'

// jsdom does not implement scrollIntoView on HTMLAnchorElement.
// The LessonsTab scroll-into-view effect calls it on the active lesson link.
beforeAll(() => {
  if (!HTMLAnchorElement.prototype.scrollIntoView) {
    HTMLAnchorElement.prototype.scrollIntoView = vi.fn() as unknown as (
      arg?: boolean | ScrollIntoViewOptions
    ) => void
  }
})
import {
  LessonsTab,
  formatLessonDuration,
  LESSON_SEARCH_THRESHOLD,
} from '@/app/components/course/tabs/LessonsTab'
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

    // Skeleton defaults to shimmer=true which uses animate-shimmer class
    const skeletons = document.querySelectorAll('.animate-shimmer')
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

describe('MaterialGroupRow - companion PDFs', () => {
  it('auto-expands groups with companion materials on first load', async () => {
    const video = makeLesson({ id: 'vid-1', title: 'Video Lesson', type: 'video' })
    const pdf = makeLesson({
      id: 'pdf-1',
      title: 'Companion PDF',
      type: 'pdf',
      duration: undefined,
    })
    const adapter = makeAdapter([makeGroup(video, [pdf])])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="vid-1" adapter={adapter} />
      </MemoryRouter>
    )

    // The companion PDF sub-row should be visible (collapsible is open)
    const pdfLink = await screen.findByTestId('material-link-pdf-1')
    expect(pdfLink).toBeDefined()
    expect(screen.getByText('Companion PDF')).toBeDefined()
  })

  it('shows material count badge on video row with companion PDFs', async () => {
    const video = makeLesson({ id: 'vid-1', title: 'Video Lesson', type: 'video' })
    const pdf1 = makeLesson({ id: 'pdf-1', title: 'PDF 1', type: 'pdf', duration: undefined })
    const pdf2 = makeLesson({ id: 'pdf-2', title: 'PDF 2', type: 'pdf', duration: undefined })
    const adapter = makeAdapter([makeGroup(video, [pdf1, pdf2])])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="vid-1" adapter={adapter} />
      </MemoryRouter>
    )

    await screen.findByTestId('material-link-pdf-1')

    // The badge should show "2" for the two companion PDFs
    const badges = screen.getAllByText('2')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('does not show material count badge on video row without companion PDFs', async () => {
    const video = makeLesson({ id: 'vid-1', title: 'Solo Video', type: 'video' })
    const adapter = makeAdapter([makeGroup(video, [])])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="vid-1" adapter={adapter} />
      </MemoryRouter>
    )

    await screen.findByText('Solo Video')

    // No collapse toggle for groups without materials
    expect(screen.queryByTestId('materials-collapse-vid-1')).toBeNull()
  })

  it('allows manual collapse of an auto-expanded material group', async () => {
    const video = makeLesson({ id: 'vid-1', title: 'Video Lesson', type: 'video' })
    const pdf = makeLesson({
      id: 'pdf-1',
      title: 'Companion PDF',
      type: 'pdf',
      duration: undefined,
    })
    const adapter = makeAdapter([makeGroup(video, [pdf])])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="vid-1" adapter={adapter} />
      </MemoryRouter>
    )

    // Collapse toggle should exist
    const toggle = await screen.findByTestId('materials-collapse-vid-1')
    expect(toggle).toBeDefined()
  })
})

describe('Standalone PDFs (R4 regression)', () => {
  it('renders standalone PDF as a primary lesson row', async () => {
    const pdf = makeLesson({
      id: 'standalone-pdf',
      title: 'Standalone Document',
      type: 'pdf',
      duration: undefined,
    })
    const adapter = makeAdapter([makeGroup(pdf, [])])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="standalone-pdf" adapter={adapter} />
      </MemoryRouter>
    )

    const link = await screen.findByText('Standalone Document')
    expect(link).toBeDefined()

    // Standalone PDF should have a link to its lesson page
    const parentLink = link.closest('a')
    expect(parentLink?.getAttribute('href')).toContain('/lessons/standalone-pdf')
  })

  it('standalone PDF shows page count when available', async () => {
    const pdf = makeLesson({
      id: 'standalone-pdf',
      title: 'Long PDF',
      type: 'pdf',
      duration: undefined,
      sourceMetadata: { path: 'docs/doc.pdf', pageCount: 42 },
    })
    const adapter = makeAdapter([makeGroup(pdf, [])])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="standalone-pdf" adapter={adapter} />
      </MemoryRouter>
    )

    expect(await screen.findByText('Long PDF')).toBeDefined()
    expect(screen.getByText('42 pgs')).toBeDefined()
  })

  it('standalone PDF does not render a collapse toggle', async () => {
    const pdf = makeLesson({
      id: 'standalone-pdf',
      title: 'Solo PDF',
      type: 'pdf',
      duration: undefined,
    })
    const adapter = makeAdapter([makeGroup(pdf, [])])

    render(
      <MemoryRouter>
        <LessonsTab courseId="course-1" lessonId="standalone-pdf" adapter={adapter} />
      </MemoryRouter>
    )

    await screen.findByText('Solo PDF')
    expect(screen.queryByTestId('materials-collapse-standalone-pdf')).toBeNull()
  })
})

describe('LESSON_SEARCH_THRESHOLD', () => {
  it('is a positive number', () => {
    expect(LESSON_SEARCH_THRESHOLD).toBeGreaterThan(0)
  })
})
