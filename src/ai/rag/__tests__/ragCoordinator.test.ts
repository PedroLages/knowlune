/**
 * RAGCoordinator unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RAGCoordinator } from '../ragCoordinator'
import { generateEmbeddings } from '../../workers/coordinator'

// Mock dependencies
vi.mock('../../workers/coordinator', () => ({
  generateEmbeddings: vi.fn(async (texts: string[]) => {
    // Return mock embeddings (384 dimensions)
    return texts.map(() => new Float32Array(384).fill(0.1))
  }),
}))

vi.mock('../../vector-store', () => ({
  vectorStorePersistence: {
    getStore: vi.fn(() => ({
      search: vi.fn((_query: number[], k: number) => {
        // Mock search results
        return [
          { id: 'note-1', distance: 0.1, similarity: 0.9 },
          { id: 'note-2', distance: 0.3, similarity: 0.7 },
          { id: 'note-3', distance: 0.5, similarity: 0.5 },
        ].slice(0, k)
      }),
    })),
  },
}))

vi.mock('@/db', () => ({
  db: {
    notes: {
      bulkGet: vi.fn(async (ids: string[]) => {
        return ids.map(id => ({
          id,
          courseId: `course-${id}`,
          videoId: `video-${id}`,
          content: `Content for ${id}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        }))
      }),
    },
    importedVideos: {
      get: vi.fn(async (id: string) => ({
        id,
        courseId: `course-${id}`,
        filename: `video-${id}.mp4`,
        path: `/videos/${id}`,
        duration: 3600,
        format: 'mp4' as const,
        order: 1,
        fileHandle: {} as FileSystemFileHandle,
      })),
    },
    importedCourses: {
      get: vi.fn(async (id: string) => ({
        id,
        name: `Course ${id}`,
        importedAt: new Date().toISOString(),
        category: 'Programming',
        tags: [],
        status: 'active' as const,
        videoCount: 10,
        pdfCount: 0,
        directoryHandle: {} as FileSystemDirectoryHandle,
      })),
    },
  },
}))

vi.mock('@/lib/textUtils', () => ({
  stripHtml: vi.fn((text: string) => text),
}))

describe('RAGCoordinator', () => {
  let coordinator: RAGCoordinator

  beforeEach(() => {
    coordinator = new RAGCoordinator()
    vi.clearAllMocks()
  })

  describe('retrieveContext', () => {
    it('should retrieve context for a query', async () => {
      const result = await coordinator.retrieveContext('What are React hooks?', 3)

      expect(result.query).toBe('What are React hooks?')
      expect(result.notes).toHaveLength(3)
      expect(result.notes[0]).toMatchObject({
        noteId: 'note-1',
        content: expect.any(String),
        videoId: expect.any(String),
        videoFilename: expect.any(String),
        courseName: expect.any(String),
        score: expect.any(Number),
      })
      expect(result.embeddingTime).toBeGreaterThanOrEqual(0)
      expect(result.searchTime).toBeGreaterThanOrEqual(0)
    })

    it('should filter results below similarity threshold', async () => {
      coordinator.updateConfig({ minSimilarity: 0.8 })
      const result = await coordinator.retrieveContext('test query', 3)

      // Only note-1 has similarity 0.9 (above threshold)
      expect(result.notes).toHaveLength(1)
      expect(result.notes[0].noteId).toBe('note-1')
    })

    it('should return empty results for empty query', async () => {
      const result = await coordinator.retrieveContext('', 5)

      expect(result.notes).toHaveLength(0)
      expect(result.embeddingTime).toBe(0)
      expect(result.searchTime).toBe(0)
    })

    it('should respect topK parameter', async () => {
      const result = await coordinator.retrieveContext('test query', 2)

      expect(result.notes.length).toBeLessThanOrEqual(2)
    })

    it('should handle case when no notes match threshold', async () => {
      coordinator.updateConfig({ minSimilarity: 0.95 })
      const result = await coordinator.retrieveContext('test query', 5)

      expect(result.notes).toHaveLength(0)
    })
  })

  describe('configuration', () => {
    it('should allow updating configuration', () => {
      coordinator.updateConfig({ topK: 10, minSimilarity: 0.7 })
      const config = coordinator.getConfig()

      expect(config.topK).toBe(10)
      expect(config.minSimilarity).toBe(0.7)
    })

    it('should merge partial configuration updates', () => {
      const initialConfig = coordinator.getConfig()
      coordinator.updateConfig({ topK: 15 })
      const updatedConfig = coordinator.getConfig()

      expect(updatedConfig.topK).toBe(15)
      expect(updatedConfig.minSimilarity).toBe(initialConfig.minSimilarity)
    })
  })

  describe('timeout handling', () => {
    it('should timeout if embedding generation takes >10s', async () => {
      // Mock slow embedding generation (never resolves - will timeout)
      vi.mocked(generateEmbeddings).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      await expect(coordinator.retrieveContext('test query', 5)).rejects.toThrow(/RAG timeout/)
    }, 15000) // 15s test timeout to allow RAG 10s timeout to complete

    it('should not timeout for fast embedding generation', async () => {
      // Mock fast embedding generation (100ms)
      vi.mocked(generateEmbeddings).mockImplementation(async texts => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return texts.map(() => new Float32Array(384).fill(0.1))
      })

      const result = await coordinator.retrieveContext('test query', 5)

      expect(result).toBeDefined()
      expect(result.notes).toBeInstanceOf(Array)
    })
  })
})
