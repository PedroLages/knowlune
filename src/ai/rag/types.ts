/**
 * RAG (Retrieval-Augmented Generation) type definitions
 *
 * Defines data structures for chat-style Q&A with citation support.
 */

/** Message types for chat conversation */
export interface ChatMessage {
  /** Unique message identifier */
  id: string
  /** Message role */
  role: 'user' | 'assistant' | 'system'
  /** Message content */
  content: string
  /** Citation metadata for assistant messages */
  citations?: Map<number, CitationMetadata>
  /** Message timestamp */
  timestamp: number
  /** Error message for failed messages */
  error?: string
  /** Tutor mode when this message was sent (E72-S02, tutor context only) */
  mode?: import('@/ai/tutor/types').TutorMode
}

/** Citation metadata for clickable references */
export interface CitationMetadata {
  /** Note ID */
  noteId: string
  /** Video ID containing the note */
  videoId: string
  /** Video filename */
  videoFilename: string
  /** Course ID */
  courseId: string
  /** Course name */
  courseName: string
  /** Video timestamp where note was taken (seconds) */
  timestamp?: number
}

/** Retrieved context from vector search */
export interface RetrievedContext {
  /** Retrieved notes with metadata */
  notes: Array<{
    /** Note ID */
    noteId: string
    /** Note content */
    content: string
    /** Video ID */
    videoId: string
    /** Video filename */
    videoFilename: string
    /** Course name */
    courseName: string
    /** Cosine similarity score [0, 1] */
    score: number
  }>
  /** Original query */
  query: string
  /** Embedding generation time (ms) */
  embeddingTime: number
  /** Vector search time (ms) */
  searchTime: number
}

/** RAG configuration */
export interface RAGConfig {
  /** Number of top results to retrieve */
  topK: number
  /** Minimum similarity threshold to filter low-quality matches */
  minSimilarity: number
  /** Maximum context tokens for LLM */
  maxContextTokens: number
}

/** Default RAG configuration */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  topK: 5,
  minSimilarity: 0.5,
  maxContextTokens: 4000,
}
