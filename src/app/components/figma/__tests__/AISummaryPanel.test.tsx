import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockResolveTranscript,
  mockGetSummary,
  mockPutSummary,
  mockGenerateSummary,
  mockTrackAIUsage,
} = vi.hoisted(() => ({
  mockResolveTranscript: vi.fn(),
  mockGetSummary: vi.fn(),
  mockPutSummary: vi.fn(),
  mockGenerateSummary: vi.fn(),
  mockTrackAIUsage: vi.fn(),
}))

vi.mock('@/db/schema', () => ({
  db: {
    lessonSummaries: {
      get: mockGetSummary,
      put: mockPutSummary,
    },
  },
}))

vi.mock('@/lib/lessonTranscript', () => ({
  resolveLessonTranscript: mockResolveTranscript,
}))

vi.mock('@/lib/aiConfiguration', () => ({
  isAIAvailable: () => true,
  isFeatureEnabled: () => true,
  resolveFeatureModel: () => ({ provider: 'openai', model: 'gpt-test' }),
}))

vi.mock('@/lib/aiSummary', () => ({
  generateVideoSummary: mockGenerateSummary,
}))

vi.mock('@/lib/aiEventTracking', () => ({
  trackAIUsage: mockTrackAIUsage,
}))

import { AISummaryPanel } from '@/app/components/figma/AISummaryPanel'

const READY_TRANSCRIPT = {
  status: 'ready' as const,
  text: 'A complete lesson transcript.',
  cues: [{ startTime: 0, endTime: 2, text: 'A complete lesson transcript.' }],
  fingerprint: 'fingerprint-current',
  source: 'youtube' as const,
  videoId: 'youtube-1',
}

function summaryStream(...chunks: string[]) {
  return (async function* () {
    for (const chunk of chunks) yield chunk
  })()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveTranscript.mockResolvedValue(READY_TRANSCRIPT)
  mockGetSummary.mockResolvedValue(undefined)
  mockPutSummary.mockResolvedValue(undefined)
  mockGenerateSummary.mockImplementation(() => summaryStream('Generated ', 'summary text.'))
  mockTrackAIUsage.mockResolvedValue(undefined)
})

describe('AISummaryPanel', () => {
  it('restores a saved summary when its transcript fingerprint matches', async () => {
    mockGetSummary.mockResolvedValue({
      courseId: 'course-1',
      lessonId: 'lesson-1',
      text: 'Previously saved summary.',
      wordCount: 3,
      transcriptFingerprint: 'fingerprint-current',
      provider: 'openai',
      model: 'gpt-test',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    render(<AISummaryPanel courseId="course-1" lessonId="lesson-1" />)

    expect(await screen.findByText('Previously saved summary.')).toBeInTheDocument()
    expect(screen.getByTestId('summary-word-count')).toHaveTextContent('3 words')
    expect(mockGenerateSummary).not.toHaveBeenCalled()
  })

  it('invalidates a saved summary when the transcript changes', async () => {
    mockGetSummary.mockResolvedValue({
      transcriptFingerprint: 'fingerprint-old',
      text: 'Outdated summary.',
      wordCount: 2,
    })

    render(<AISummaryPanel courseId="course-1" lessonId="lesson-1" />)

    expect(
      await screen.findByText(/transcript changed since this summary was created/i)
    ).toBeInTheDocument()
    expect(screen.queryByText('Outdated summary.')).not.toBeInTheDocument()
    expect(screen.getByTestId('generate-summary-button')).toBeInTheDocument()
  })

  it('persists a completed streamed summary before showing success', async () => {
    render(<AISummaryPanel courseId="course-1" lessonId="lesson-1" />)
    fireEvent.click(await screen.findByTestId('generate-summary-button'))

    expect(await screen.findByText('Generated summary text.')).toBeInTheDocument()
    await waitFor(() => expect(mockPutSummary).toHaveBeenCalledTimes(1))
    expect(mockPutSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'course-1',
        lessonId: 'lesson-1',
        text: 'Generated summary text.',
        wordCount: 3,
        transcriptFingerprint: 'fingerprint-current',
        provider: 'openai',
        model: 'gpt-test',
      })
    )
  })

  it('clears the previous lesson summary when lesson identity changes', async () => {
    mockGetSummary
      .mockResolvedValueOnce({
        text: 'Lesson one summary.',
        wordCount: 3,
        transcriptFingerprint: 'fingerprint-current',
      })
      .mockResolvedValueOnce(undefined)
    mockResolveTranscript
      .mockResolvedValueOnce(READY_TRANSCRIPT)
      .mockResolvedValueOnce({ ...READY_TRANSCRIPT, fingerprint: 'fingerprint-lesson-2' })

    const { rerender } = render(<AISummaryPanel courseId="course-1" lessonId="lesson-1" />)
    expect(await screen.findByText('Lesson one summary.')).toBeInTheDocument()

    rerender(<AISummaryPanel courseId="course-1" lessonId="lesson-2" />)

    expect(await screen.findByTestId('generate-summary-button')).toBeInTheDocument()
    expect(screen.queryByText('Lesson one summary.')).not.toBeInTheDocument()
  })

  it('guides the learner to create a transcript when one is missing', async () => {
    const onRequestTranscript = vi.fn()
    mockResolveTranscript.mockResolvedValue({
      status: 'missing',
      reason: 'No transcript is available for this lesson.',
    })

    render(
      <AISummaryPanel
        courseId="course-1"
        lessonId="lesson-1"
        onRequestTranscript={onRequestTranscript}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Generate Transcript First' }))
    expect(onRequestTranscript).toHaveBeenCalledTimes(1)
  })
})
