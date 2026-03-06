import type { ContentProgress, CompletionStatus } from '../../../../src/data/types'

export function createContentProgress(overrides: Partial<ContentProgress> = {}): ContentProgress {
  return {
    courseId: 'course-1',
    itemId: 'lesson-1',
    status: 'not-started' as CompletionStatus,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
