import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportedPdf } from '@/data/types'
import { releasePdfSource, resolvePdfSource } from '@/lib/pdfSource'

const BASE_PDF: ImportedPdf = {
  id: 'pdf-1',
  courseId: 'course-1',
  filename: 'lesson.pdf',
  path: '/lesson.pdf',
  pageCount: 2,
  fileHandle: null,
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-source')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
})

describe('resolvePdfSource', () => {
  it('uses a server URL without creating an object URL', async () => {
    const result = await resolvePdfSource({
      ...BASE_PDF,
      serverUrl: 'https://courses.example/lesson.pdf',
    })

    expect(result).toEqual({
      status: 'ready',
      url: 'https://courses.example/lesson.pdf',
      kind: 'server',
      revokeOnRelease: false,
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('creates a releasable object URL for a stored blob', async () => {
    const result = await resolvePdfSource({
      ...BASE_PDF,
      fileBlob: new Blob(['pdf'], { type: 'application/pdf' }),
    })

    expect(result).toMatchObject({ status: 'ready', kind: 'blob', revokeOnRelease: true })
    if (result.status === 'ready') releasePdfSource(result)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-source')
  })

  it('reads a granted file handle', async () => {
    const getFile = vi.fn().mockResolvedValue(new File(['pdf'], 'lesson.pdf'))
    const fileHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn(),
      getFile,
    } as unknown as FileSystemFileHandle

    const result = await resolvePdfSource({ ...BASE_PDF, fileHandle })

    expect(result).toMatchObject({ status: 'ready', kind: 'file-handle' })
    expect(getFile).toHaveBeenCalledTimes(1)
    expect(fileHandle.requestPermission).not.toHaveBeenCalled()
  })

  it('returns permission-denied until permission is explicitly requested', async () => {
    const fileHandle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFile: vi.fn().mockResolvedValue(new File(['pdf'], 'lesson.pdf')),
    } as unknown as FileSystemFileHandle

    await expect(resolvePdfSource({ ...BASE_PDF, fileHandle })).resolves.toMatchObject({
      status: 'permission-denied',
    })
    expect(fileHandle.requestPermission).not.toHaveBeenCalled()

    await expect(
      resolvePdfSource({ ...BASE_PDF, fileHandle }, { requestPermission: true })
    ).resolves.toMatchObject({ status: 'ready' })
    expect(fileHandle.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('returns not-found when the PDF has no usable source', async () => {
    await expect(resolvePdfSource(BASE_PDF)).resolves.toEqual({
      status: 'not-found',
      reason: 'The PDF file is not available on this device.',
    })
  })
})
