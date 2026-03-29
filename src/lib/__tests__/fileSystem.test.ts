import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isSupportedVideoFormat,
  isSupportedFile,
  getVideoFormat,
  getFileExtension,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_FILE_EXTENSIONS,
  scanDirectory,
  extractVideoMetadata,
  extractPdfMetadata,
} from '@/lib/fileSystem'

// Mock pdfjs-dist for extractPdfMetadata tests
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({ numPages: 42 }),
  })),
}))

describe('constants', () => {
  it('should define supported video extensions', () => {
    expect(SUPPORTED_VIDEO_EXTENSIONS).toEqual(['.mp4', '.mkv', '.avi', '.webm', '.ts'])
  })

  it('should define supported document extensions', () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toEqual(['.pdf'])
  })

  it('should combine all supported extensions', () => {
    expect(SUPPORTED_FILE_EXTENSIONS).toEqual(['.mp4', '.mkv', '.avi', '.webm', '.ts', '.pdf'])
  })
})

describe('isSupportedVideoFormat', () => {
  it('should return true for supported video formats', () => {
    expect(isSupportedVideoFormat('video.mp4')).toBe(true)
    expect(isSupportedVideoFormat('video.mkv')).toBe(true)
    expect(isSupportedVideoFormat('video.avi')).toBe(true)
    expect(isSupportedVideoFormat('video.webm')).toBe(true)
    expect(isSupportedVideoFormat('video.ts')).toBe(true)
  })

  it('should be case-insensitive', () => {
    expect(isSupportedVideoFormat('video.MP4')).toBe(true)
    expect(isSupportedVideoFormat('video.MKV')).toBe(true)
    expect(isSupportedVideoFormat('video.Avi')).toBe(true)
    expect(isSupportedVideoFormat('video.WEBM')).toBe(true)
  })

  it('should return false for unsupported formats', () => {
    expect(isSupportedVideoFormat('video.mov')).toBe(false)
    expect(isSupportedVideoFormat('video.flv')).toBe(false)
    expect(isSupportedVideoFormat('document.pdf')).toBe(false)
    expect(isSupportedVideoFormat('image.png')).toBe(false)
  })

  it('should return false for files without extension', () => {
    expect(isSupportedVideoFormat('noextension')).toBe(false)
  })
})

describe('isSupportedFile', () => {
  it('should return true for video files', () => {
    expect(isSupportedFile('lesson.mp4')).toBe(true)
    expect(isSupportedFile('lesson.webm')).toBe(true)
  })

  it('should return true for PDF files', () => {
    expect(isSupportedFile('workbook.pdf')).toBe(true)
    expect(isSupportedFile('MANUAL.PDF')).toBe(true)
  })

  it('should return false for unsupported files', () => {
    expect(isSupportedFile('image.png')).toBe(false)
    expect(isSupportedFile('readme.txt')).toBe(false)
    expect(isSupportedFile('data.json')).toBe(false)
  })
})

describe('getVideoFormat', () => {
  it('should extract video format from filename', () => {
    expect(getVideoFormat('video.mp4')).toBe('mp4')
    expect(getVideoFormat('video.mkv')).toBe('mkv')
    expect(getVideoFormat('video.avi')).toBe('avi')
    expect(getVideoFormat('video.webm')).toBe('webm')
  })

  it('should handle uppercase extensions', () => {
    expect(getVideoFormat('video.MP4')).toBe('mp4')
  })
})

describe('getFileExtension', () => {
  it('should return lowercase extension with dot', () => {
    expect(getFileExtension('file.MP4')).toBe('.mp4')
    expect(getFileExtension('file.pdf')).toBe('.pdf')
  })
})

