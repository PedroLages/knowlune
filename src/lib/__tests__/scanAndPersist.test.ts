import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Dexie from 'dexie'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock fileSystem module
vi.mock('@/lib/fileSystem', () => ({
  showDirectoryPicker: vi.fn(),
  scanDirectory: vi.fn(),
  extractVideoMetadata: vi.fn(),
  extractPdfMetadata: vi.fn(),
  isSupportedVideoFormat: vi.fn(),
  getVideoFormat: vi.fn(),
  SUPPORTED_VIDEO_EXTENSIONS: ['.mp4', '.mkv', '.avi', '.webm'],
  SUPPORTED_DOCUMENT_EXTENSIONS: ['.pdf'],
  SUPPORTED_FILE_EXTENSIONS: ['.mp4', '.mkv', '.avi', '.webm', '.pdf'],
}))

let scanCourseFolder: (typeof import('@/lib/courseImport'))['scanCourseFolder']
let persistScannedCourse: (typeof import('@/lib/courseImport'))['persistScannedCourse']
type ScannedCourse = import('@/lib/courseImport').ScannedCourse

let fileSystemMocks: {
  showDirectoryPicker: ReturnType<typeof vi.fn>
  scanDirectory: ReturnType<typeof vi.fn>
  extractVideoMetadata: ReturnType<typeof vi.fn>
  extractPdfMetadata: ReturnType<typeof vi.fn>
  isSupportedVideoFormat: ReturnType<typeof vi.fn>
  getVideoFormat: ReturnType<typeof vi.fn>
}
let toastMocks: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
let useCourseImportStore: (typeof import('@/stores/useCourseImportStore'))['useCourseImportStore']
let db: (typeof import('@/db'))['db']

function createMockFileHandle(name: string): FileSystemFileHandle {
  return { kind: 'file', name } as unknown as FileSystemFileHandle
}

function createMockDirHandle(name: string): FileSystemDirectoryHandle {
  return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const fsModule = await import('@/lib/fileSystem')
  fileSystemMocks = {
    showDirectoryPicker: fsModule.showDirectoryPicker as ReturnType<typeof vi.fn>,
    scanDirectory: fsModule.scanDirectory as ReturnType<typeof vi.fn>,
    extractVideoMetadata: fsModule.extractVideoMetadata as ReturnType<typeof vi.fn>,
    extractPdfMetadata: fsModule.extractPdfMetadata as ReturnType<typeof vi.fn>,
    isSupportedVideoFormat: fsModule.isSupportedVideoFormat as ReturnType<typeof vi.fn>,
    getVideoFormat: fsModule.getVideoFormat as ReturnType<typeof vi.fn>,
  }

  const toastModule = await import('sonner')
  toastMocks = toastModule.toast as unknown as typeof toastMocks

  const storeModule = await import('@/stores/useCourseImportStore')
  useCourseImportStore = storeModule.useCourseImportStore

  const dbModule = await import('@/db')
  db = dbModule.db

  const courseImportModule = await import('@/lib/courseImport')
  scanCourseFolder = courseImportModule.scanCourseFolder
  persistScannedCourse = courseImportModule.persistScannedCourse
})

function setupScanMocks(dirName: string, files: { name: string; isVideo: boolean }[]) {
  const dirHandle = createMockDirHandle(dirName)
  fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
  fileSystemMocks.scanDirectory.mockImplementation(async function* () {
    for (const file of files) {
      yield { handle: createMockFileHandle(file.name), path: file.name }
    }
  })
  fileSystemMocks.isSupportedVideoFormat.mockImplementation((name: string) =>
    /\.(mp4|mkv|avi|webm)$/i.test(name)
  )
  fileSystemMocks.getVideoFormat.mockImplementation((name: string) => {
    const ext = name.split('.').pop()
    return ext
  })
  fileSystemMocks.extractVideoMetadata.mockResolvedValue({
    duration: 120,
    width: 1920,
    height: 1080,
  })
  fileSystemMocks.extractPdfMetadata.mockResolvedValue({ pageCount: 10 })
}

// --- scanCourseFolder tests ---

