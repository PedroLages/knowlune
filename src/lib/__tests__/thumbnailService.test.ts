import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import Dexie from 'dexie'
import { FIXED_DATE } from '../../../tests/utils/test-time'

// Dynamic imports after fake-indexeddb polyfill
type ThumbnailModule = typeof import('@/lib/thumbnailService')
let mod: ThumbnailModule
let db: Awaited<typeof import('@/db/schema')>['db']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  // Mock Date constructor to return FIXED_DATE without using fake timers
  // (fake timers break IndexedDB internal async operations)
  const OrigDate = globalThis.Date
  const fixedNow = new OrigDate(FIXED_DATE).getTime()
  vi.spyOn(globalThis, 'Date').mockImplementation(function (this: Date, ...args: unknown[]) {
    if (args.length === 0) {
      return new OrigDate(fixedNow)
    }
    // @ts-expect-error - spread into Date constructor
    return new OrigDate(...args)
  } as unknown as typeof Date)
  // Keep static methods working
  globalThis.Date.now = () => fixedNow
  globalThis.Date.parse = OrigDate.parse
  globalThis.Date.UTC = OrigDate.UTC
  Object.defineProperty(globalThis.Date, 'prototype', { value: OrigDate.prototype })

  const schemaModule = await import('@/db/schema')
  db = schemaModule.db
  mod = await import('@/lib/thumbnailService')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Helpers ─────────────────────────────────────────────────────

function createMockCanvas(blobResult: Blob | null = new Blob(['jpeg'], { type: 'image/jpeg' })) {
  const ctx = { drawImage: vi.fn() }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((cb: (blob: Blob | null) => void) => cb(blobResult)),
  }
  return { canvas, ctx }
}

// ── saveCourseThumbnail ─────────────────────────────────────────

describe('saveCourseThumbnail', () => {
  it('persists a thumbnail record to IndexedDB', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' })
    await mod.saveCourseThumbnail('course-1', blob, 'local')

    const record = await db.courseThumbnails.get('course-1')
    expect(record).toBeDefined()
    expect(record!.courseId).toBe('course-1')
    expect(record!.blob).toBeDefined()
    expect(record!.source).toBe('local')
    expect(record!.createdAt).toBe(FIXED_DATE)
  })

  it('overwrites an existing thumbnail for the same courseId', async () => {
    const blob1 = new Blob(['v1'], { type: 'image/jpeg' })
    const blob2 = new Blob(['v2'], { type: 'image/jpeg' })

    await mod.saveCourseThumbnail('course-1', blob1, 'auto')
    await mod.saveCourseThumbnail('course-1', blob2, 'url')

    const record = await db.courseThumbnails.get('course-1')
    expect(record!.source).toBe('url')
    expect(record!.blob).toBeDefined()
  })

  it('handles all valid ThumbnailSource values', async () => {
    const sources = ['auto', 'local', 'url', 'ai'] as const
    for (const source of sources) {
      await mod.saveCourseThumbnail(`course-${source}`, new Blob([source]), source)
      const record = await db.courseThumbnails.get(`course-${source}`)
      expect(record!.source).toBe(source)
    }
  })
})

// ── loadCourseThumbnailUrl ──────────────────────────────────────

describe('loadCourseThumbnailUrl', () => {
  it('returns null when no thumbnail exists', async () => {
    const result = await mod.loadCourseThumbnailUrl('non-existent')
    expect(result).toBeNull()
  })

  it('returns an object URL for an existing thumbnail', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' })
    await db.courseThumbnails.put({
      courseId: 'course-1',
      blob,
      source: 'local',
      createdAt: FIXED_DATE,
    })

    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    const url = await mod.loadCourseThumbnailUrl('course-1')

    expect(url).toBe('blob:mock-url')
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })
})

// ── deleteCourseThumbnail ───────────────────────────────────────

