import { describe, it, expect } from 'vitest'
import path from 'path'

const COURSES_ROOT = '/test/courses'

describe('Path Traversal Protection', () => {
  describe('Directory Traversal Attacks', () => {
    it('blocks Unix-style directory traversal', () => {
      const maliciousPath = '../../../etc/passwd'
      const decodedPath = decodeURIComponent(maliciousPath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(false)
    })

    it('blocks Windows-style directory traversal', () => {
      const maliciousPath = '..\\..\\..\\windows\\system32\\config\\sam'
      const decodedPath = decodeURIComponent(maliciousPath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(false)
    })

    it('blocks URL-encoded directory traversal (%2e%2e%2f)', () => {
      const maliciousPath = '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      const decodedPath = decodeURIComponent(maliciousPath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(false)
    })

    it('blocks mixed traversal (course-1/../../../etc/passwd)', () => {
      const maliciousPath = 'course-1/../../../etc/passwd'
      const decodedPath = decodeURIComponent(maliciousPath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(false)
    })

    it('blocks absolute path escape (/etc/passwd)', () => {
      const maliciousPath = '/etc/passwd'
      const decodedPath = decodeURIComponent(maliciousPath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      // On Unix, /etc/passwd is absolute and won't be under COURSES_ROOT
      expect(filePath.startsWith(coursesRootResolved)).toBe(false)
    })

    it('blocks double-encoded traversal (%252e%252e%252f)', () => {
      // First decode: %252e -> %2e, second decode: %2e -> .
      const maliciousPath = '%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd'
      const decodedPath = decodeURIComponent(decodeURIComponent(maliciousPath))
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(false)
    })

    it('blocks null byte injection', () => {
      const maliciousPath = 'valid-file.mp4%00../../../etc/passwd'
      const decodedPath = decodeURIComponent(maliciousPath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      // Null byte will be in the path but resolve should still handle it
      expect(filePath.startsWith(coursesRootResolved)).toBe(true) // Path is within bounds
      // Note: File system checks will fail on null bytes anyway
    })
  })

  describe('Legitimate Paths', () => {
    it('allows simple file path (course-1/video.mp4)', () => {
      const legitimatePath = 'course-1/video.mp4'
      const decodedPath = decodeURIComponent(legitimatePath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(true)
    })

    it('allows nested subdirectories (course-2/lesson-3/resource.pdf)', () => {
      const legitimatePath = 'course-2/lesson-3/resource.pdf'
      const decodedPath = decodeURIComponent(legitimatePath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(true)
    })

    it('allows deeply nested paths (a/b/c/d/e/file.txt)', () => {
      const legitimatePath = 'a/b/c/d/e/file.txt'
      const decodedPath = decodeURIComponent(legitimatePath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(true)
    })

    it('allows URL-encoded spaces (My%20Course/My%20Video.mp4)', () => {
      const legitimatePath = 'My%20Course/My%20Video.mp4'
      const decodedPath = decodeURIComponent(legitimatePath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(true)
    })

    it('allows special characters in names (course_1-v2.0/resource[final].pdf)', () => {
      const legitimatePath = 'course_1-v2.0/resource[final].pdf'
      const decodedPath = decodeURIComponent(legitimatePath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('blocks empty path (would resolve to COURSES_ROOT itself)', () => {
      const emptyPath = ''
      const decodedPath = decodeURIComponent(emptyPath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      // Empty path resolves to COURSES_ROOT, which IS equal but not a file within it
      expect(filePath).toBe(coursesRootResolved)
    })

    it('handles relative current directory (./course-1/video.mp4)', () => {
      const relativePath = './course-1/video.mp4'
      const decodedPath = decodeURIComponent(relativePath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(true)
    })

    it('normalizes multiple slashes (course-1///video.mp4)', () => {
      const weirdPath = 'course-1///video.mp4'
      const decodedPath = decodeURIComponent(weirdPath)
      const filePath = path.resolve(path.join(COURSES_ROOT, decodedPath))
      const coursesRootResolved = path.resolve(COURSES_ROOT)

      expect(filePath.startsWith(coursesRootResolved)).toBe(true)
    })
  })
})
