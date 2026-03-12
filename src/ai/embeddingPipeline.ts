import { generateEmbeddings } from './workers/coordinator'
import { vectorStorePersistence } from './vector-store'
import { stripHtml } from '@/lib/textUtils'
import type { Note } from '@/data/types'

export class EmbeddingPipeline {
  /** Index a single note (call on create or update). */
  async indexNote(note: Note): Promise<void> {
    try {
      const text = stripHtml(note.content).trim()
      if (!text) return // Skip empty notes

      const [embedding] = await generateEmbeddings([text])
      await vectorStorePersistence.saveEmbedding(note.id, Array.from(embedding))
    } catch (error) {
      // Non-blocking: note saved even if embedding fails
      console.error('[EmbeddingPipeline] Failed to index note:', note.id, error)
    }
  }

  /** Batch index multiple notes (call on startup for existing notes). */
  async indexNotesBatch(notes: Note[]): Promise<void> {
    for (const note of notes) {
      await this.indexNote(note)
    }
  }

  /** Remove embedding for a deleted note. */
  async removeNote(noteId: string): Promise<void> {
    try {
      await vectorStorePersistence.removeEmbedding(noteId)
    } catch (error) {
      console.error('[EmbeddingPipeline] Failed to remove embedding:', noteId, error)
    }
  }
}

export const embeddingPipeline = new EmbeddingPipeline()