describe('deleteCourseThumbnail', () => {
  it('deletes an existing thumbnail', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' })
    await db.courseThumbnails.put({
      courseId: 'course-1',
      blob,
      source: 'auto',
      createdAt: FIXED_DATE,
    })

    await mod.deleteCourseThumbnail('course-1')
    const record = await db.courseThumbnails.get('course-1')
    expect(record).toBeUndefined()
  })

  it('does not throw when deleting a non-existent thumbnail', async () => {
    await expect(mod.deleteCourseThumbnail('non-existent')).resolves.toBeUndefined()
  })
})

// ── loadThumbnailFromFile ───────────────────────────────────────

describe('loadThumbnailFromFile', () => {
  it('creates an ImageBitmap, resizes, and returns a Blob', async () => {
    const resultBlob = new Blob(['resized'], { type: 'image/jpeg' })
    const { canvas } = createMockCanvas(resultBlob)

    const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const blob = await mod.loadThumbnailFromFile(file)

    expect(blob).toBe(resultBlob)
    expect(mockBitmap.close).toHaveBeenCalledOnce()
  })

  it('rejects when canvas context is unavailable', async () => {
    const { canvas } = createMockCanvas()
    canvas.getContext.mockReturnValue(null as never)

    const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(mod.loadThumbnailFromFile(file)).rejects.toThrow('Canvas context unavailable')
  })

  it('rejects when toBlob returns null', async () => {
    const { canvas } = createMockCanvas(null)

    const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(mod.loadThumbnailFromFile(file)).rejects.toThrow('Canvas toBlob returned null')
  })
})

// ── fetchThumbnailFromUrl ───────────────────────────────────────

describe('fetchThumbnailFromUrl', () => {
  it('fetches image, creates bitmap, resizes, and returns blob', async () => {
    const resultBlob = new Blob(['resized'], { type: 'image/jpeg' })
    const { canvas } = createMockCanvas(resultBlob)

    const imageBuffer = new ArrayBuffer(8)
    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: vi.fn().mockResolvedValue(imageBuffer),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)

    const blob = await mod.fetchThumbnailFromUrl('https://example.com/image.png')

    expect(blob).toBe(resultBlob)
    expect(fetch).toHaveBeenCalledWith('https://example.com/image.png', { mode: 'cors' })
    expect(mockBitmap.close).toHaveBeenCalledOnce()
  })

  it('throws user-friendly message on network error (CORS)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(mod.fetchThumbnailFromUrl('https://blocked.com/img.jpg')).rejects.toThrow(
      'Could not fetch this URL'
    )
  })

  it('throws on non-OK response', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.fetchThumbnailFromUrl('https://example.com/missing.jpg')).rejects.toThrow(
      'Fetch failed: 404 Not Found'
    )
  })

  it('throws when content-type is not an image', async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.fetchThumbnailFromUrl('https://example.com/page.html')).rejects.toThrow(
      'URL did not return an image'
    )
  })

  it('throws when content-type header is missing', async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers(),
      arrayBuffer: vi.fn(),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.fetchThumbnailFromUrl('https://example.com/noheader')).rejects.toThrow(
      'URL did not return an image'
    )
  })
})

// ── extractThumbnailFromVideo ───────────────────────────────────

