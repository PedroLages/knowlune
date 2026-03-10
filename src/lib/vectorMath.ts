/**
 * Vector Math Utilities
 *
 * Optimized vector operations for semantic search.
 * All operations use Float32Array for WebAssembly compatibility.
 */

/**
 * Compute cosine similarity between two vectors.
 * Returns value in range [-1, 1] where:
 * - 1 = identical vectors
 * - 0 = orthogonal vectors
 * - -1 = opposite vectors
 *
 * For normalized vectors (L2 norm = 1), this is equivalent to dot product.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA * normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}

/**
 * Normalize vector to unit length (L2 norm = 1).
 * This is required before using dot product as cosine similarity.
 */
export function normalizeVector(vector: Float32Array): Float32Array {
  let magnitude = 0
  for (let i = 0; i < vector.length; i++) {
    magnitude += vector[i] * vector[i]
  }
  magnitude = Math.sqrt(magnitude)

  if (magnitude === 0) return vector // Avoid division by zero

  const normalized = new Float32Array(vector.length)
  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i] / magnitude
  }

  return normalized
}

/**
 * Compute dot product between two vectors.
 * Only use for normalized vectors (otherwise use cosineSimilarity).
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i]
  }

  return sum
}

/**
 * Compute Euclidean distance between two vectors.
 * Returns value in range [0, ∞) where 0 = identical vectors.
 */
export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }

  return Math.sqrt(sum)
}
