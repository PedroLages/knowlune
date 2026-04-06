import { describe, it, expect } from 'vitest'
import { getResourceUrl, filePathToUrl, getVideoUrl, getPdfUrl, COURSES_ROOT, MEDIA_BASE } from '../media'

describe('media', () => {
  it('exports COURSES_ROOT constant', () => {
    expect(typeof COURSES_ROOT).toBe('string')
  })

  it('exports MEDIA_BASE as /media', () => {
    expect(MEDIA_BASE).toBe('/media')
  })

  describe('filePathToUrl', () => {
    it('converts absolute file path to media URL', () => {
      const url = filePathToUrl(`${COURSES_ROOT}/Module 1/video.mp4`)
      expect(url).toBe('/media/Module 1/video.mp4')
    })

    it('handles paths without COURSES_ROOT prefix', () => {
      const url = filePathToUrl('/other/path/file.pdf')
      expect(url).toBe('/media/other/path/file.pdf')
    })
  })

  describe('getVideoUrl', () => {
    it('delegates to filePathToUrl', () => {
      const url = getVideoUrl(`${COURSES_ROOT}/video.mp4`)
      expect(url).toBe('/media/video.mp4')
    })
  })

  describe('getPdfUrl', () => {
    it('delegates to filePathToUrl', () => {
      const url = getPdfUrl(`${COURSES_ROOT}/doc.pdf`)
      expect(url).toBe('/media/doc.pdf')
    })
  })

  describe('getResourceUrl', () => {
    it('extracts URL from resource filePath', () => {
      const resource = { filePath: `${COURSES_ROOT}/Module 1/lesson.mp4` }
      const url = getResourceUrl(resource as { filePath: string })
      expect(url).toBe('/media/Module 1/lesson.mp4')
    })
  })
})
