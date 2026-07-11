import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockExtractThumbnail,
  mockSaveThumbnail,
  mockGetState,
  mockSetState,
  mockResizeImageToBlob,
} = vi.hoisted(() => ({
  mockExtractThumbnail: vi.fn(),
  mockSaveThumbnail: vi.fn(),
  mockGetState: vi.fn(() => ({ thumbnailUrls: {} })),
  mockSetState: vi.fn(),
  mockResizeImageToBlob: vi.fn(),
}))

vi.mock('@/lib/thumbnailService', () => ({
  extractThumbnailFromVideo: mockExtractThumbnail,
  saveCourseThumbnail: mockSaveThumbnail,
  resizeImageToBlob: mockResizeImageToBlob,
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: {
    getState: mockGetState,
    setState: mockSetState,
  },
}))

// MediaError is not available in jsdom/vitest — mock it
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4
vi.stubGlobal('MediaError', {
  MEDIA_ERR_SRC_NOT_SUPPORTED,
  MEDIA_ERR_DECODE: 3,
  MEDIA_ERR_NETWORK: 2,
  MEDIA_ERR_ABORTED: 1,
})

import {
  autoGenerateThumbnail,
  autoGenerateThumbnailFromServer,
  extractFrameFromServerVideo,
} from '../autoThumbnail'

describe('autoGenerateThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({ thumbnailUrls: {} })
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:thumb-url')
  })

  it('generates and persists thumbnail', async () => {
    const mockBlob = new Blob(['image data'])
    mockExtractThumbnail.mockResolvedValue(mockBlob)
    mockSaveThumbnail.mockResolvedValue(undefined)

    await autoGenerateThumbnail('course-1', {} as FileSystemFileHandle)

    expect(mockExtractThumbnail).toHaveBeenCalled()
    expect(mockSaveThumbnail).toHaveBeenCalledWith('course-1', mockBlob, 'auto')
    expect(mockSetState).toHaveBeenCalled()
  })

  it('skips if thumbnail already exists', async () => {
    mockGetState.mockReturnValue({ thumbnailUrls: { 'course-1': 'existing-url' } })

    await autoGenerateThumbnail('course-1', {} as FileSystemFileHandle)

    expect(mockExtractThumbnail).not.toHaveBeenCalled()
  })
})

// ───── autoGenerateThumbnailFromServer ─────

describe('autoGenerateThumbnailFromServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({ thumbnailUrls: {} })
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:thumb-url')
  })

  it('skips if thumbnail already exists', async () => {
    mockGetState.mockReturnValue({ thumbnailUrls: { 'course-1': 'existing-url' } })

    await autoGenerateThumbnailFromServer('course-1', 'http://example.com/video.mp4')

    expect(mockResizeImageToBlob).not.toHaveBeenCalled()
  })
})

// ───── extractFrameFromServerVideo ─────

