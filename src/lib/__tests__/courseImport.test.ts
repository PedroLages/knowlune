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
  isImageFile: vi.fn(),
  SUPPORTED_VIDEO_EXTENSIONS: ['.mp4', '.mkv', '.avi', '.webm'],
  SUPPORTED_DOCUMENT_EXTENSIONS: ['.pdf'],
  SUPPORTED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  SUPPORTED_FILE_EXTENSIONS: ['.mp4', '.mkv', '.avi', '.webm', '.pdf'],
}))

let importCourseFromFolder: (typeof import('@/lib/courseImport'))['importCourseFromFolder']
let ImportError: (typeof import('@/lib/courseImport'))['ImportError']
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

// Create serializable mock handles (no function properties)
// In real browsers, FileSystemFileHandle is structured-cloneable.
// fake-indexeddb uses structuredClone which rejects functions.
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

  const courseImportModule = await import('@/lib/courseImport')
  importCourseFromFolder = courseImportModule.importCourseFromFolder
  ImportError = courseImportModule.ImportError
})

describe('importCourseFromFolder', () => {
  it('should import a course with videos and PDFs successfully', async () => {
    const dirHandle = createMockDirHandle('React Patterns')
    const videoHandle = createMockFileHandle('lesson-01.mp4')
    const pdfHandle = createMockFileHandle('workbook.pdf')

    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {
      yield { handle: videoHandle, path: 'lesson-01.mp4' }
      yield { handle: pdfHandle, path: 'workbook.pdf' }
    })
    fileSystemMocks.isSupportedVideoFormat.mockImplementation((name: string) =>
      name.endsWith('.mp4')
    )
    fileSystemMocks.getVideoFormat.mockReturnValue('mp4')
    fileSystemMocks.extractVideoMetadata.mockResolvedValue({
      duration: 120,
      width: 1920,
      height: 1080,
    })
    fileSystemMocks.extractPdfMetadata.mockResolvedValue({ pageCount: 25 })

    const course = await importCourseFromFolder()

    expect(course.name).toBe('React Patterns')
    expect(course.videoCount).toBe(1)
    expect(course.pdfCount).toBe(1)
    expect(course.id).toBeTruthy()
    expect(course.importedAt).toBeTruthy()
    expect(course.status).toBe('active') // AC-3: Default status on import
    expect(toastMocks.success).toHaveBeenCalledWith('Imported: React Patterns — 1 video, 1 PDF')
  })

  it('should throw ImportError with NO_FILES code for empty folders (AC 2)', async () => {
    const dirHandle = createMockDirHandle('Empty Folder')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {
      // yield nothing
    })

    const result = importCourseFromFolder()
    await expect(result).rejects.toThrow('No supported files found')

    // Verify the error is typed correctly with a second invocation
    await expect(importCourseFromFolder()).rejects.toMatchObject({
      name: 'ImportError',
      code: 'NO_FILES',
    })
  })

  it('should show error toast for empty folders (AC 2)', async () => {
    const dirHandle = createMockDirHandle('Empty Folder')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {})

    await importCourseFromFolder().catch(() => {})

    expect(toastMocks.error).toHaveBeenCalledWith(
      'No supported files found. Please select a folder containing video (MP4, MKV, AVI, WEBM) or PDF files.'
    )
  })

  it('should handle permission denied gracefully (AC 3)', async () => {
    fileSystemMocks.showDirectoryPicker.mockRejectedValue(new Error('Permission denied'))

    await expect(importCourseFromFolder()).rejects.toThrow()

    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('access to your course folder'),
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Try Again' }),
      })
    )
  })

  it('should handle user cancellation without showing error', async () => {
    fileSystemMocks.showDirectoryPicker.mockRejectedValue(
      new Error('Directory selection was cancelled')
    )

    await expect(importCourseFromFolder()).rejects.toThrow('cancelled')

    // Should NOT show error toast for cancellation
    expect(toastMocks.error).not.toHaveBeenCalled()
  })

  it('should set isImporting during import and clear it after', async () => {
    const dirHandle = createMockDirHandle('Course')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {
      yield { handle: createMockFileHandle('v.mp4'), path: 'v.mp4' }
    })
    fileSystemMocks.isSupportedVideoFormat.mockReturnValue(true)
    fileSystemMocks.getVideoFormat.mockReturnValue('mp4')
    fileSystemMocks.extractVideoMetadata.mockResolvedValue({
      duration: 60,
      width: 1280,
      height: 720,
    })

    await importCourseFromFolder()

    // After completion, isImporting should be false
    expect(useCourseImportStore.getState().isImporting).toBe(false)
    expect(useCourseImportStore.getState().importProgress).toBeNull()
  })

  it('should persist course records to IndexedDB', async () => {
    const dirHandle = createMockDirHandle('Persisted Course')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {
      yield { handle: createMockFileHandle('vid.mp4'), path: 'vid.mp4' }
    })
    fileSystemMocks.isSupportedVideoFormat.mockReturnValue(true)
    fileSystemMocks.getVideoFormat.mockReturnValue('mp4')
    fileSystemMocks.extractVideoMetadata.mockResolvedValue({
      duration: 90,
      width: 1920,
      height: 1080,
    })

    const course = await importCourseFromFolder()

    const { db } = await import('@/db')
    const storedCourse = await db.importedCourses.get(course.id)
    expect(storedCourse).toBeDefined()
    expect(storedCourse!.name).toBe('Persisted Course')

    const storedVideos = await db.importedVideos.where('courseId').equals(course.id).toArray()
    expect(storedVideos).toHaveLength(1)
  })

  it('should handle partial metadata extraction failures gracefully', async () => {
    const dirHandle = createMockDirHandle('Partial Course')
    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {
      yield { handle: createMockFileHandle('good.mp4'), path: 'good.mp4' }
      yield { handle: createMockFileHandle('bad.mp4'), path: 'bad.mp4' }
    })
    fileSystemMocks.isSupportedVideoFormat.mockReturnValue(true)
    fileSystemMocks.getVideoFormat.mockReturnValue('mp4')

    fileSystemMocks.extractVideoMetadata
      .mockResolvedValueOnce({ duration: 120, width: 1920, height: 1080 })
      .mockRejectedValueOnce(new Error('Corrupt file'))

    const course = await importCourseFromFolder()

    // Should still succeed with the one valid video
    expect(course.videoCount).toBe(1)
    expect(toastMocks.success).toHaveBeenCalled()
  })
})

describe('ImportError', () => {
  it('should have correct name and code', () => {
    const error = new ImportError('test message', 'NO_FILES')
    expect(error.name).toBe('ImportError')
    expect(error.code).toBe('NO_FILES')
    expect(error.message).toBe('test message')
    expect(error).toBeInstanceOf(Error)
  })
})
