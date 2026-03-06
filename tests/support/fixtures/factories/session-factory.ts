import type { StudySession } from '../../../../src/data/types'

export function createStudySession(overrides: Partial<StudySession> = {}): StudySession {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    contentItemId: 'lesson-1',
    startTime: now,
    endTime: undefined,
    duration: 0,
    idleTime: 0,
    videosWatched: [],
    lastActivity: now,
    sessionType: 'video',
    ...overrides,
  }
}
