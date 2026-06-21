/**
 * Embedding Pipeline
 *
 * Orchestrates note embedding lifecycle with inline fallback:
 * 1. Try on-device (Transformers.js via worker pool)
 * 2. If local fails AND OpenAI key is configured -> try OpenAI Embeddings API
 * 3. If both fail -> log telemetry, note saved without embedding (graceful)
 *
 * Fallback is per-request (not sticky) — user may configure OpenAI key after
 * a previous failure, and on-device may recover on the next session.
 *
 * Consent gates (E119-S08, E119-S09) are checked before any embedding attempt.
 */

import { vectorStorePersistence } from './vector-store'
import { stripHtml } from '@/lib/textUtils'
import type { Note } from '@/data/types'
import { isGranted, isGrantedForProvider, CONSENT_PURPOSES } from '@/lib/compliance/consentService'
import { getAIConfiguration, getDecryptedApiKeyForProvider } from '@/lib/aiConfiguration'
import { useAuthStore } from '@/stores/useAuthStore'
import { LocalEmbeddingProvider } from '@/ai/embeddings/localProvider'
import { OpenAIEmbeddingProvider, EmbeddingProviderError } from '@/ai/embeddings/openaiProvider'
import type { EmbeddingProvider } from '@/ai/embeddings/EmbeddingProvider'
import { warmUpEmbeddingModel } from './workers/coordinator'

// ============================================================================
// Provider Instances
// ============================================================================

/** Reusable local provider — wraps existing generateEmbeddings() from coordinator */
const localProvider = new LocalEmbeddingProvider()

// ============================================================================
// Debounced Error Surfacing
// ============================================================================

/**
 * Track which error types have been surfaced via toast this session to avoid
 * spamming the user with duplicate toasts on every note save.
 */
const errorTypesSurfaced = new Set<string>()

function markErrorSurfaced(key: string): boolean {
  if (errorTypesSurfaced.has(key)) return false
  errorTypesSurfaced.add(key)
  return true
}

// ============================================================================
// Embedding Pipeline
// ============================================================================

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
        const embeddingProviderCfg = getAIConfiguration().provider
        const providerGranted = await isGrantedForProvider(
          userId,
          CONSENT_PURPOSES.AI_EMBEDDINGS,
          embeddingProviderCfg
        )
        if (!providerGranted) {
          console.info(
            '[EmbeddingPipeline] Skipping indexNote: provider consent not granted for current provider.'
          )
          return
        }
      } else {
        // Not signed in — no consent can exist; skip silently.
        return
      }

      // === Attempt 1: On-device (local) ===
      const embedding = await this.tryLocalEmbedding([text])

      if (embedding) {
        await vectorStorePersistence.saveEmbedding(note.id, Array.from(embedding))
        return
      }

      // === Attempt 2: OpenAI fallback ===
      const fallbackResult = await this.tryOpenAIFallback([text])
      if (fallbackResult) {
        await vectorStorePersistence.saveEmbedding(note.id, Array.from(fallbackResult))
        return
      }

      // === Both providers failed ===
      // Note saved without embedding — graceful degradation.
      // Telemetry is logged above; the toast surface is debounced.
      console.info(
        '[EmbeddingPipeline] All embedding providers failed — note saved without embedding.'
      )
    } catch (error) {
      // Non-blocking: note saved even if embedding fails
      console.error('[EmbeddingPipeline] Failed to index note:', note.id, error)
    }
  }

  /**
   * Attempt local (on-device) embedding via Transformers.js worker pool.
   * Returns the embedding vector, or null if unavailable/failed.
   */
  private async tryLocalEmbedding(texts: string[]): Promise<Float32Array | null> {
    const available = await localProvider.isAvailable()
    if (!available) {
      console.info('[EmbeddingPipeline] Local provider unavailable — skipping')
      return null
    }

    try {
      const result = await localProvider.embed(texts)
      if (result.length > 0 && result[0]?.length === 384) {
        return result[0]
      }
      console.warn('[EmbeddingPipeline] Local provider returned invalid embedding')
      return null
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const reason = (error as Error & { reason?: string }).reason ?? 'unknown'

      console.warn('[EmbeddingPipeline] Local embedding failed:', {
        provider: 'local',
        error: errorMessage,
        reason,
      })

      // Actionable telemetry (R5): provider + error class
      if (markErrorSurfaced(`local:${reason}`)) {
        console.info(
          `[EmbeddingPipeline] Telemetry: { provider: 'local', error: '${errorMessage}', reason: '${reason}' }`
        )
      }

      return null
    }
  }

  /**
   * Attempt OpenAI embedding as a fallback when the local provider fails.
   * Only runs if the user has configured an OpenAI API key.
   * Returns the embedding vector, or null if unavailable/failed.
   */
  private async tryOpenAIFallback(texts: string[]): Promise<Float32Array | null> {
    let apiKey: string | null = null
    try {
      apiKey = await getDecryptedApiKeyForProvider('openai')
    } catch {
      console.info('[EmbeddingPipeline] OpenAI key decryption failed — skipping fallback')
      return null
    }

    if (!apiKey) {
      return null
    }

    const openaiProvider: EmbeddingProvider = new OpenAIEmbeddingProvider(apiKey)

    // isAvailable() is skipped here because we already verified apiKey is non-null
    // (OpenAIEmbeddingProvider.isAvailable() only checks for a non-empty key).
    try {
      const result = await openaiProvider.embed(texts)
      if (result.length > 0 && result[0]?.length === 384) {
        return result[0]
      }
      console.warn('[EmbeddingPipeline] OpenAI returned invalid embedding')
      return null
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const code = error instanceof EmbeddingProviderError ? error.code : 'unknown'

      console.warn('[EmbeddingPipeline] OpenAI fallback failed:', {
        provider: 'openai',
        error: errorMessage,
        code,
      })

      // Actionable telemetry (R5): provider + error class — debounced per error type
      if (markErrorSurfaced(`openai:${code}`)) {
        console.info(
          `[EmbeddingPipeline] Telemetry: { provider: 'openai', error: '${errorMessage}', code: '${code}' }`
        )
      }

      return null
    }
  }

  /** Batch index multiple notes (call on startup for existing notes). */
  async indexNotesBatch(notes: Note[]): Promise<void> {
    for (const note of notes) {
      await this.indexNote(note)
    }
  }

  /**
   * Pre-warm the embedding model so the first real indexNote() call is instant.
   * Sends a no-op embed request that triggers model download/cache without
   * persisting anything to the vector store.
   *
   * Best-effort: failures are silently ignored. Caller (App.tsx) gates on
   * deviceMemory >= 4GB.
   */
  async warmUp(): Promise<void> {
    await warmUpEmbeddingModel()
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
