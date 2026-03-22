import type { StudySession } from '../../../../src/data/types'
import { FIXED_DATE } from './../../../utils/test-time'

export function createStudySession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    contentItemId: 'lesson-1',
    startTime: FIXED_DATE,
    endTime: undefined,
    duration: 0,
    idleTime: 0,
    videosWatched: [],
    lastActivity: FIXED_DATE,
    sessionType: 'video',
    ...overrides,
  }
}
