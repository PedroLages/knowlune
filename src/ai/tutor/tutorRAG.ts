/**
 * Tutor RAG - Retrieval-Augmented Generation for tutor answers (E57-S05)
 *
 * Performs semantic search across transcript embeddings (and optionally note embeddings)
 * with position-aware boosting: chunks near the current playhead get a +0.2 similarity boost.
 *
 * Uses existing BruteForceVectorStore for in-memory search and falls back
 * to direct IndexedDB scan when the in-memory store doesn't have transcript vectors.
 */

import { db } from '@/db'
import { generateEmbeddings } from '@/ai/workers/coordinator'
import { cosineSimilarity } from '@/lib/vectorMath'
import { stripHtml } from '@/lib/textUtils'
import type { TranscriptEmbedding } from '@/data/types'

/** Similarity boost for chunks within PROXIMITY_WINDOW seconds of playhead */
const POSITION_BOOST = 0.2
/** Window in seconds for position-aware boosting */
const PROXIMITY_WINDOW = 60
/** Minimum similarity threshold */
const MIN_SIMILARITY = 0.3
/** Default number of results to return */
const DEFAULT_TOP_K = 5
/** Timeout for RAG query (ms) */
const RAG_TIMEOUT = 10000

export interface TutorRAGChunk {
  /** Chunk text content */
  text: string
  /** Start time in seconds */
  startTime: number
  /** End time in seconds */
  endTime: number
  /** Source type */
  sourceType: 'transcript' | 'note'
  /** Raw cosine similarity score */
  rawScore: number
  /** Score after position boosting */
  boostedScore: number
  /** Note ID (only for note sources) */
  noteId?: string
}

export interface TutorRAGResult {
  /** Retrieved and ranked chunks */
  chunks: TutorRAGChunk[]
  /** Original query */
  query: string
  /** Total retrieval time in ms */
  retrievalTimeMs: number
}

/**
 * Retrieve context chunks for a tutor query using RAG.
 *
 * Searches transcript embeddings for the given lesson, applies position-aware
 * boosting, and returns ranked chunks for injection into the system prompt.
 *
 * @param query - User's question
 * @param courseId - Course ID
 * @param videoId - YouTube video ID
 * @param videoPositionSeconds - Current playhead position for proximity boosting
 * @param topK - Number of results to return
 */
export async function retrieveTutorContext(
  query: string,
  courseId: string,
  videoId: string,
  videoPositionSeconds: number = 0,
  topK: number = DEFAULT_TOP_K
): Promise<TutorRAGResult> {
  const startTime = performance.now()
  const cleanQuery = stripHtml(query).trim()

  if (!cleanQuery) {
    return { chunks: [], query, retrievalTimeMs: 0 }
  }

  try {
    // Generate query embedding with timeout
    let timeoutId: ReturnType<typeof setTimeout>
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('RAG timeout')), RAG_TIMEOUT)
    })

    const [queryEmbedding] = (await Promise.race([
      generateEmbeddings([cleanQuery]),
      timeoutPromise,
    ]).finally(() => clearTimeout(timeoutId))) as [Float32Array]

    // Fetch transcript embeddings from IndexedDB
    const transcriptEmbeddings = await db.transcriptEmbeddings
      .where('[courseId+videoId]')
      .equals([courseId, videoId])
      .toArray()

    // Also search note embeddings for this lesson
    const noteChunks = await searchNoteEmbeddings(queryEmbedding, courseId, videoId)

    // Calculate similarity for transcript chunks
    const transcriptChunks: TutorRAGChunk[] = transcriptEmbeddings.map(
      (emb: TranscriptEmbedding) => {
        const rawScore = cosineSimilarity(queryEmbedding, new Float32Array(emb.embedding))
        const isNearPlayhead =
          Math.abs((emb.startTime + emb.endTime) / 2 - videoPositionSeconds) <= PROXIMITY_WINDOW
        const boostedScore = rawScore + (isNearPlayhead ? POSITION_BOOST : 0)

        return {
          text: emb.chunkText,
          startTime: emb.startTime,
          endTime: emb.endTime,
          sourceType: 'transcript' as const,
          rawScore,
          boostedScore,
        }
      }
    )

    // Combine and sort: transcript chunks prioritized, then by boosted score
    const allChunks = [...transcriptChunks, ...noteChunks]
      .filter(c => c.rawScore >= MIN_SIMILARITY)
      .sort((a, b) => {
        // Transcript chunks get priority over notes at equal scores
        if (a.sourceType !== b.sourceType) {
          if (Math.abs(a.boostedScore - b.boostedScore) < 0.05) {
            return a.sourceType === 'transcript' ? -1 : 1
          }
        }
        return b.boostedScore - a.boostedScore
      })
      .slice(0, topK)

    return {
      chunks: allChunks,
      query,
      retrievalTimeMs: performance.now() - startTime,
    }
  } catch (error) {
    console.error('[TutorRAG] Retrieval failed:', error)
    return {
      chunks: [],
      query,
      retrievalTimeMs: performance.now() - startTime,
    }
  }
}

/**
 * Search note embeddings for a specific lesson.
 * Notes don't have position data, so no position boosting.
 */
async function searchNoteEmbeddings(
  queryVector: Float32Array,
  courseId: string,
  videoId: string
): Promise<TutorRAGChunk[]> {
  try {
    // Get notes for this lesson
    const notes = await db.notes
      .where('[courseId+videoId]')
      .equals([courseId, videoId])
      .toArray()

    if (notes.length === 0) return []

    // Get embeddings for these notes
    const noteIds = notes.map(n => n.id)
    const embeddings = await db.embeddings.bulkGet(noteIds)

    const chunks: TutorRAGChunk[] = []
    for (let i = 0; i < notes.length; i++) {
      const emb = embeddings[i]
      if (!emb) continue

      const rawScore = cosineSimilarity(queryVector, new Float32Array(emb.embedding))
      chunks.push({
        text: stripHtml(notes[i].content),
        startTime: 0,
        endTime: 0,
        sourceType: 'note',
        rawScore,
        boostedScore: rawScore, // No position boosting for notes
        noteId: notes[i].id,
      })
    }

    return chunks
  } catch {
    // silent-catch-ok — note search is supplementary
    return []
  }
}

/**
 * Format retrieved chunks into a context string for the system prompt.
 * Includes [MM:SS] timestamps for transcript chunks to enable citations.
 */
export function formatRAGContext(chunks: TutorRAGChunk[]): string {
  if (chunks.length === 0) return ''

  const sections: string[] = []

  const transcriptChunks = chunks.filter(c => c.sourceType === 'transcript')
  const noteChunks = chunks.filter(c => c.sourceType === 'note')

  if (transcriptChunks.length > 0) {
    sections.push('Retrieved transcript passages (cite timestamps when referencing):')
    for (const chunk of transcriptChunks) {
      const startMM = String(Math.floor(chunk.startTime / 60)).padStart(2, '0')
      const startSS = String(Math.floor(chunk.startTime % 60)).padStart(2, '0')
      const endMM = String(Math.floor(chunk.endTime / 60)).padStart(2, '0')
      const endSS = String(Math.floor(chunk.endTime % 60)).padStart(2, '0')
      sections.push(`[${startMM}:${startSS} - ${endMM}:${endSS}] ${chunk.text}`)
    }
  }

  if (noteChunks.length > 0) {
    sections.push('\nLearner notes (supplementary context):')
    for (const chunk of noteChunks) {
      sections.push(`- ${chunk.text}`)
    }
  }

  return sections.join('\n')
}
