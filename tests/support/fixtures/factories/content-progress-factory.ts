import type { ContentProgress, CompletionStatus } from '../../../../src/data/types'
import { FIXED_DATE } from '../../../utils/test-time'

export function createContentProgress(overrides: Partial<ContentProgress> = {}): ContentProgress {
  return {
    courseId: 'course-1',
    itemId: 'lesson-1',
    status: 'not-started' as CompletionStatus,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}
