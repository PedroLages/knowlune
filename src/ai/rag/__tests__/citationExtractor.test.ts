import { describe, it, expect } from 'vitest'
import { CitationExtractor } from '../citationExtractor'
import type { RetrievedContext } from '../types'

describe('CitationExtractor', () => {
  const extractor = new CitationExtractor()

  const mockNotes: RetrievedContext['notes'] = [
    {
      noteId: 'note-1',
      content: 'React hooks are functions that let you use state and other React features',
      videoId: 'video-1',
      videoFilename: 'intro-to-react.mp4',
      courseName: 'React Basics',
      score: 0.95,
    },
    {
      noteId: 'note-2',
      content: 'useState is the most commonly used hook for managing state',
      videoId: 'video-1',
      videoFilename: 'intro-to-react.mp4',
      courseName: 'React Basics',
      score: 0.9,
    },
    {
      noteId: 'note-3',
      content: 'useEffect handles side effects in functional components',
      videoId: 'video-2',
      videoFilename: 'advanced-hooks.mp4',
      courseName: 'Advanced React',
      score: 0.88,
    },
  ]

  describe('extract', () => {
    it('should extract single citation [1]', () => {
      const response = 'React hooks are useful [1].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(1)
      expect(citations.get(1)).toEqual({
        noteId: 'note-1',
        videoId: 'video-1',
        videoFilename: 'intro-to-react.mp4',
        courseId: '',
        courseName: 'React Basics',
      })
    })

    it('should extract multiple citations [1], [2]', () => {
      const response = 'Hooks [1] and state [2] are key concepts.'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(2)
      expect(citations.has(1)).toBe(true)
      expect(citations.has(2)).toBe(true)
      expect(citations.get(1)?.noteId).toBe('note-1')
      expect(citations.get(2)?.noteId).toBe('note-2')
    })

    it('should extract all three citations [1], [2], [3]', () => {
      const response = 'Use hooks [1] with state [2] and effects [3].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(3)
      expect(citations.get(1)?.noteId).toBe('note-1')
      expect(citations.get(2)?.noteId).toBe('note-2')
      expect(citations.get(3)?.noteId).toBe('note-3')
    })

    it('should ignore out-of-bounds citations [99]', () => {
      const response = 'Invalid citation [99].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(0)
    })

    it('should ignore citations beyond notes array length', () => {
      const response = 'Valid [1] [2] but invalid [4] [5].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(2) // Only [1] and [2]
      expect(citations.has(1)).toBe(true)
      expect(citations.has(2)).toBe(true)
      expect(citations.has(4)).toBe(false)
      expect(citations.has(5)).toBe(false)
    })

    it('should handle duplicate citations [1] [1]', () => {
      const response = 'First reference [1] and again [1] later.'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(1) // Deduplicated
      expect(citations.get(1)?.noteId).toBe('note-1')
    })

    it('should return empty Map for no citations', () => {
      const response = 'No citations in this response at all.'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(0)
    })

    it('should handle empty response string', () => {
      const response = ''
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(0)
    })

    it('should handle empty notes array', () => {
      const response = 'Citation [1] present but no notes.'
      const citations = extractor.extract(response, [])

      expect(citations.size).toBe(0)
    })

    it('should handle non-sequential citation numbers', () => {
      const response = 'Citing [1] and [3] only.'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(2)
      expect(citations.has(1)).toBe(true)
      expect(citations.has(2)).toBe(false)
      expect(citations.has(3)).toBe(true)
    })

    it('should handle citations at various positions', () => {
      const response = '[1] At start, in middle [2], and at end [3]'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(3)
    })

    it('should handle citations in same sentence', () => {
      const response = 'Multiple [1][2][3] citations together.'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(3)
    })

    it('should preserve note metadata correctly', () => {
      const response = 'Reference to advanced hooks [3].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(1)
      const citation = citations.get(3)
      expect(citation).toEqual({
        noteId: 'note-3',
        videoId: 'video-2',
        videoFilename: 'advanced-hooks.mp4',
        courseId: '',
        courseName: 'Advanced React',
      })
      // Should NOT include content or score
      expect(citation).not.toHaveProperty('content')
      expect(citation).not.toHaveProperty('score')
    })
  })

  describe('validateCitations', () => {
    it('should return true for valid citations', () => {
      const response = 'Valid citations [1] and [2].'
      const isValid = extractor.validateCitations(response, mockNotes)

      expect(isValid).toBe(true)
    })

    it('should return false for out-of-bounds citations', () => {
      const response = 'Invalid citation [99].'
      const isValid = extractor.validateCitations(response, mockNotes)

      expect(isValid).toBe(false)
    })

    it('should return true for no citations', () => {
      const response = 'No citations here.'
      const isValid = extractor.validateCitations(response, mockNotes)

      expect(isValid).toBe(true)
    })

    it('should return false if any citation is invalid', () => {
      const response = 'Mixed: valid [1] and invalid [10].'
      const isValid = extractor.validateCitations(response, mockNotes)

      expect(isValid).toBe(false)
    })

    it('should return true for all valid citations', () => {
      const response = 'All valid [1] [2] [3].'
      const isValid = extractor.validateCitations(response, mockNotes)

      expect(isValid).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle malformed citation markers', () => {
      const response = 'Malformed [ 1 ] or [a] or [1a].'
      const citations = extractor.extract(response, mockNotes)

      // Regex only matches [1], not [ 1 ], [a], or [1a]
      expect(citations.size).toBe(0)
    })

    it('should handle citation [0] as invalid', () => {
      const response = 'Zero citation [0].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(0) // [0] is out of bounds (1-indexed)
    })

    it('should handle negative citations [-1]', () => {
      const response = 'Negative [-1].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(0) // Regex doesn't match negative numbers
    })

    it('should handle very large citation numbers', () => {
      const response = 'Large citation [999999].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(0)
    })

    it('should handle mixed valid and invalid together [1][99]', () => {
      const response = 'Mixed [1][99][2].'
      const citations = extractor.extract(response, mockNotes)

      expect(citations.size).toBe(2) // Only [1] and [2]
      expect(citations.has(1)).toBe(true)
      expect(citations.has(2)).toBe(true)
      expect(citations.has(99)).toBe(false)
    })
  })
})
