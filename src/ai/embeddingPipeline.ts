import { generateEmbeddings } from './workers/coordinator'
import { vectorStorePersistence } from './vector-store'
import { stripHtml } from '@/lib/textUtils'
import type { Note } from '@/data/types'
import { isGranted, isGrantedForProvider, CONSENT_PURPOSES } from '@/lib/compliance/consentService'
import { getAIConfiguration } from '@/lib/aiConfiguration'
import { useAuthStore } from '@/stores/useAuthStore'

export class EmbeddingPipeline {
  /** Index a single note (call on create or update). */
  async indexNote(note: Note): Promise<void> {
    try {
      const text = stripHtml(note.content).trim()
      if (!text) return // Skip empty notes

      // Consent guard (E119-S08): silently skip if ai_embeddings consent is not granted.
      // Provider guard (E119-S09): also skip if the configured provider doesn't match
      // the provider captured in the consent evidence. The pipeline is background and
      // silent — surfacing the re-consent modal here would be disruptive. Instead we
      // skip silently; the UI will surface the modal when the user next triggers an AI
      // feature interactively (via getLLMClient).
      const userId = useAuthStore.getState().user?.id
      if (userId) {
        const granted = await isGranted(userId, CONSENT_PURPOSES.AI_EMBEDDINGS)
        if (!granted) {
          console.info('[EmbeddingPipeline] Skipping indexNote: ai_embeddings consent not granted.')
          return
        }
        const embeddingProvider = getAIConfiguration().provider
        const providerGranted = await isGrantedForProvider(userId, CONSENT_PURPOSES.AI_EMBEDDINGS, embeddingProvider)
        if (!providerGranted) {
          console.info('[EmbeddingPipeline] Skipping indexNote: provider consent not granted for current provider.')
          return
        }
      } else {
        // Not signed in — no consent can exist; skip silently.
        return
      }

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