describe('extractThumbnailFromVideo', () => {
  function createMockVideoElement(duration: number) {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
    const video = {
      preload: '',
      muted: false,
      src: '',
      currentTime: 0,
      duration,
      addEventListener: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!listeners[event]) listeners[event] = []
        listeners[event].push(cb)
      }),
      load: vi.fn(),
    }
    const emit = (event: string) => {
      for (const cb of listeners[event] ?? []) cb()
    }
    return { video, emit }
  }

  it('extracts a thumbnail from a video file handle', async () => {
    const resultBlob = new Blob(['thumb'], { type: 'image/jpeg' })
    const { canvas } = createMockCanvas(resultBlob)

    const mockFile = new File(['video-data'], 'video.mp4', { type: 'video/mp4' })
    const mockHandle = {
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:video-url')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const { video, emit } = createMockVideoElement(30)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return video as unknown as HTMLVideoElement
      if (tag === 'canvas') return canvas as unknown as HTMLCanvasElement
      return document.createElement(tag)
    })

    const promise = mod.extractThumbnailFromVideo(mockHandle)

    // Allow the getFile() promise to resolve and video setup to complete
    await new Promise(r => setTimeout(r, 0))

    // Simulate video loading
    emit('loadedmetadata')
    // Check seek position: min(30 * 0.1, 3) = 3
    expect(video.currentTime).toBe(3)

    // Simulate seek completion
    emit('seeked')

    const blob = await promise
    expect(blob).toBe(resultBlob)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:video-url')

    revokeObjectURLSpy.mockRestore()
  })

  it('seeks to 10% for short videos (< 30s)', async () => {
    const resultBlob = new Blob(['thumb'], { type: 'image/jpeg' })
    const { canvas } = createMockCanvas(resultBlob)

    const mockFile = new File(['data'], 'short.mp4', { type: 'video/mp4' })
    const mockHandle = {
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const { video, emit } = createMockVideoElement(10)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return video as unknown as HTMLVideoElement
      if (tag === 'canvas') return canvas as unknown as HTMLCanvasElement
      return document.createElement(tag)
    })

    const promise = mod.extractThumbnailFromVideo(mockHandle)
    await new Promise(r => setTimeout(r, 0))

    emit('loadedmetadata')
    // min(10 * 0.1, 3) = 1
    expect(video.currentTime).toBe(1)

    emit('seeked')
    await promise
  })

  it('seeks to 0 when duration is NaN (not yet loaded)', async () => {
    const resultBlob = new Blob(['thumb'], { type: 'image/jpeg' })
    const { canvas } = createMockCanvas(resultBlob)

    const mockFile = new File(['data'], 'live.mp4', { type: 'video/mp4' })
    const mockHandle = {
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    // NaN * 0.1 = NaN, Math.min(NaN, 3) = NaN, isFinite(NaN) = false → seekTo = 0
    const { video, emit } = createMockVideoElement(NaN)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return video as unknown as HTMLVideoElement
      if (tag === 'canvas') return canvas as unknown as HTMLCanvasElement
      return document.createElement(tag)
    })

    const promise = mod.extractThumbnailFromVideo(mockHandle)
    await new Promise(r => setTimeout(r, 0))

    emit('loadedmetadata')
    expect(video.currentTime).toBe(0)

    emit('seeked')
    await promise
  })

  it('caps seek at 3s for long videos', async () => {
    const resultBlob = new Blob(['thumb'], { type: 'image/jpeg' })
    const { canvas } = createMockCanvas(resultBlob)

    const mockFile = new File(['data'], 'long.mp4', { type: 'video/mp4' })
    const mockHandle = {
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    // 600 * 0.1 = 60, Math.min(60, 3) = 3
    const { video, emit } = createMockVideoElement(600)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return video as unknown as HTMLVideoElement
      if (tag === 'canvas') return canvas as unknown as HTMLCanvasElement
      return document.createElement(tag)
    })

    const promise = mod.extractThumbnailFromVideo(mockHandle)
    await new Promise(r => setTimeout(r, 0))

    emit('loadedmetadata')
    expect(video.currentTime).toBe(3)

    emit('seeked')
    await promise
  })

  it('rejects and cleans up on video load error', async () => {
    const mockFile = new File(['data'], 'corrupt.mp4', { type: 'video/mp4' })
    const mockHandle = {
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const { video, emit } = createMockVideoElement(0)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return video as unknown as HTMLVideoElement
      return document.createElement(tag)
    })

    const promise = mod.extractThumbnailFromVideo(mockHandle)
    await new Promise(r => setTimeout(r, 0))

    emit('error')

    await expect(promise).rejects.toThrow('Failed to load video for thumbnail extraction')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url')

    revokeObjectURLSpy.mockRestore()
  })

  it('rejects when canvas context is unavailable during resize', async () => {
    const { canvas } = createMockCanvas()
    canvas.getContext.mockReturnValue(null as never)

    const mockFile = new File(['data'], 'video.mp4', { type: 'video/mp4' })
    const mockHandle = {
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const { video, emit } = createMockVideoElement(10)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return video as unknown as HTMLVideoElement
      if (tag === 'canvas') return canvas as unknown as HTMLCanvasElement
      return document.createElement(tag)
    })

    const promise = mod.extractThumbnailFromVideo(mockHandle)
    await new Promise(r => setTimeout(r, 0))

    emit('loadedmetadata')
    emit('seeked')

    await expect(promise).rejects.toThrow('Canvas context unavailable')
  })
})

