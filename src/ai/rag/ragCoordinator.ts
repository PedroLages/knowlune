/**
 * RAG Coordinator - Orchestrates retrieval-augmented generation pipeline
 *
 * Coordinates vector search, metadata fetching, and context assembly
 * for chat-style Q&A from personal note corpus.
 */

import { generateEmbeddings } from '../workers/coordinator'
import { vectorStorePersistence } from '../vector-store'
import { db } from '@/db'
import { stripHtml } from '@/lib/textUtils'
import type { RetrievedContext, RAGConfig } from './types'
import { DEFAULT_RAG_CONFIG } from './types'

/** Timeout for RAG operations (10 seconds) */
const RAG_TIMEOUT = 10000

export class RAGCoordinator {
  private config: RAGConfig

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = { ...DEFAULT_RAG_CONFIG, ...config }
  }

  /**
   * Retrieve context for a user query via vector similarity search
   *
   * @param query - User's question
   * @param topK - Number of top results to retrieve (overrides config)
   * @returns Retrieved context with notes and metadata
   *
   * @example
   * const context = await coordinator.retrieveContext("What are React hooks?", 5)
   * // Returns top 5 notes with similarity > 0.5
   */
  async retrieveContext(query: string, topK?: number): Promise<RetrievedContext> {
    const k = topK ?? this.config.topK
    const startTime = performance.now()

    // 1. Generate query embedding
    const embeddingStart = performance.now()
    const cleanQuery = stripHtml(query).trim()
    if (!cleanQuery) {
      return {
        notes: [],
        query,
        embeddingTime: 0,
        searchTime: 0,
      }
    }

    // Add timeout to prevent indefinite hang
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('RAG timeout: embedding generation took too long')),
        RAG_TIMEOUT
      )
    )

    const [queryEmbedding] = (await Promise.race([
      generateEmbeddings([cleanQuery]),
      timeoutPromise,
    ])) as [Float32Array]
    const embeddingTime = performance.now() - embeddingStart

    // 2. Vector similarity search
    const searchStart = performance.now()
    const store = vectorStorePersistence.getStore()
    const searchResults = store.search(Array.from(queryEmbedding), k)
    const searchTime = performance.now() - searchStart

    // 3. Filter by minimum similarity threshold
    const filteredResults = searchResults.filter(
      result => result.similarity >= this.config.minSimilarity
    )

    if (filteredResults.length === 0) {
      return {
        notes: [],
        query,
        embeddingTime,
        searchTime,
      }
    }

    // 4. Fetch note metadata from IndexedDB
    const noteIds = filteredResults.map(r => r.id)
    const notes = await db.notes.bulkGet(noteIds)

    // 5. Fetch video and course metadata
    const notesWithMetadata = await Promise.all(
      notes.map(async (note, idx) => {
        if (!note) return null

        // Fetch video metadata
        const video = await db.importedVideos.get(note.videoId)
        if (!video) return null

        // Fetch course metadata
        const course = await db.importedCourses.get(video.courseId)
        if (!course) return null

        return {
          noteId: note.id,
          content: stripHtml(note.content),
          videoId: note.videoId,
          videoFilename: video.filename,
          courseName: course.name,
          score: filteredResults[idx].similarity,
        }
      })
    )

    // Filter out null results (notes/videos/courses that couldn't be found)
    const validNotes = notesWithMetadata.filter((n): n is NonNullable<typeof n> => n !== null)

    return {
      notes: validNotes,
      query,
      embeddingTime,
      searchTime: performance.now() - startTime,
    }
  }

  /**
   * Update RAG configuration
   *
   * @param config - Partial configuration to merge
   */
  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): RAGConfig {
    return { ...this.config }
  }
}

// Singleton instance
export const ragCoordinator = new RAGCoordinator()
