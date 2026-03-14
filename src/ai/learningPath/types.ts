/**
 * Type declarations for learning path generation
 */

import type { LearningPathCourse } from '@/data/types'

/**
 * Window interface extension for test mocking
 * Allows E2E tests to inject deterministic responses
 */
declare global {
  interface Window {
    __mockLearningPathResponse?: {
      learningPath: LearningPathCourse[]
    }
  }
}

export {}
