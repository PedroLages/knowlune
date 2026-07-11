/**
 * Tests for the canonical resume resolver.
 *
 * @see src/lib/learningResumeResolver.ts
 */

import { describe, it, expect } from 'vitest'
import {
  resolveCourseResumeTargetSync,
  resolveTrackResumeTargetSync,
  type CourseResumeTarget,
  type SyncCourseResolveParams,
} from '@/lib/learningResumeResolver'
import type {
  ImportedVideo,
  ImportedPdf,
  VideoProgress,
  CompletionStatus,
} from '@/data/types'

// ── Helpers ──────────────────────────────────────────────────────────────

function makeVideo(
  id: string,
  order = 0,
  filename?: string,
  title?: string,
): ImportedVideo {
  return {
    id,
    courseId: 'course-1',
    filename: filename ?? `${id}.mp4`,
    path: `videos/${filename ?? id}.mp4`,
    duration: 120,
    format: 'mp4',
    order,
    title,
    fileHandle: null,
  } as ImportedVideo
}

function makePdf(id: string, filename?: string): ImportedPdf {
  return {
    id,
    courseId: 'course-1',
    filename: filename ?? `${id}.pdf`,
    path: `pdfs/${filename ?? id}.pdf`,
    pageCount: 10,
    fileHandle: null,
  } as ImportedPdf
}

function makeProgress(
  videoId: string,
  overrides: Partial<VideoProgress> = {},
): VideoProgress {
  return {
    courseId: 'course-1',
    videoId,
    currentTime: 0,
    completionPercentage: 0,
    ...overrides,
  }
}

const EMPTY_PARAMS: SyncCourseResolveParams = {
  videos: [],
  pdfs: [],
  videoProgressList: [],
  statusMap: {},
}

// ── Course Resolver ──────────────────────────────────────────────────────

