import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

// Must import after fake-indexeddb/auto polyfill is active
let db: Awaited<typeof import('@/db/schema')>['db']

// Re-import module under test after fresh DB
let saveFrameCapture: typeof import('@/lib/frame-capture')['saveFrameCapture']
let getFrameThumbnailUrl: typeof import('@/lib/frame-capture')['getFrameThumbnailUrl']
let getScreenshot: typeof import('@/lib/frame-capture')['getScreenshot']
let captureVideoFrame: typeof import('@/lib/frame-capture')['captureVideoFrame']
let formatFrameTimestamp: typeof import('@/lib/frame-capture')['formatFrameTimestamp']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const schemaModule = await import('@/db/schema')
  db = schemaModule.db

  const mod = await import('@/lib/frame-capture')
  saveFrameCapture = mod.saveFrameCapture
  getFrameThumbnailUrl = mod.getFrameThumbnailUrl
  getScreenshot = mod.getScreenshot
  captureVideoFrame = mod.captureVideoFrame
  formatFrameTimestamp = mod.formatFrameTimestamp
})

// ── formatFrameTimestamp ──────────────────────────────────────

describe('formatFrameTimestamp', () => {
  it('formats 0 seconds', () => {
    expect(formatFrameTimestamp(0)).toBe('Frame at 0:00')
  })

  it('formats 59 seconds', () => {
    expect(formatFrameTimestamp(59)).toBe('Frame at 0:59')
  })

  it('formats exactly 60 seconds', () => {
    expect(formatFrameTimestamp(60)).toBe('Frame at 1:00')
  })

  it('formats hours (3661s = 1h 1m 1s)', () => {
    expect(formatFrameTimestamp(3661)).toBe('Frame at 1:01:01')
  })

  it('formats fractional seconds (floors)', () => {
    expect(formatFrameTimestamp(90.7)).toBe('Frame at 1:30')
  })
})

// ── saveFrameCapture ──────────────────────────────────────────

describe('saveFrameCapture', () => {
  const blob = new Blob(['full'], { type: 'image/jpeg' })
  const thumbnail = new Blob(['thumb'], { type: 'image/jpeg' })

  it('saves screenshot to IndexedDB and returns the record', async () => {
    const result = await saveFrameCapture('course-1', 'lesson-1', 42, blob, thumbnail)

    expect(result.id).toBeDefined()
    expect(result.courseId).toBe('course-1')
    expect(result.lessonId).toBe('lesson-1')
    expect(result.timestamp).toBe(42)
    expect(result.blob).toBe(blob)
    expect(result.thumbnail).toBe(thumbnail)
    expect(result.createdAt).toBeDefined()

    // Verify persisted
    const stored = await db.screenshots.get(result.id)
    expect(stored).toBeDefined()
    expect(stored!.courseId).toBe('course-1')
  })

  it('throws user-friendly message on QuotaExceededError', async () => {
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError')
    vi.spyOn(db.screenshots, 'add').mockRejectedValueOnce(quotaError)

    await expect(saveFrameCapture('c', 'l', 0, blob, thumbnail)).rejects.toThrow(
      'Storage full — delete old frame captures to free space'
    )
  })

  it('throws user-friendly message on Firefox NS_ERROR_DOM_QUOTA_REACHED', async () => {
    const ffError = new DOMException('Quota reached', 'NS_ERROR_DOM_QUOTA_REACHED')
    vi.spyOn(db.screenshots, 'add').mockRejectedValueOnce(ffError)

    await expect(saveFrameCapture('c', 'l', 0, blob, thumbnail)).rejects.toThrow(
      'Storage full — delete old frame captures to free space'
    )
  })

  it('re-throws non-quota errors unchanged', async () => {
    const genericError = new Error('Network failure')
    vi.spyOn(db.screenshots, 'add').mockRejectedValueOnce(genericError)

    await expect(saveFrameCapture('c', 'l', 0, blob, thumbnail)).rejects.toThrow(
      'Network failure'
    )
  })
})

// ── getFrameThumbnailUrl ──────────────────────────────────────

