/**
 * Brute Force Vector Store for Epic 9 MVP
 *
 * Simple linear scan k-NN search using cosine similarity.
 * Optimized for 10K-100K vectors with 384 dimensions (all-MiniLM-L6-v2).
 *
 * Performance: 50-100ms for 10K vectors (acceptable for MVP)
 * Recall: 100% (exact search, no approximation)
 * Migration: Switch to HNSW/EdgeVec at 6-month checkpoint if needed
 *
 * @see docs/plans/epic-9-pivot-to-brute-force-vector-search.md
 * @see docs/research/epic-9-vector-migration-triggers.md
 */
export class BruteForceVectorStore {
  private vectors: Map<string, Float32Array>
  private readonly dimensions: number

  /**
   * Create a new vector store
   * @param dimensions - Vector dimensionality (default: 384 for all-MiniLM-L6-v2)
   */
  constructor(dimensions: number = 384) {
    this.vectors = new Map()
    this.dimensions = dimensions
  }

  /**
   * Insert a vector into the store
   * @param id - Unique identifier for the vector
   * @param vector - Vector data (must match dimensions)
   * @throws Error if vector length doesn't match dimensions
   */
  insert(id: string, vector: number[]): void {
    if (vector.length !== this.dimensions) {
      throw new Error(
        `Vector must have ${this.dimensions} dimensions, got ${vector.length}`
      )
    }
    this.vectors.set(id, new Float32Array(vector))
  }

  /**
   * Search for k nearest neighbors using cosine similarity
   *
   * Algorithm: Linear scan (brute force)
   * - Calculate distance to ALL vectors
   * - Sort by distance (ascending)
   * - Return top k results
   *
   * Complexity: O(N * D + N log N)
   * - N * D: distance calculation
   * - N log N: sorting
   *
   * @param query - Query vector
   * @param k - Number of nearest neighbors to return
   * @returns Array of SearchResult ordered by similarity (descending)
   */
  search(query: number[], k: number): SearchResult[] {
    if (this.vectors.size === 0) {
      return []
    }

    if (query.length !== this.dimensions) {
      throw new Error(
        `Query vector must have ${this.dimensions} dimensions, got ${query.length}`
      )
    }

    const queryVector = new Float32Array(query)
    const results: SearchResult[] = []

    // Calculate distance to all vectors
    for (const [id, vector] of Array.from(this.vectors.entries())) {
      const distance = this.distance(queryVector, vector)
      results.push({
        id,
        distance,
        similarity: 1 - distance
      })
    }

    // Sort by distance (ascending = most similar first)
    results.sort((a, b) => a.distance - b.distance)

    // Return top k results
    return results.slice(0, k)
  }

  /**
   * Cosine similarity between two vectors
   * Returns value in [0, 1] where 1 = identical, 0 = orthogonal
   *
   * Formula: cos(θ) = (a · b) / (||a|| * ||b||)
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns Cosine similarity [0, 1]
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA * normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }

  /**
   * Distance metric (1 - cosine similarity)
   * Lower distance = more similar
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns Distance [0, 1]
   */
  private distance(a: Float32Array, b: Float32Array): number {
    return 1 - this.cosineSimilarity(a, b)
  }

  /**
   * Get store statistics
   * @returns Statistics about the vector store
   */
  getStats(): VectorStoreStats {
    const count = this.vectors.size
    // Float32Array: 4 bytes per dimension
    const memoryMB = (count * this.dimensions * 4) / (1024 * 1024)

    return {
      count,
      dimensions: this.dimensions,
      memoryMB: parseFloat(memoryMB.toFixed(2))
    }
  }

  /**
   * Remove a vector by ID
   * @param id - Vector ID to remove
   * @returns true if vector was removed, false if not found
   */
  remove(id: string): boolean {
    return this.vectors.delete(id)
  }

  /**
   * Remove all vectors from the store
   */
  clear(): void {
    this.vectors.clear()
  }

  /**
   * Check if a vector exists
   * @param id - Vector ID to check
   * @returns true if vector exists
   */
  has(id: string): boolean {
    return this.vectors.has(id)
  }

  /**
   * Get total number of vectors
   * @returns Number of vectors in store
   */
  get size(): number {
    return this.vectors.size
  }
}

/**
 * Search result with distance and similarity metrics
 */
export interface SearchResult {
  /** Unique identifier of the vector */
  id: string
  /** Distance from query (lower = more similar) */
  distance: number
  /** Cosine similarity (higher = more similar) */
  similarity: number
}

/**
 * Vector store statistics
 */
export interface VectorStoreStats {
  /** Number of vectors in store */
  count: number
  /** Vector dimensionality */
  dimensions: number
  /** Approximate memory usage in MB */
  memoryMB: number
}