describe('resolveCourseResumeTargetSync', () => {
  it('returns start for the first unstarted video', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      ...EMPTY_PARAMS,
      videos: [makeVideo('v1', 1), makeVideo('v2', 2)],
    })

    expect(target.action).toBe('start')
    expect(target.lessonId).toBe('v1')
    expect(target.resumePositionSeconds).toBe(0)
  })

  it('skips completed videos (contentProgress) and returns next incomplete', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1), makeVideo('v2', 2), makeVideo('v3', 3)],
      pdfs: [],
      videoProgressList: [],
      statusMap: {
        'course-1:v1': 'completed',
      },
    })

    expect(target.action).toBe('start')
    expect(target.lessonId).toBe('v2')
  })

  it('returns resume for partially watched video (in-progress status)', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1)],
      pdfs: [],
      videoProgressList: [makeProgress('v1', { currentTime: 82 })],
      statusMap: {
        'course-1:v1': 'in-progress',
      },
    })

    expect(target.action).toBe('resume')
    expect(target.lessonId).toBe('v1')
    expect(target.resumePositionSeconds).toBe(82)
  })

  it('returns resume for partially watched video (VideoProgress currentTime only, no contentProgress)', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1)],
      pdfs: [],
      videoProgressList: [makeProgress('v1', { currentTime: 35, completionPercentage: 35 })],
      statusMap: {},
    })

    expect(target.action).toBe('resume')
    expect(target.lessonId).toBe('v1')
    expect(target.resumePositionSeconds).toBe(35)
  })

  it('skips videos with legacy progress >= 90%', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1), makeVideo('v2', 2)],
      pdfs: [],
      videoProgressList: [makeProgress('v1', { completionPercentage: 95 })],
      statusMap: {},
    })

    expect(target.lessonId).toBe('v2')
  })

  it('skips videos with completedAt set', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1), makeVideo('v2', 2)],
      pdfs: [],
      videoProgressList: [
        makeProgress('v1', { completedAt: '2024-01-01T00:00:00Z', completionPercentage: 80 }),
      ],
      statusMap: {},
    })

    expect(target.lessonId).toBe('v2')
  })

  it('returns complete when all videos are completed', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1), makeVideo('v2', 2)],
      pdfs: [],
      videoProgressList: [],
      statusMap: {
        'course-1:v1': 'completed',
        'course-1:v2': 'completed',
      },
    })

    expect(target.action).toBe('complete')
    expect(target.lessonId).toBeNull()
    expect(target.resumePositionSeconds).toBe(0)
  })

  it('returns complete for a course with no lessons', () => {
    const target = resolveCourseResumeTargetSync('course-1', EMPTY_PARAMS)

    expect(target.action).toBe('complete')
    expect(target.lessonId).toBeNull()
  })

  it('contentProgress completed overrides missing legacy progress', () => {
    // Video has NO legacy progress record, but contentProgress says completed
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1), makeVideo('v2', 2)],
      pdfs: [],
      videoProgressList: [], // no legacy records at all
      statusMap: {
        'course-1:v1': 'completed',
      },
    })

    // v1 is skipped due to contentProgress, v2 is first incomplete
    expect(target.lessonId).toBe('v2')
    expect(target.action).toBe('start')
  })

  it('handles mixed progress sources correctly', () => {
    // v1: contentProgress = completed
    // v2: no contentProgress, legacy progress = 45% → incomplete, should resume
    // v3: contentProgress = not-started, no legacy → start
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1), makeVideo('v2', 2), makeVideo('v3', 3)],
      pdfs: [],
      videoProgressList: [makeProgress('v2', { currentTime: 45, completionPercentage: 45 })],
      statusMap: {
        'course-1:v1': 'completed',
        'course-1:v3': 'not-started' as CompletionStatus,
      },
    })

    // v1 completed → skip, v2 partial → resume
    expect(target.lessonId).toBe('v2')
    expect(target.action).toBe('resume')
    expect(target.resumePositionSeconds).toBe(45)
  })

  it('respects curriculum sort order (sortedVideos by order, then filename)', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [
        makeVideo('v3', 3),
        makeVideo('v1', 1), // lowest order → should be first
        makeVideo('v2', 2),
      ],
      pdfs: [],
      videoProgressList: [],
      statusMap: {},
    })

    // v1 has the lowest order
    expect(target.lessonId).toBe('v1')
  })

  it('falls back to PDFs when no videos exist', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      ...EMPTY_PARAMS,
      pdfs: [makePdf('pdf-1', 'a-guide.pdf'), makePdf('pdf-2', 'b-guide.pdf')],
    })

    expect(target.lessonId).toBe('pdf-1')
    expect(target.action).toBe('start')
  })

  it('skips completed PDFs via contentProgress', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      ...EMPTY_PARAMS,
      pdfs: [makePdf('pdf-1'), makePdf('pdf-2')],
      statusMap: {
        'course-1:pdf-1': 'completed',
      },
    })

    expect(target.lessonId).toBe('pdf-2')
  })

  it('does not treat module/folder IDs in statusMap as lessons', () => {
    // Module-level entries in statusMap like 'course-1:module-folder-1'
    // should be ignored because they aren't real video/PDF lesson IDs
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('real-video-1', 1)],
      pdfs: [],
      videoProgressList: [],
      statusMap: {
        'course-1:module-folder-1': 'completed' as CompletionStatus,
        // 'real-video-1' has no entry → should be treated as not completed
      },
    })

    // The module entry is ignored because it doesn't match any video/PDF ID
    expect(target.lessonId).toBe('real-video-1')
    expect(target.action).toBe('start')
  })

  it('uses video.title over filename when available', () => {
    const target = resolveCourseResumeTargetSync('course-1', {
      videos: [makeVideo('v1', 1, '01_introduction.mp4', 'Welcome to the Course')],
      pdfs: [],
      videoProgressList: [],
      statusMap: {},
    })

    expect(target.lessonTitle).toBe('Welcome to the Course')
  })
})

// ── Track Resolver ───────────────────────────────────────────────────────