describe('scanDirectory', () => {
  function createMockFileHandle(name: string): FileSystemFileHandle {
    return {
      kind: 'file' as const,
      name,
      getFile: vi.fn(),
      createWritable: vi.fn(),
      isSameEntry: vi.fn(),
      queryPermission: vi.fn(),
      requestPermission: vi.fn(),
    } as unknown as FileSystemFileHandle
  }

  function createMockDirectoryHandle(
    name: string,
    entries: (FileSystemFileHandle | FileSystemDirectoryHandle)[]
  ): FileSystemDirectoryHandle {
    return {
      kind: 'directory' as const,
      name,
      values: vi.fn().mockImplementation(function* () {
        yield* entries
      }),
      getFileHandle: vi.fn(),
      getDirectoryHandle: vi.fn(),
      removeEntry: vi.fn(),
      resolve: vi.fn(),
      isSameEntry: vi.fn(),
      queryPermission: vi.fn(),
      requestPermission: vi.fn(),
    } as unknown as FileSystemDirectoryHandle
  }

  it('should yield supported files from a flat directory', async () => {
    const mp4 = createMockFileHandle('lesson.mp4')
    const pdf = createMockFileHandle('workbook.pdf')
    const txt = createMockFileHandle('readme.txt')

    const dirHandle = createMockDirectoryHandle('course', [mp4, pdf, txt])

    const results: { handle: FileSystemFileHandle; path: string }[] = []
    for await (const entry of scanDirectory(dirHandle)) {
      results.push(entry)
    }

    expect(results).toHaveLength(2)
    expect(results[0].handle.name).toBe('lesson.mp4')
    expect(results[0].path).toBe('lesson.mp4')
    expect(results[1].handle.name).toBe('workbook.pdf')
  })

  it('should scan subdirectories recursively', async () => {
    const video1 = createMockFileHandle('intro.mp4')
    const video2 = createMockFileHandle('lesson1.mp4')
    const subDir = createMockDirectoryHandle('module-1', [video2])
    const rootDir = createMockDirectoryHandle('course', [video1, subDir])

    const results: { handle: FileSystemFileHandle; path: string }[] = []
    for await (const entry of scanDirectory(rootDir)) {
      results.push(entry)
    }

    expect(results).toHaveLength(2)
    expect(results[0].path).toBe('intro.mp4')
    expect(results[1].path).toBe('module-1/lesson1.mp4')
  })

  it('should handle empty directories', async () => {
    const dirHandle = createMockDirectoryHandle('empty', [])

    const results: { handle: FileSystemFileHandle; path: string }[] = []
    for await (const entry of scanDirectory(dirHandle)) {
      results.push(entry)
    }

    expect(results).toHaveLength(0)
  })

  it('should filter out unsupported file types', async () => {
    const png = createMockFileHandle('image.png')
    const doc = createMockFileHandle('notes.doc')
    const mp4 = createMockFileHandle('video.mp4')

    const dirHandle = createMockDirectoryHandle('mixed', [png, doc, mp4])

    const results: { handle: FileSystemFileHandle; path: string }[] = []
    for await (const entry of scanDirectory(dirHandle)) {
      results.push(entry)
    }

    expect(results).toHaveLength(1)
    expect(results[0].handle.name).toBe('video.mp4')
  })
})

describe('extractVideoMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should extract duration, width, and height from video file', async () => {
    const mockFile = new File([''], 'test.mp4', { type: 'video/mp4' })
    const mockHandle = {
      kind: 'file',
      name: 'test.mp4',
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const mockVideo: Record<string, unknown> = {
      preload: '',
      duration: 125.5,
      videoWidth: 1920,
      videoHeight: 1080,
      onloadedmetadata: null,
      onerror: null,
      remove: vi.fn(),
    }
    Object.defineProperty(mockVideo, 'src', {
      set() {
        queueMicrotask(() => (mockVideo.onloadedmetadata as () => void)?.())
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    const result = await extractVideoMetadata(mockHandle)

    expect(result).toEqual({ duration: 125.5, width: 1920, height: 1080, fileSize: 0 })
    expect(URL.createObjectURL).toHaveBeenCalledWith(mockFile)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    expect(mockVideo.remove).toHaveBeenCalled()
  })

  it('should reject and cleanup blob URL on video load error', async () => {
    const mockFile = new File([''], 'corrupt.mp4', { type: 'video/mp4' })
    const mockHandle = {
      kind: 'file',
      name: 'corrupt.mp4',
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const mockVideo: Record<string, unknown> = {
      preload: '',
      onloadedmetadata: null,
      onerror: null,
      remove: vi.fn(),
    }
    Object.defineProperty(mockVideo, 'src', {
      set() {
        queueMicrotask(() => (mockVideo.onerror as () => void)?.())
      },
    })
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as unknown as HTMLElement)

    await expect(extractVideoMetadata(mockHandle)).rejects.toThrow(
      'Cannot read metadata: corrupt.mp4'
    )
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url')
    expect(mockVideo.remove).toHaveBeenCalled()
  })
})

describe('extractPdfMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should extract page count from PDF file using pdfjs-dist', async () => {
    const mockArrayBuffer = new ArrayBuffer(100)
    const mockFile = {
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    }
    const mockHandle = {
      kind: 'file',
      name: 'workbook.pdf',
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle

    const result = await extractPdfMetadata(mockHandle)

    expect(result).toEqual({ pageCount: 42 })
    expect(mockFile.arrayBuffer).toHaveBeenCalled()
  })
})