// ── generateThumbnailWithGemini ─────────────────────────────────

describe('generateThumbnailWithGemini', () => {
  const fakeBase64 = btoa('fake-image-bytes')

  function makeGeminiResponse(parts: Array<Record<string, unknown>>) {
    return {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts } }],
      }),
    } as unknown as Response
  }

  it('generates a thumbnail from Gemini API response', async () => {
    const resultBlob = new Blob(['resized'], { type: 'image/jpeg' })
    const { canvas } = createMockCanvas(resultBlob)

    const mockResponse = makeGeminiResponse([
      { text: 'Here is your thumbnail' },
      { inlineData: { mimeType: 'image/png', data: fakeBase64 } },
    ])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)

    const blob = await mod.generateThumbnailWithGemini('React Basics', 'test-api-key')

    expect(blob).toBe(resultBlob)
    expect(fetch).toHaveBeenCalledOnce()
    const fetchCall = vi.mocked(fetch).mock.calls[0]
    expect(fetchCall[0]).toContain('key=test-api-key')
    expect(fetchCall[1]!.method).toBe('POST')
    expect(mockBitmap.close).toHaveBeenCalledOnce()
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')))

    await expect(mod.generateThumbnailWithGemini('Course', 'key')).rejects.toThrow(
      'Network error — check your internet connection'
    )
  })

  it('throws specific message for 401 (invalid API key)', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.generateThumbnailWithGemini('Course', 'bad-key')).rejects.toThrow(
      'Invalid Gemini API key'
    )
  })

  it('throws specific message for 403 (forbidden)', async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue('Forbidden'),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.generateThumbnailWithGemini('Course', 'bad-key')).rejects.toThrow(
      'Invalid Gemini API key'
    )
  })

  it('throws generic API error for other status codes', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.generateThumbnailWithGemini('Course', 'key')).rejects.toThrow(
      'Gemini API error 500'
    )
  })

  it('throws when response has no image part', async () => {
    const mockResponse = makeGeminiResponse([{ text: 'Sorry, I cannot generate that image.' }])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.generateThumbnailWithGemini('Course', 'key')).rejects.toThrow(
      'Gemini did not return an image'
    )
  })

  it('throws when response has no candidates', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ candidates: [] }),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.generateThumbnailWithGemini('Course', 'key')).rejects.toThrow(
      'Gemini did not return an image'
    )
  })

  it('truncates long error detail from API response', async () => {
    const longDetail = 'x'.repeat(200)
    const mockResponse = {
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue(longDetail),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    try {
      await mod.generateThumbnailWithGemini('Course', 'key')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toMatch(/Gemini API error 429/)
      // "Gemini API error 429: " (22 chars) + 120 chars = 142 chars max
      expect(msg.length).toBeLessThanOrEqual(142)
    }
  })

  it('handles error when response.text() fails', async () => {
    const mockResponse = {
      ok: false,
      status: 502,
      text: vi.fn().mockRejectedValue(new Error('body stream failed')),
    } as unknown as Response

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(mod.generateThumbnailWithGemini('Course', 'key')).rejects.toThrow(
      'Gemini API error 502'
    )
  })

  it('includes course name in the prompt', async () => {
    const resultBlob = new Blob(['resized'], { type: 'image/jpeg' })
    const { canvas } = createMockCanvas(resultBlob)

    const mockResponse = makeGeminiResponse([
      { inlineData: { mimeType: 'image/jpeg', data: fakeBase64 } },
    ])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLCanvasElement)

    await mod.generateThumbnailWithGemini('Advanced TypeScript', 'key')

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]!.body as string)
    expect(body.contents[0].parts[0].text).toContain('Advanced TypeScript')
  })
})
