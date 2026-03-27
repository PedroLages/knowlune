import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { BatchProgress } from '@/lib/youtubeTranscriptPipeline'

// Mock the transcript pipeline module
vi.mock('@/lib/youtubeTranscriptPipeline', () => ({
  fetchTranscriptsBatch: vi.fn(),
  getTranscript: vi.fn(),
  getCourseTranscripts: vi.fn(),
}))

import { useYouTubeTranscriptStore } from '@/stores/useYouTubeTranscriptStore'
import {
  fetchTranscriptsBatch,
  getTranscript,
  getCourseTranscripts,
} from '@/lib/youtubeTranscriptPipeline'

const mockFetchBatch = vi.mocked(fetchTranscriptsBatch)
const mockGetTranscript = vi.mocked(getTranscript)
const mockGetCourseTranscripts = vi.mocked(getCourseTranscripts)

function makeProgress(overrides: Partial<BatchProgress> = {}): BatchProgress {
  return { completed: 0, total: 0, succeeded: 0, failed: 0, ...overrides }
}

beforeEach(() => {
  useYouTubeTranscriptStore.getState().reset()
  vi.clearAllMocks()
})

describe('useYouTubeTranscriptStore initial state', () => {
  it('should have correct defaults', () => {
    const state = useYouTubeTranscriptStore.getState()
    expect(state.videoStates).toEqual({})
    expect(state.batchProgress).toBeNull()
    expect(state.isFetching).toBe(false)
  })
})

describe('fetchBatch', () => {
  it('should initialize video states as pending and set isFetching', async () => {
    mockFetchBatch.mockImplementation(async (_cId, _vIds, _onProgress) => {
      // Check state during fetch
      const state = useYouTubeTranscriptStore.getState()
      expect(state.isFetching).toBe(true)
      expect(state.videoStates['course-1:v1'].status).toBe('pending')
      expect(state.videoStates['course-1:v2'].status).toBe('pending')
      return []
    })
    mockGetCourseTranscripts.mockResolvedValue([])

    await useYouTubeTranscriptStore.getState().fetchBatch('course-1', ['v1', 'v2'])

    expect(mockFetchBatch).toHaveBeenCalledWith(
      'course-1',
      ['v1', 'v2'],
      expect.any(Function),
      undefined
    )
    expect(useYouTubeTranscriptStore.getState().isFetching).toBe(false)
    expect(useYouTubeTranscriptStore.getState().batchProgress).toBeNull()
  })

  it('should prevent concurrent batches', async () => {
    // Set isFetching manually
    useYouTubeTranscriptStore.setState({ isFetching: true })

    await useYouTubeTranscriptStore.getState().fetchBatch('course-1', ['v1'])

    // fetchTranscriptsBatch should NOT have been called
    expect(mockFetchBatch).not.toHaveBeenCalled()
  })

  it('should update progress during batch fetch', async () => {
    mockFetchBatch.mockImplementation(async (_cId, _vIds, onProgress) => {
      // Simulate progress callback
      onProgress!(makeProgress({ completed: 1, total: 2, succeeded: 1, current: 'v1' }))
      const state = useYouTubeTranscriptStore.getState()
      expect(state.batchProgress!.completed).toBe(1)
      expect(state.videoStates['course-1:v1'].status).toBe('fetching')
      return []
    })
    mockGetCourseTranscripts.mockResolvedValue([])

    await useYouTubeTranscriptStore.getState().fetchBatch('course-1', ['v1', 'v2'])
  })

  it('should handle progress callback without current field', async () => {
    mockFetchBatch.mockImplementation(async (_cId, _vIds, onProgress) => {
      // Progress without current video
      onProgress!(makeProgress({ completed: 0, total: 2 }))
      const state = useYouTubeTranscriptStore.getState()
      expect(state.batchProgress!.total).toBe(2)
      return []
    })
    mockGetCourseTranscripts.mockResolvedValue([])

    await useYouTubeTranscriptStore.getState().fetchBatch('course-1', ['v1', 'v2'])
  })

  it('should reload course states from Dexie after batch completes', async () => {
    mockFetchBatch.mockResolvedValue([])
    mockGetCourseTranscripts.mockResolvedValue([
      { videoId: 'v1', status: 'done', courseId: 'course-1' },
      { videoId: 'v2', status: 'failed', failureReason: 'No captions', courseId: 'course-1' },
    ] as never)

    await useYouTubeTranscriptStore.getState().fetchBatch('course-1', ['v1', 'v2'])

    const state = useYouTubeTranscriptStore.getState()
    expect(state.videoStates['course-1:v1'].status).toBe('done')
    expect(state.videoStates['course-1:v2'].status).toBe('failed')
    expect(state.videoStates['course-1:v2'].failureReason).toBe('No captions')
  })

  it('should pass lang parameter to fetchTranscriptsBatch', async () => {
    mockFetchBatch.mockResolvedValue([])
    mockGetCourseTranscripts.mockResolvedValue([])

    await useYouTubeTranscriptStore.getState().fetchBatch('course-1', ['v1'], 'pt')

    expect(mockFetchBatch).toHaveBeenCalledWith('course-1', ['v1'], expect.any(Function), 'pt')
  })
})

describe('getVideoStatus', () => {
  it('should return status for existing video', () => {
    useYouTubeTranscriptStore.setState({
      videoStates: { 'course-1:v1': { status: 'done' } },
    })

    expect(useYouTubeTranscriptStore.getState().getVideoStatus('course-1', 'v1')).toBe('done')
  })

  it('should return undefined for non-existent video', () => {
    expect(useYouTubeTranscriptStore.getState().getVideoStatus('c1', 'unknown')).toBeUndefined()
  })
})

describe('loadCourseStates', () => {
  it('should load states from Dexie and merge with existing', async () => {
    useYouTubeTranscriptStore.setState({
      videoStates: { 'other:v99': { status: 'done' } },
    })

    mockGetCourseTranscripts.mockResolvedValue([
      { videoId: 'v1', status: 'done', courseId: 'course-1' },
    ] as never)

    await useYouTubeTranscriptStore.getState().loadCourseStates('course-1')

    const state = useYouTubeTranscriptStore.getState()
    expect(state.videoStates['course-1:v1'].status).toBe('done')
    // Existing state preserved
    expect(state.videoStates['other:v99'].status).toBe('done')
  })
})

describe('getTranscript', () => {
  it('should delegate to pipeline getTranscript', async () => {
    const record = { courseId: 'c1', videoId: 'v1', text: 'Hello world' }
    mockGetTranscript.mockResolvedValue(record as never)

    const result = await useYouTubeTranscriptStore.getState().getTranscript('c1', 'v1')
    expect(result).toEqual(record)
    expect(mockGetTranscript).toHaveBeenCalledWith('c1', 'v1')
  })
})

describe('reset', () => {
  it('should reset all state', () => {
    useYouTubeTranscriptStore.setState({
      videoStates: { 'c1:v1': { status: 'done' } },
      batchProgress: makeProgress({ completed: 1, total: 1, succeeded: 1 }),
      isFetching: true,
    })

    useYouTubeTranscriptStore.getState().reset()

    const state = useYouTubeTranscriptStore.getState()
    expect(state.videoStates).toEqual({})
    expect(state.batchProgress).toBeNull()
    expect(state.isFetching).toBe(false)
  })
})
