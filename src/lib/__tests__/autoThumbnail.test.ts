import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExtractThumbnail, mockSaveThumbnail, mockGetState, mockSetState } = vi.hoisted(() => ({
  mockExtractThumbnail: vi.fn(),
  mockSaveThumbnail: vi.fn(),
  mockGetState: vi.fn(() => ({ thumbnailUrls: {} })),
  mockSetState: vi.fn(),
}))

vi.mock('@/lib/thumbnailService', () => ({
  extractThumbnailFromVideo: mockExtractThumbnail,
  saveCourseThumbnail: mockSaveThumbnail,
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: {
    getState: mockGetState,
    setState: mockSetState,
  },
}))

import { autoGenerateThumbnail } from '../autoThumbnail'

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
