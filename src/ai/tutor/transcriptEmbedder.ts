/**
 * Transcript Embedder (E57-S05)
 *
 * Lazily embeds transcript chunks on first tutor interaction for a lesson.
 * Runs as a background task — does not block chat interaction.
 * Falls back to position-based injection if embedding fails.
 */

import { db } from '@/db'
import { generateEmbeddings } from '@/ai/workers/coordinator'
import { chunkTranscript } from './transcriptChunker'
import type { TranscriptCue, TranscriptEmbedding } from '@/data/types'

/** Track in-progress embedding tasks to avoid duplicates */
const embeddingInProgress = new Map<string, Promise<boolean>>()

/** Compose a stable key for courseId+videoId */
function compositeKey(courseId: string, videoId: string): string {
  return `${courseId}::${videoId}`
}

/**
 * Check if transcript embeddings already exist for a lesson.
 */
export async function hasTranscriptEmbeddings(
  courseId: string,
  videoId: string
): Promise<boolean> {
  const count = await db.transcriptEmbeddings
    .where('[courseId+videoId]')
    .equals([courseId, videoId])
    .count()
  return count > 0
}

/**
 * Check if embedding is currently in progress for a lesson.
 */
export function isEmbeddingInProgress(courseId: string, videoId: string): boolean {
  return embeddingInProgress.has(compositeKey(courseId, videoId))
}

/**
 * Lazily embed transcript chunks for a lesson.
 * Returns immediately — embedding runs in the background.
 * Safe to call multiple times; deduplicates concurrent requests.
 *
 * @param courseId - Course ID
 * @param videoId - YouTube video ID (from youtubeTranscripts table)
 * @param cues - Transcript cues with timing
 * @returns Promise that resolves to true if embedding succeeded, false otherwise
 */
export function lazyEmbedTranscript(
  courseId: string,
  videoId: string,
  cues: TranscriptCue[]
): Promise<boolean> {
  const key = compositeKey(courseId, videoId)

  // Deduplicate concurrent requests
  const existing = embeddingInProgress.get(key)
  if (existing) return existing

  const task = doEmbed(courseId, videoId, cues, key)
  embeddingInProgress.set(key, task)
  return task
}

async function doEmbed(
  courseId: string,
  videoId: string,
  cues: TranscriptCue[],
  key: string
): Promise<boolean> {
  try {
    // Chunk the transcript
    const chunks = chunkTranscript(cues)
    if (chunks.length === 0) return false

    // Generate embeddings in batches of 8 to avoid overwhelming the worker
    const BATCH_SIZE = 8
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const texts = batch.map(c => c.text)

      const embeddings = await generateEmbeddings(texts)

      // Store each embedding in IndexedDB
      const records: TranscriptEmbedding[] = batch.map((chunk, idx) => ({
        id: crypto.randomUUID(),
        courseId,
        videoId,
        chunkText: chunk.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        embedding: Array.from(embeddings[idx]),
        chunkIndex: chunk.chunkIndex,
        createdAt: new Date().toISOString(),
      }))

      await db.transcriptEmbeddings.bulkPut(records)
    }

    return true
  } catch (error) {
    console.error('[TranscriptEmbedder] Failed to embed transcript:', error)
    return false
  } finally {
    embeddingInProgress.delete(key)
  }
}

/**
 * Remove all transcript embeddings for a lesson.
 * Useful when transcript is re-fetched.
 */
export async function removeTranscriptEmbeddings(
  courseId: string,
  videoId: string
): Promise<void> {
  await db.transcriptEmbeddings
    .where('[courseId+videoId]')
    .equals([courseId, videoId])
    .delete()
}
