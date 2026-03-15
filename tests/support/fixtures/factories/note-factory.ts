import type { Note } from '../../../../src/data/types'
import { FIXED_DATE } from '../../../utils/test-time'

/**
 * Creates a Dexie-compatible Note with courseId and videoId.
 * Distinct from the legacy `createNote` in course-factory.ts which
 * omits these fields.
 */
export function createDexieNote(overrides: Partial<Note> = {}): Note {
  const now = FIXED_DATE
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    videoId: 'lesson-1',
    content: 'Test note content',
    createdAt: now,
    updatedAt: now,
    tags: [],
    ...overrides,
  }
}
