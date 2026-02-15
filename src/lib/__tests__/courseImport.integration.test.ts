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

let importCourseFromFolder: (typeof import('@/lib/courseImport'))['importCourseFromFolder']
let fileSystemMocks: {
  showDirectoryPicker: ReturnType<typeof vi.fn>
  scanDirectory: ReturnType<typeof vi.fn>
  extractVideoMetadata: ReturnType<typeof vi.fn>
  extractPdfMetadata: ReturnType<typeof vi.fn>
  isSupportedVideoFormat: ReturnType<typeof vi.fn>
  getVideoFormat: ReturnType<typeof vi.fn>
}
let useCourseImportStore: (typeof import('@/stores/useCourseImportStore'))['useCourseImportStore']
let db: (typeof import('@/db'))['db']

function createMockFileHandle(name: string): FileSystemFileHandle {
  return { kind: 'file', name } as unknown as FileSystemFileHandle
}

function createMockDirHandle(name: string): FileSystemDirectoryHandle {
  return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle
}

function setupSuccessfulImport(dirName: string, files: { name: string; isVideo: boolean }[]) {
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

  const storeModule = await import('@/stores/useCourseImportStore')
  useCourseImportStore = storeModule.useCourseImportStore

  const dbModule = await import('@/db')
  db = dbModule.db

  const courseImportModule = await import('@/lib/courseImport')
  importCourseFromFolder = courseImportModule.importCourseFromFolder
})

describe('Integration: import course → verify records in IndexedDB', () => {
  it('should create course, video, and PDF records in IndexedDB after import (AC 1)', async () => {
    setupSuccessfulImport('React Patterns', [
      { name: 'intro.mp4', isVideo: true },
      { name: 'lesson-01.mp4', isVideo: true },
      { name: 'lesson-02.webm', isVideo: true },
      { name: 'workbook.pdf', isVideo: false },
    ])

    const course = await importCourseFromFolder()

    // Verify course record in IndexedDB
    const storedCourse = await db.importedCourses.get(course.id)
    expect(storedCourse).toBeDefined()
    expect(storedCourse!.name).toBe('React Patterns')
    expect(storedCourse!.videoCount).toBe(3)
    expect(storedCourse!.pdfCount).toBe(1)
    expect(storedCourse!.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // Verify video records
    const videos = await db.importedVideos.where('courseId').equals(course.id).toArray()
    expect(videos).toHaveLength(3)
    expect(videos.map(v => v.filename).sort()).toEqual([
      'intro.mp4',
      'lesson-01.mp4',
      'lesson-02.webm',
    ])
    videos.forEach(video => {
      expect(video.courseId).toBe(course.id)
      expect(video.duration).toBe(120)
      expect(video.id).toBeTruthy()
    })

    // Verify PDF records
    const pdfs = await db.importedPdfs.where('courseId').equals(course.id).toArray()
    expect(pdfs).toHaveLength(1)
    expect(pdfs[0].filename).toBe('workbook.pdf')
    expect(pdfs[0].pageCount).toBe(10)
    expect(pdfs[0].courseId).toBe(course.id)
  })

  it('should also update Zustand store after import (AC 1)', async () => {
    setupSuccessfulImport('TypeScript Course', [{ name: 'basics.mp4', isVideo: true }])

    await importCourseFromFolder()

    const state = useCourseImportStore.getState()
    expect(state.importedCourses).toHaveLength(1)
    expect(state.importedCourses[0].name).toBe('TypeScript Course')
    expect(state.isImporting).toBe(false)
    expect(state.importError).toBeNull()
  })
})

describe('Integration: import empty folder → no records, error shown (AC 2)', () => {
  it('should not create any database records for empty folders', async () => {
    const dirHandle = createMockDirHandle('Empty Folder')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {})

    await importCourseFromFolder().catch(() => {})

    const courseCount = await db.importedCourses.count()
    const videoCount = await db.importedVideos.count()
    const pdfCount = await db.importedPdfs.count()

    expect(courseCount).toBe(0)
    expect(videoCount).toBe(0)
    expect(pdfCount).toBe(0)
  })

  it('should set importError in store for empty folders', async () => {
    const dirHandle = createMockDirHandle('Empty Folder')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {})

    await importCourseFromFolder().catch(() => {})

    const state = useCourseImportStore.getState()
    expect(state.importError).toContain('No supported files found')
    expect(state.importedCourses).toHaveLength(0)
  })
})

describe('Integration: permission denied → graceful handling (AC 3)', () => {
  it('should not create records and should set error on permission denied', async () => {
    fileSystemMocks.showDirectoryPicker.mockRejectedValue(new Error('Permission denied'))

    await importCourseFromFolder().catch(() => {})

    const courseCount = await db.importedCourses.count()
    expect(courseCount).toBe(0)

    const state = useCourseImportStore.getState()
    expect(state.importError).toContain('access to your course folder')
    expect(state.isImporting).toBe(false)
  })
})

describe('Integration: import multiple courses → no conflicts', () => {
  it('should import multiple courses with unique IDs and separate records', async () => {
    // Import first course
    setupSuccessfulImport('Course A', [
      { name: 'video1.mp4', isVideo: true },
      { name: 'doc1.pdf', isVideo: false },
    ])
    const courseA = await importCourseFromFolder()

    // Import second course
    setupSuccessfulImport('Course B', [
      { name: 'video2.mp4', isVideo: true },
      { name: 'video3.mkv', isVideo: true },
    ])
    const courseB = await importCourseFromFolder()

    // Verify unique IDs
    expect(courseA.id).not.toBe(courseB.id)

    // Verify separate records
    const allCourses = await db.importedCourses.toArray()
    expect(allCourses).toHaveLength(2)

    const videosA = await db.importedVideos.where('courseId').equals(courseA.id).count()
    const videosB = await db.importedVideos.where('courseId').equals(courseB.id).count()
    expect(videosA).toBe(1)
    expect(videosB).toBe(2)

    const pdfsA = await db.importedPdfs.where('courseId').equals(courseA.id).count()
    const pdfsB = await db.importedPdfs.where('courseId').equals(courseB.id).count()
    expect(pdfsA).toBe(1)
    expect(pdfsB).toBe(0)

    // Verify Zustand store has both
    const state = useCourseImportStore.getState()
    expect(state.importedCourses).toHaveLength(2)
  })
})

describe('Integration: Zustand hydration from IndexedDB', () => {
  it('should load imported courses from IndexedDB via loadImportedCourses', async () => {
    // Import a course
    setupSuccessfulImport('Hydration Test', [{ name: 'test.mp4', isVideo: true }])
    await importCourseFromFolder()

    // Simulate fresh state (as if browser refreshed)
    useCourseImportStore.setState({
      importedCourses: [],
      isImporting: false,
      importError: null,
      importProgress: null,
    })
    expect(useCourseImportStore.getState().importedCourses).toHaveLength(0)

    // Hydrate from IndexedDB
    await useCourseImportStore.getState().loadImportedCourses()

    const state = useCourseImportStore.getState()
    expect(state.importedCourses).toHaveLength(1)
    expect(state.importedCourses[0].name).toBe('Hydration Test')
  })
})