describe('scanCourseFolder', () => {
  it('should return a ScannedCourse with videos and PDFs without persisting', async () => {
    setupScanMocks('React Patterns', [
      { name: 'lesson-01.mp4', isVideo: true },
      { name: 'workbook.pdf', isVideo: false },
    ])

    const scanned = await scanCourseFolder()

    // Verify scanned data structure
    expect(scanned.name).toBe('React Patterns')
    expect(scanned.id).toBeTruthy()
    expect(scanned.scannedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(scanned.directoryHandle).toBeDefined()
    expect(scanned.videos).toHaveLength(1)
    expect(scanned.pdfs).toHaveLength(1)

    // Verify video metadata
    expect(scanned.videos[0].filename).toBe('lesson-01.mp4')
    expect(scanned.videos[0].duration).toBe(120)
    expect(scanned.videos[0].order).toBe(1)
    expect(scanned.videos[0].id).toBeTruthy()

    // Verify PDF metadata
    expect(scanned.pdfs[0].filename).toBe('workbook.pdf')
    expect(scanned.pdfs[0].pageCount).toBe(10)
    expect(scanned.pdfs[0].id).toBeTruthy()

    // CRITICAL: Verify nothing was persisted to IndexedDB
    const courseCount = await db.importedCourses.count()
    const videoCount = await db.importedVideos.count()
    const pdfCount = await db.importedPdfs.count()
    expect(courseCount).toBe(0)
    expect(videoCount).toBe(0)
    expect(pdfCount).toBe(0)

    // Verify no toast was shown (that's persist's job)
    expect(toastMocks.success).not.toHaveBeenCalled()
  })

  it('should throw ImportError with NO_FILES for empty folders', async () => {
    const dirHandle = createMockDirHandle('Empty Folder')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {})

    await expect(scanCourseFolder()).rejects.toMatchObject({
      name: 'ImportError',
      code: 'NO_FILES',
    })
  })

  it('should throw ImportError with PERMISSION_DENIED on permission error', async () => {
    fileSystemMocks.showDirectoryPicker.mockRejectedValue(new Error('Permission denied'))

    await expect(scanCourseFolder()).rejects.toMatchObject({
      name: 'ImportError',
      code: 'PERMISSION_DENIED',
    })
  })

  it('should throw on user cancellation without error toast', async () => {
    fileSystemMocks.showDirectoryPicker.mockRejectedValue(
      new Error('Directory selection was cancelled')
    )

    await expect(scanCourseFolder()).rejects.toThrow('cancelled')
    expect(toastMocks.error).not.toHaveBeenCalled()
  })

  it('should throw ImportError with DUPLICATE when course already exists', async () => {
    // First, persist a course via the DB directly
    await db.importedCourses.add({
      id: 'existing-id',
      name: 'Already Here',
      importedAt: '2026-01-01T00:00:00.000Z',
      category: '',
      tags: [],
      status: 'active',
      videoCount: 1,
      pdfCount: 0,
      directoryHandle: createMockDirHandle('Already Here'),
    })

    const dirHandle = createMockDirHandle('Already Here')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)

    await expect(scanCourseFolder()).rejects.toMatchObject({
      name: 'ImportError',
      code: 'DUPLICATE',
    })
  })

  it('should handle partial metadata extraction failures gracefully', async () => {
    setupScanMocks('Partial Course', [
      { name: 'good.mp4', isVideo: true },
      { name: 'bad.mp4', isVideo: true },
    ])

    fileSystemMocks.extractVideoMetadata
      .mockReset()
      .mockResolvedValueOnce({ duration: 120, width: 1920, height: 1080 })
      .mockRejectedValueOnce(new Error('Corrupt file'))

    const scanned = await scanCourseFolder()

    // Should still succeed with the one valid video
    expect(scanned.videos).toHaveLength(1)
    expect(scanned.videos[0].filename).toBe('good.mp4')
  })

  it('should clear isImporting state after scan completes', async () => {
    setupScanMocks('Test Course', [{ name: 'v.mp4', isVideo: true }])

    await scanCourseFolder()

    expect(useCourseImportStore.getState().isImporting).toBe(false)
    expect(useCourseImportStore.getState().importProgress).toBeNull()
  })

  it('should clear isImporting state even after scan fails', async () => {
    fileSystemMocks.showDirectoryPicker.mockRejectedValue(new Error('Permission denied'))

    await scanCourseFolder().catch(() => {})

    expect(useCourseImportStore.getState().isImporting).toBe(false)
  })
})

// --- persistScannedCourse tests ---

