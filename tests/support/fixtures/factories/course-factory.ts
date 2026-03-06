/**
 * Data factories for LevelUp course content.
 *
 * Creates Course, Module, Lesson, and Resource objects with sensible
 * defaults and override support. Uses crypto.randomUUID() for unique
 * IDs (no faker dependency needed for this client-side app).
 *
 * Pattern: factory function with Partial<T> overrides
 * Reference: TEA knowledge base - data-factories.md
 */
import type {
  Course,
  CourseCategory,
  Difficulty,
  Module,
  Lesson,
  Resource,
  ResourceType,
  Note,
} from '../../../../src/data/types'

let counter = 0
function uid(): string {
  counter++
  return `test-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`
}

// --- Resource Factory ---

export function createResource(overrides: Partial<Resource> = {}): Resource {
  const id = overrides.id ?? uid()
  return {
    id,
    title: `Resource ${id.slice(-4)}`,
    type: 'video' as ResourceType,
    filePath: `/courses/test/video-${id}.mp4`,
    fileName: `video-${id}.mp4`,
    ...overrides,
  }
}

// --- Lesson Factory ---

export function createLesson(overrides: Partial<Lesson> = {}): Lesson {
  const id = overrides.id ?? uid()
  return {
    id,
    title: `Lesson ${id.slice(-4)}`,
    description: 'A test lesson for E2E testing.',
    order: 1,
    resources: overrides.resources ?? [createResource()],
    keyTopics: overrides.keyTopics ?? ['testing', 'e2e'],
    duration: '15:00',
    ...overrides,
  }
}

// --- Module Factory ---

export function createModule(overrides: Partial<Module> = {}): Module {
  const id = overrides.id ?? uid()
  return {
    id,
    title: `Module ${id.slice(-4)}`,
    description: 'A test module for E2E testing.',
    order: 1,
    lessons: overrides.lessons ?? [createLesson(), createLesson({ order: 2 })],
    ...overrides,
  }
}

// --- Course Factory ---

const CATEGORIES: CourseCategory[] = [
  'behavioral-analysis',
  'influence-authority',
  'confidence-mastery',
  'operative-training',
  'research-library',
]

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']

export function createCourse(overrides: Partial<Course> = {}): Course {
  const id = overrides.id ?? uid()
  const modules = overrides.modules ?? [createModule()]
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0)

  return {
    id,
    title: `Test Course ${id.slice(-4)}`,
    shortTitle: `TC-${id.slice(-4)}`,
    description: 'A comprehensive test course for E2E testing.',
    category: CATEGORIES[0],
    difficulty: DIFFICULTIES[0],
    totalLessons,
    totalVideos: totalLessons,
    totalPDFs: 0,
    estimatedHours: 2,
    tags: ['test', 'e2e'],
    modules,
    isSequential: false,
    basePath: `/courses/${id}`,
    ...overrides,
  }
}

// --- Note Factory ---

export function createNote(overrides: Partial<Note> = {}): Note {
  const id = overrides.id ?? uid()
  const now = new Date().toISOString()
  return {
    id,
    content: 'A test note for E2E testing.',
    createdAt: now,
    updatedAt: now,
    tags: [],
    ...overrides,
  }
}

// --- CourseProgress Factory ---

export interface CourseProgress {
  courseId: string
  completedLessons: string[]
  lastWatchedLesson?: string
  lastVideoPosition?: number
  notes: Record<string, Note[]>
  startedAt: string
  lastAccessedAt: string
}

export function createCourseProgress(overrides: Partial<CourseProgress> = {}): CourseProgress {
  const now = new Date().toISOString()
  return {
    courseId: overrides.courseId ?? uid(),
    completedLessons: [],
    notes: {},
    startedAt: now,
    lastAccessedAt: now,
    ...overrides,
  }
}

// --- StudyAction Factory ---

export type StudyActionType = 'lesson_complete' | 'video_progress' | 'note_saved' | 'course_started'

export interface StudyAction {
  type: StudyActionType
  courseId: string
  lessonId?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export function createStudyAction(overrides: Partial<StudyAction> = {}): StudyAction {
  return {
    type: 'lesson_complete',
    courseId: uid(),
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

// --- VideoBookmark Factory ---

export interface VideoBookmark {
  id: string
  courseId: string
  lessonId: string
  timestamp: number
  label: string
  createdAt: string
}

export function createVideoBookmark(overrides: Partial<VideoBookmark> = {}): VideoBookmark {
  const id = overrides.id ?? uid()
  return {
    id,
    courseId: uid(),
    lessonId: uid(),
    timestamp: 120,
    label: 'Important section',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}