describe('resolveTrackResumeTargetSync', () => {
  function makeCourseTarget(
    courseId: string,
    action: 'resume' | 'start' | 'complete',
    lessonId?: string,
  ): CourseResumeTarget {
    return {
      action,
      courseId,
      lessonId: lessonId ?? null,
      resumePositionSeconds: action === 'resume' ? 30 : 0,
    }
  }

  it('returns the first non-complete course', () => {
    const target = resolveTrackResumeTargetSync('path-1', {
      sortedEntries: [
        { courseId: 'c1', position: 1 },
        { courseId: 'c2', position: 2 },
      ],
      courseResumeTargets: new Map([
        ['c1', makeCourseTarget('c1', 'start', 'v1')],
        ['c2', makeCourseTarget('c2', 'start', 'v2')],
      ]),
    })

    expect(target.action).toBe('start')
    expect(target.courseId).toBe('c1')
    expect(target.lessonId).toBe('v1')
    expect(target.coursePosition).toBe(1)
  })

  it('skips complete first course and returns second', () => {
    const target = resolveTrackResumeTargetSync('path-1', {
      sortedEntries: [
        { courseId: 'c1', position: 1 },
        { courseId: 'c2', position: 2 },
      ],
      courseResumeTargets: new Map([
        ['c1', makeCourseTarget('c1', 'complete')],
        ['c2', makeCourseTarget('c2', 'start', 'v1')],
      ]),
    })

    expect(target.courseId).toBe('c2')
    expect(target.lessonId).toBe('v1')
    expect(target.coursePosition).toBe(2)
  })

  it('returns complete when all courses are complete', () => {
    const target = resolveTrackResumeTargetSync('path-1', {
      sortedEntries: [
        { courseId: 'c1', position: 1 },
        { courseId: 'c2', position: 2 },
      ],
      courseResumeTargets: new Map([
        ['c1', makeCourseTarget('c1', 'complete')],
        ['c2', makeCourseTarget('c2', 'complete')],
      ]),
    })

    expect(target.action).toBe('complete')
    expect(target.courseId).toBe('')
    expect(target.lessonId).toBeNull()
    expect(target.resumePositionSeconds).toBe(0)
  })

  it('never returns lesson 1 of a completed course', () => {
    // c1 is complete, c2 is also complete — should return complete, not c1 lesson 1
    const target = resolveTrackResumeTargetSync('path-1', {
      sortedEntries: [
        { courseId: 'c1', position: 1 },
        { courseId: 'c2', position: 2 },
      ],
      courseResumeTargets: new Map([
        ['c1', makeCourseTarget('c1', 'complete')],
        ['c2', makeCourseTarget('c2', 'complete')],
      ]),
    })

    expect(target.action).toBe('complete')
    expect(target.lessonId).toBeNull()
    // Should NOT be 'c1' with lesson 'v1'
    expect(target.courseId).toBe('')
  })

  it('preserves resume position from partially watched course', () => {
    const target = resolveTrackResumeTargetSync('path-1', {
      sortedEntries: [{ courseId: 'c1', position: 1 }],
      courseResumeTargets: new Map([
        [
          'c1',
          {
            action: 'resume' as const,
            courseId: 'c1',
            lessonId: 'v5',
            resumePositionSeconds: 120,
          },
        ],
      ]),
    })

    expect(target.action).toBe('resume')
    expect(target.resumePositionSeconds).toBe(120)
    expect(target.lessonId).toBe('v5')
  })

  it('skips entries with empty courseId (gap entries)', () => {
    const target = resolveTrackResumeTargetSync('path-1', {
      sortedEntries: [
        { courseId: '', position: 1 }, // gap — skipped
        { courseId: 'c1', position: 2 },
      ],
      courseResumeTargets: new Map([['c1', makeCourseTarget('c1', 'start', 'v1')]]),
    })

    expect(target.courseId).toBe('c1')
    expect(target.coursePosition).toBe(2)
  })

  it('returns complete for empty track', () => {
    const target = resolveTrackResumeTargetSync('path-1', {
      sortedEntries: [],
      courseResumeTargets: new Map(),
    })

    expect(target.action).toBe('complete')
    expect(target.pathId).toBe('path-1')
  })
})