describe('extractFrameFromServerVideo', () => {
  // Helper to create a fake video element with controllable event dispatch
  function createMockVideo() {
    const listeners = new Map<string, EventListenerOrEventListenerObject[]>()
    const video = {
      src: '',
      preload: '',
      muted: false,
      crossOrigin: '',
      currentTime: 0,
      videoWidth: 1280,
      videoHeight: 720,
      duration: 30,
      readyState: 0, // HTMLMediaElement.HAVE_NOTHING
      error: null as MediaError | null,
      load: vi.fn(),
      removeAttribute: vi.fn(),
      addEventListener: vi.fn(
        (type: string, handler: EventListenerOrEventListenerObject, _opts?: unknown) => {
          const existing = listeners.get(type) ?? []
          existing.push(handler)
          listeners.set(type, existing)
        }
      ),
      // Trigger stored event listeners
      _dispatchEvent(type: string) {
        const handlers = listeners.get(type) ?? []
        for (const h of handlers) {
          if (typeof h === 'function') h(new Event(type))
          else h.handleEvent(new Event(type))
        }
      },
    }
    return video
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockResizeImageToBlob.mockReset()
    mockResizeImageToBlob.mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' }))
  })

  it('captures a frame when video loads successfully', async () => {
    const mockVideo = createMockVideo()
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(mockVideo as unknown as HTMLElement)

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    // loadedmetadata fires → seeks to currentTime = 3 (min(30*0.1, 3))
    mockVideo._dispatchEvent('loadedmetadata')
    expect(mockVideo.currentTime).toBe(3)

    // seeked fires → attemptCapture
    mockVideo.readyState = 2 // HAVE_CURRENT_DATA
    mockVideo._dispatchEvent('seeked')

    const blob = await promise
    expect(blob).toBeDefined()
    expect(mockResizeImageToBlob).toHaveBeenCalledWith(mockVideo)
    expect(mockVideo.removeAttribute).toHaveBeenCalledWith('src')
    expect(mockVideo.load).toHaveBeenCalled()

    createElementSpy.mockRestore()
  })

  it('retries with fallback seek targets when dimensions are zero', async () => {
    const mockVideo = createMockVideo()
    mockVideo.videoWidth = 0
    mockVideo.videoHeight = 0
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    // Initial seek
    mockVideo._dispatchEvent('loadedmetadata')
    // Seeked but dimensions invalid → fallback to 0.1s
    mockVideo._dispatchEvent('seeked')
    expect(mockVideo.currentTime).toBe(0.1)

    // Second seeked with valid dimensions
    mockVideo.videoWidth = 1280
    mockVideo.videoHeight = 720
    mockVideo.readyState = 2
    mockVideo._dispatchEvent('seeked')

    const blob = await promise
    expect(blob).toBeDefined()
  })

  it('retries through all fallback targets then rejects', async () => {
    const mockVideo = createMockVideo()
    mockVideo.videoWidth = 0
    mockVideo.videoHeight = 0
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    mockVideo._dispatchEvent('loadedmetadata')
    // Fallback 1: 0.1s
    mockVideo._dispatchEvent('seeked')
    expect(mockVideo.currentTime).toBe(0.1)
    // Fallback 2: 0
    mockVideo._dispatchEvent('seeked')
    expect(mockVideo.currentTime).toBe(0)
    // All fallbacks exhausted
    mockVideo._dispatchEvent('seeked')

    await expect(promise).rejects.toThrow('invalid dimensions')
  })

  it('handles video error event (format not supported)', async () => {
    const mockVideo = createMockVideo()
    // MEDIA_ERR_SRC_NOT_SUPPORTED = 4
    mockVideo.error = { code: 4, message: '' } as unknown as MediaError
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    mockVideo._dispatchEvent('error')

    await expect(promise).rejects.toThrow('format not supported')
  })

  it('times out after 15 seconds', async () => {
    vi.useFakeTimers()
    const mockVideo = createMockVideo()
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    // Advance past the 15s timeout
    vi.advanceTimersByTime(16_000)

    await expect(promise).rejects.toThrow('timed out after 15 seconds')

    vi.useRealTimers()
  })

  it('cleans up idempotently — only resolves/rejects once', async () => {
    const mockVideo = createMockVideo()
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    mockVideo._dispatchEvent('loadedmetadata')
    mockVideo.readyState = 2
    mockVideo._dispatchEvent('seeked')

    const blob = await promise
    expect(blob).toBeDefined()

    // Verify cleanup ran: removeAttribute is called once during cleanup
    // (load() is called twice: once at init, once during cleanup)
    expect(mockVideo.removeAttribute).toHaveBeenCalledTimes(1)
  })

  it('handles CORS blocking (canvas SecurityError)', async () => {
    const mockVideo = createMockVideo()
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)
    mockResizeImageToBlob.mockRejectedValueOnce(new DOMException('Tainted canvas', 'SecurityError'))

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    mockVideo._dispatchEvent('loadedmetadata')
    mockVideo.readyState = 2
    mockVideo._dispatchEvent('seeked')

    await expect(promise).rejects.toThrow('CORS may block canvas access')
  })

  it('waits for HAVE_CURRENT_DATA readyState before capturing', async () => {
    const mockVideo = createMockVideo()
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    mockVideo._dispatchEvent('loadedmetadata')
    // readyState is 0 (HAVE_NOTHING) — attemptCapture returns early
    mockVideo._dispatchEvent('seeked')
    // loadeddata fires with readyState still 0
    mockVideo._dispatchEvent('loadeddata')

    // Now set readyState and dispatch seeked again
    mockVideo.readyState = 2
    mockVideo._dispatchEvent('seeked')

    const blob = await promise
    expect(blob).toBeDefined()
  })

  it('does not capture from loadeddata before first seek', async () => {
    const mockVideo = createMockVideo()
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    const promise = extractFrameFromServerVideo('http://example.com/video.mp4')

    // loadeddata fires before loadedmetadata/seek — should be ignored
    mockVideo.readyState = 2
    mockVideo._dispatchEvent('loadeddata')
    // resizeImageToBlob should NOT have been called yet
    expect(mockResizeImageToBlob).not.toHaveBeenCalled()

    // Now loadedmetadata + seeked fires properly
    mockVideo._dispatchEvent('loadedmetadata')
    mockVideo._dispatchEvent('seeked')

    const blob = await promise
    expect(blob).toBeDefined()
  })
})