describe('getFrameThumbnailUrl', () => {
  it('returns null for non-existent screenshot', async () => {
    const result = await getFrameThumbnailUrl('non-existent-id')
    expect(result).toBeNull()
  })

  it('returns an object URL for valid screenshot', async () => {
    const thumbnail = new Blob(['thumb'], { type: 'image/jpeg' })
    await db.screenshots.add({
      id: 'ss-1',
      courseId: 'c',
      lessonId: 'l',
      timestamp: 10,
      blob: new Blob(['full']),
      thumbnail,
      createdAt: new Date().toISOString(),
    })

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url')

    const url = await getFrameThumbnailUrl('ss-1')
    expect(url).toBe('blob:mock-url')
    expect(createObjectURLSpy).toHaveBeenCalledOnce()

    createObjectURLSpy.mockRestore()
  })
})

// ── getScreenshot ─────────────────────────────────────────────

describe('getScreenshot', () => {
  it('returns undefined for non-existent ID', async () => {
    const result = await getScreenshot('no-such-id')
    expect(result).toBeUndefined()
  })

  it('returns the full screenshot record', async () => {
    await db.screenshots.add({
      id: 'ss-2',
      courseId: 'c',
      lessonId: 'l',
      timestamp: 30,
      blob: new Blob(['full']),
      thumbnail: new Blob(['thumb']),
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    const result = await getScreenshot('ss-2')
    expect(result).toBeDefined()
    expect(result!.id).toBe('ss-2')
    expect(result!.timestamp).toBe(30)
  })
})

// ── captureVideoFrame ─────────────────────────────────────────

describe('captureVideoFrame', () => {
  function createMockCanvas() {
    const ctx = {
      drawImage: vi.fn(),
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      toBlob: vi.fn(),
    }
    return { canvas, ctx }
  }

  function makeMockVideo(width: number, height: number) {
    return { videoWidth: width, videoHeight: height } as unknown as HTMLVideoElement
  }

  it('rejects when video has zero dimensions', async () => {
    const video = makeMockVideo(0, 0)
    await expect(captureVideoFrame(video)).rejects.toThrow('Video has no dimensions')
  })

  it('rejects when canvas context is null', async () => {
    const video = makeMockVideo(640, 360)
    const { canvas } = createMockCanvas()
    canvas.getContext.mockReturnValue(null)

    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)

    await expect(captureVideoFrame(video)).rejects.toThrow('Cannot create canvas context')
  })

  it('rejects when full-res toBlob returns null', async () => {
    const video = makeMockVideo(640, 360)
    const { canvas } = createMockCanvas()
    canvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => cb(null))

    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)

    await expect(captureVideoFrame(video)).rejects.toThrow('Canvas toBlob returned null')
  })

  it('rejects when thumbnail toBlob returns null', async () => {
    const video = makeMockVideo(640, 360)

    const fullCanvas = createMockCanvas()
    const thumbCanvas = createMockCanvas()

    const fullBlob = new Blob(['full'], { type: 'image/jpeg' })
    fullCanvas.canvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => cb(fullBlob))
    thumbCanvas.canvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => cb(null))

    const createElementSpy = vi.spyOn(document, 'createElement')
    createElementSpy
      .mockReturnValueOnce(fullCanvas.canvas as unknown as HTMLCanvasElement)
      .mockReturnValueOnce(thumbCanvas.canvas as unknown as HTMLCanvasElement)

    await expect(captureVideoFrame(video)).rejects.toThrow('Thumbnail toBlob returned null')
  })

  it('resolves with full blob and thumbnail blob', async () => {
    const video = makeMockVideo(640, 360)

    const fullCanvas = createMockCanvas()
    const thumbCanvas = createMockCanvas()

    const fullBlob = new Blob(['full-image'], { type: 'image/jpeg' })
    const thumbBlob = new Blob(['thumb-image'], { type: 'image/jpeg' })

    fullCanvas.canvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => cb(fullBlob))
    thumbCanvas.canvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => cb(thumbBlob))

    const createElementSpy = vi.spyOn(document, 'createElement')
    createElementSpy
      .mockReturnValueOnce(fullCanvas.canvas as unknown as HTMLCanvasElement)
      .mockReturnValueOnce(thumbCanvas.canvas as unknown as HTMLCanvasElement)

    const result = await captureVideoFrame(video)
    expect(result.blob).toBe(fullBlob)
    expect(result.thumbnail).toBe(thumbBlob)

    // Verify thumbnail canvas dimensions (200px wide, proportional)
    expect(thumbCanvas.canvas.width).toBe(200)
    expect(thumbCanvas.canvas.height).toBe(Math.round(360 * (200 / 640)))
  })
})
