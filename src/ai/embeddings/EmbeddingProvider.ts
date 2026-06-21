/**
 * Embedding Provider Interface
 *
 * Minimal seam for embedding providers. Used ONLY at the pipeline level —
 * no factory, no registry. Two providers instantiated explicitly.
 *
 * Consumers (embeddingPipeline.ts) instantiate providers directly and handle
 * fallback order inline — no FallbackProvider wrapper class.
 */

export interface EmbeddingProvider {
  /** Human-readable provider name for telemetry/logging */
  readonly name: string

  /**
   * Generate embeddings for an array of texts.
   * Returns one Float32Array per input text, each with 384 dimensions.
   */
  embed(texts: string[]): Promise<Float32Array[]>

  /**
   * Check whether this provider is ready to serve requests.
   * - Local provider: checks that the model is cached and workers are available
   * - OpenAI provider: checks that a valid API key is configured
   */
  isAvailable(): Promise<boolean>
}