describe('persistScannedCourse', () => {
  function createScannedCourse(overrides?: Partial<ScannedCourse>): ScannedCourse {
    return {
      id: 'test-course-id',
      name: 'TypeScript Deep Dive',
      scannedAt: '2026-03-25T10:00:00.000Z',
      directoryHandle: createMockDirHandle('TypeScript Deep Dive'),
      videos: [
        {
          id: 'video-1',
          filename: 'intro.mp4',
          path: 'intro.mp4',
          duration: 120,
          format: 'mp4',
          order: 1,
          fileHandle: createMockFileHandle('intro.mp4'),
        },
      ],
      pdfs: [
        {
          id: 'pdf-1',
          filename: 'workbook.pdf',
          path: 'workbook.pdf',
          pageCount: 25,
          fileHandle: createMockFileHandle('workbook.pdf'),
        },
      ],
      ...overrides,
    }
  }

  it('should persist course, videos, and PDFs to IndexedDB', async () => {
    const scanned = createScannedCourse()
    const course = await persistScannedCourse(scanned)

    // Verify course in DB
    const storedCourse = await db.importedCourses.get(course.id)
    expect(storedCourse).toBeDefined()
    expect(storedCourse!.name).toBe('TypeScript Deep Dive')
    expect(storedCourse!.videoCount).toBe(1)
    expect(storedCourse!.pdfCount).toBe(1)
    expect(storedCourse!.status).toBe('active')

    // Verify video in DB
    const videos = await db.importedVideos.where('courseId').equals(course.id).toArray()
    expect(videos).toHaveLength(1)
    expect(videos[0].filename).toBe('intro.mp4')
    expect(videos[0].duration).toBe(120)

    // Verify PDF in DB
    const pdfs = await db.importedPdfs.where('courseId').equals(course.id).toArray()
    expect(pdfs).toHaveLength(1)
    expect(pdfs[0].filename).toBe('workbook.pdf')
    expect(pdfs[0].pageCount).toBe(25)
  })

  it('should update Zustand store after persistence', async () => {
    const scanned = createScannedCourse()
    await persistScannedCourse(scanned)

    const state = useCourseImportStore.getState()
    expect(state.importedCourses).toHaveLength(1)
    expect(state.importedCourses[0].name).toBe('TypeScript Deep Dive')
  })

  it('should show success toast after persistence', async () => {
    const scanned = createScannedCourse()
    await persistScannedCourse(scanned)

    expect(toastMocks.success).toHaveBeenCalledWith(
      'Imported: TypeScript Deep Dive — 1 video, 1 PDF'
    )
  })

  it('should use the scanned course ID for all records', async () => {
    const scanned = createScannedCourse({ id: 'stable-id-123' })
    const course = await persistScannedCourse(scanned)

    expect(course.id).toBe('stable-id-123')

    const videos = await db.importedVideos.where('courseId').equals('stable-id-123').toArray()
    expect(videos).toHaveLength(1)
  })

  it('should apply name override from wizard', async () => {
    const scanned = createScannedCourse()
    const course = await persistScannedCourse(scanned, {
      name: 'Custom Course Name',
    })

    expect(course.name).toBe('Custom Course Name')
    const storedCourse = await db.importedCourses.get(course.id)
    expect(storedCourse!.name).toBe('Custom Course Name')
  })

  it('should apply category and tags overrides from wizard', async () => {
    const scanned = createScannedCourse()
    const course = await persistScannedCourse(scanned, {
      category: 'research-library',
      tags: ['typescript', 'advanced'],
    })

    expect(course.category).toBe('research-library')
    expect(course.tags).toEqual(['typescript', 'advanced'])
  })

  it('should default category to empty string and tags to empty array when no overrides', async () => {
    const scanned = createScannedCourse()
    const course = await persistScannedCourse(scanned)

    expect(course.category).toBe('')
    expect(course.tags).toEqual([])
  })

  it('should handle course with only videos', async () => {
    const scanned = createScannedCourse({ pdfs: [] })
    const course = await persistScannedCourse(scanned)

    expect(course.videoCount).toBe(1)
    expect(course.pdfCount).toBe(0)
    expect(toastMocks.success).toHaveBeenCalledWith(
      'Imported: TypeScript Deep Dive — 1 video, 0 PDFs'
    )
  })

  it('should handle course with only PDFs', async () => {
    const scanned = createScannedCourse({ videos: [] })
    const course = await persistScannedCourse(scanned)

    expect(course.videoCount).toBe(0)
    expect(course.pdfCount).toBe(1)
    expect(toastMocks.success).toHaveBeenCalledWith(
      'Imported: TypeScript Deep Dive — 0 videos, 1 PDF'
    )
  })
})

// --- Integration: scan then persist ---

describe('scanCourseFolder → persistScannedCourse integration', () => {
  it('should produce identical results to importCourseFromFolder', async () => {
    setupScanMocks('Integration Test', [
      { name: 'lesson.mp4', isVideo: true },
      { name: 'notes.pdf', isVideo: false },
    ])

    // Scan phase
    const scanned = await scanCourseFolder()
    expect(scanned.videos).toHaveLength(1)
    expect(scanned.pdfs).toHaveLength(1)

    // Persist phase
    const course = await persistScannedCourse(scanned)

    // Verify end result matches what importCourseFromFolder would produce
    expect(course.name).toBe('Integration Test')
    expect(course.videoCount).toBe(1)
    expect(course.pdfCount).toBe(1)
    expect(course.status).toBe('active')
    expect(course.id).toBe(scanned.id)

    // Verify DB records
    const storedCourse = await db.importedCourses.get(course.id)
    expect(storedCourse).toBeDefined()

    const videos = await db.importedVideos.where('courseId').equals(course.id).toArray()
    expect(videos).toHaveLength(1)

    const pdfs = await db.importedPdfs.where('courseId').equals(course.id).toArray()
    expect(pdfs).toHaveLength(1)
  })
})
