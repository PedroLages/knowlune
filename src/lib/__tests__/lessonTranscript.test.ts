import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetVideo, mockGetYouTubeTranscript, mockGetCaption } = vi.hoisted(() => ({
  mockGetVideo: vi.fn(),
  mockGetYouTubeTranscript: vi.fn(),
  mockGetCaption: vi.fn(),
}))

vi.mock('@/db/schema', () => ({
  db: {
    importedVideos: { get: mockGetVideo },
    youtubeTranscripts: { get: mockGetYouTubeTranscript },
    videoCaptions: { get: mockGetCaption },
  },
}))

import { fingerprintTranscript, resolveLessonTranscript } from '@/lib/lessonTranscript'

const DONE_TRANSCRIPT = {
  courseId: 'course-1',
  videoId: 'youtube-123',
  language: 'en',
  cues: [{ startTime: 0, endTime: 2, text: 'A reliable transcript.' }],
  fullText: 'A reliable transcript.',
  source: 'youtube-transcript' as const,
  status: 'done' as const,
  fetchedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetVideo.mockResolvedValue(undefined)
  mockGetYouTubeTranscript.mockResolvedValue(undefined)
  mockGetCaption.mockResolvedValue(undefined)
})

describe('resolveLessonTranscript', () => {
  it('resolves an imported YouTube lesson through its real video ID', async () => {
    mockGetVideo.mockResolvedValue({
      id: 'lesson-uuid',
      courseId: 'course-1',
      youtubeVideoId: 'youtube-123',
      duration: 120,
    })
    mockGetYouTubeTranscript.mockImplementation(([, videoId]: [string, string]) =>
      Promise.resolve(videoId === 'youtube-123' ? DONE_TRANSCRIPT : undefined)
    )

    const result = await resolveLessonTranscript('course-1', 'lesson-uuid')

    expect(result).toMatchObject({
      status: 'ready',
      source: 'youtube',
      videoId: 'youtube-123',
      text: 'A reliable transcript.',
    })
  })

  it.each([
    ['vtt', 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nLocal VTT caption.'],
    ['srt', '1\n00:00:00,000 --> 00:00:02,000\nLocal SRT caption.'],
  ] as const)('resolves a local %s caption', async (format, content) => {
    mockGetCaption.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      filename: `lesson.${format}`,
      format,
      content,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    const result = await resolveLessonTranscript('course-1', 'lesson-1')

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.source).toBe('local-caption')
      expect(result.text).toContain(`Local ${format.toUpperCase()} caption.`)
      expect(result.cues).toHaveLength(1)
    }
  })

  it('falls back to Whisper output stored by the internal lesson ID', async () => {
    mockGetVideo.mockResolvedValue({
      id: 'lesson-uuid',
      courseId: 'course-1',
      youtubeVideoId: 'youtube-123',
      duration: 120,
    })
    mockGetYouTubeTranscript.mockImplementation(([, videoId]: [string, string]) =>
      Promise.resolve(
        videoId === 'lesson-uuid'
          ? { ...DONE_TRANSCRIPT, videoId, source: 'whisper' as const }
          : undefined
      )
    )

    const result = await resolveLessonTranscript('course-1', 'lesson-uuid')

    expect(result).toMatchObject({ status: 'ready', source: 'whisper', videoId: 'lesson-uuid' })
  })

  it('reports processing, failed, and missing states explicitly', async () => {
    mockGetYouTubeTranscript.mockResolvedValueOnce({
      ...DONE_TRANSCRIPT,
      videoId: 'lesson-1',
      status: 'fetching',
    })
    await expect(resolveLessonTranscript('course-1', 'lesson-1')).resolves.toMatchObject({
      status: 'processing',
    })

    mockGetYouTubeTranscript.mockResolvedValueOnce({
      ...DONE_TRANSCRIPT,
      videoId: 'lesson-1',
      status: 'failed',
      failureReason: 'Provider unavailable',
    })
    await expect(resolveLessonTranscript('course-1', 'lesson-1')).resolves.toEqual({
      status: 'error',
      reason: 'Provider unavailable',
    })

    await expect(resolveLessonTranscript('course-1', 'lesson-1')).resolves.toMatchObject({
      status: 'missing',
    })
  })

  it('normalizes whitespace before calculating a fingerprint', async () => {
    await expect(fingerprintTranscript('same\n transcript')).resolves.toBe(
      await fingerprintTranscript(' same transcript ')
    )
  })
})
