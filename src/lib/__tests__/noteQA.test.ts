/**
 * Tests for Q&A from Notes RAG Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { retrieveRelevantNotes, extractCitations } from '../noteQA'
import type { RetrievedNote } from '../noteQA'
import type { Note } from '@/data/types'

// Mock dependencies
vi.mock('@/ai/workers/coordinator')
vi.mock('@/db')
vi.mock('@/lib/vectorSearch')

describe('noteQA', () => {
  describe('extractCitations', () => {
    const mockNotes: RetrievedNote[] = [
      {
        note: {
          id: 'note-1',
          courseId: '001',
          videoId: '001-001',
          content: 'React hooks info',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          tags: [],
        } as Note,
        similarity: 0.9,
      },
      {
        note: {
          id: 'note-2',
          courseId: '002',
          videoId: '002-001',
          content: 'TypeScript info',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          tags: [],
        } as Note,
        similarity: 0.8,
      },
    ]

    it('should extract citations when course/video is mentioned', () => {
      const answer = 'According to your note from 001/001-001, React hooks are useful.'
      const citations = extractCitations(answer, mockNotes)

      expect(citations).toEqual(['note-1'])
    })

    it('should extract multiple citations', () => {
      const answer =
        'From 001/001-001 we learn about hooks. From 002/002-001 we learn about TypeScript.'
      const citations = extractCitations(answer, mockNotes)

      expect(citations).toContain('note-1')
      expect(citations).toContain('note-2')
    })

    it('should extract citation by course ID only', () => {
      const answer = 'In course 001, we learned about React.'
      const citations = extractCitations(answer, mockNotes)

      expect(citations).toEqual(['note-1'])
    })

    it('should return empty array when no citations found', () => {
      const answer = 'This answer does not mention any notes.'
      const citations = extractCitations(answer, mockNotes)

      expect(citations).toEqual([])
    })

    it('should handle empty answer', () => {
      const citations = extractCitations('', mockNotes)

      expect(citations).toEqual([])
    })
  })

  describe('retrieveRelevantNotes', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should throw error for empty query', async () => {
      await expect(retrieveRelevantNotes('')).rejects.toThrow('Query cannot be empty')
    })

    it('should throw error for whitespace-only query', async () => {
      await expect(retrieveRelevantNotes('   ')).rejects.toThrow('Query cannot be empty')
    })

    // Note: Full integration tests would require mocking IndexedDB and vector store
    // These are covered by E2E tests in story-e09b-s02.spec.ts
  })
})
