/**
 * Q&A from Notes - RAG Service Layer
 *
 * Implements Retrieval-Augmented Generation (RAG) pattern for answering
 * questions based on user's notes using semantic search + AI generation.
 *
 * Flow:
 * 1. User asks question → generate query embedding
 * 2. Search vector store for similar notes (top 5, similarity > 0.5)
 * 3. Fetch note metadata from IndexedDB
 * 4. Format retrieved notes as LLM context
 * 5. Stream AI answer using Vercel AI SDK
 * 6. Extract citations from answer
 *
 * @see docs/implementation-artifacts/9b-2-qa-from-notes-with-vercel-ai-sdk.md
 */

import { db } from '@/db'
import type { Note } from '@/data/types'
import { withModelFallback } from '@/ai/llm/factory'
import type { LLMMessage } from '@/ai/llm/types'
import type { FeatureModelConfig } from '@/lib/aiConfiguration'
import { stripHtml } from '@/lib/textUtils'

export type GenerateQAAnswerOptions = {
  signal?: AbortSignal
  /** Same resolved model as pre-RAG consent so streaming uses one provider snapshot. */
  resolved?: FeatureModelConfig
}

/**
 * Retrieved note with similarity score
 */
export interface RetrievedNote {
  note: Note
  similarity: number
}

/**
 * Retrieve relevant notes for a query using semantic search
 *
 * @param query - User's question
 * @returns Array of notes with similarity scores (top 5, similarity > 0.5)
 *
 * @throws Error if the query is empty or database access fails
 */
export async function retrieveRelevantNotes(query: string): Promise<RetrievedNote[]> {
  const cleanQuery = query.trim()
  if (!cleanQuery) {
    throw new Error('Query cannot be empty')
  }

  // Step 1: Generate query embedding (dynamically imported to avoid bundling AI infra)
  const { generateEmbeddings } = await import('@/ai/workers/coordinator')
  let queryEmbedding: Float32Array
  try {
    const embeddings = await generateEmbeddings([cleanQuery])
    queryEmbedding = embeddings[0]
  } catch (error) {
    console.warn('[noteQA] Semantic retrieval failed; falling back to text search:', error)
    return retrieveRelevantNotesByText(cleanQuery)
  }

  // Step 2: Load all note embeddings from IndexedDB
  const allEmbeddings = await db.embeddings.toArray()

  if (allEmbeddings.length === 0) {
    return [] // No notes with embeddings
  }

  // Step 3: Build vector store from all embeddings (dynamic to avoid bundling vectorSearch)
  const { BruteForceVectorStore } = await import('@/lib/vectorSearch')
  const vectorStore = new BruteForceVectorStore(384)
  for (const { noteId, embedding } of allEmbeddings) {
    vectorStore.insert(noteId, embedding)
  }

  // Step 4: Search for top 5 similar notes
  const searchResults = vectorStore.search(Array.from(queryEmbedding), 5)

  // Step 5: Filter by similarity threshold (0.5)
  const relevantResults = searchResults.filter(result => result.similarity > 0.5)

  if (relevantResults.length === 0) {
    return [] // No sufficiently similar notes found
  }

  // Step 6: Fetch note metadata from IndexedDB
  const retrievedNotes: RetrievedNote[] = []
  for (const result of relevantResults) {
    const note = await db.notes.get(result.id)
    if (note && !note.deleted) {
      retrievedNotes.push({
        note,
        similarity: result.similarity,
      })
    }
  }

  return retrievedNotes
}

async function retrieveRelevantNotesByText(query: string, limit = 5): Promise<RetrievedNote[]> {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return []

  const notes = await db.notes.toArray()

  return notes
    .filter(note => !note.deleted)
    .map(note => {
      const searchableText = [
        stripHtml(note.content),
        note.courseId,
        note.videoId,
        ...(note.tags ?? []),
      ].join(' ')
      const tokens = new Set(tokenize(searchableText))
      const matchedTerms = queryTerms.filter(term => tokens.has(term))
      const phraseBoost =
        queryTerms.length > 1 && searchableText.toLowerCase().includes(query.toLowerCase())
          ? 0.25
          : 0
      const similarity = matchedTerms.length / queryTerms.length + phraseBoost
      return { note, similarity }
    })
    .filter(retrieved => retrieved.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

/**
 * Generate AI answer from retrieved notes using RAG pattern
 *
 * Streams answer word-by-word using Vercel AI SDK's streamText API.
 * Answer is grounded in provided notes (reduces hallucination).
 *
 * @param query - User's question
 * @param retrievedNotes - Notes retrieved from semantic search
 * @param options - Optional `signal` for abort handling and `resolved` model snapshot (post-consent)
 * @yields Text chunks as they are generated
 *
 * @throws Error if API call fails or stream is interrupted
 */
export async function* generateQAAnswer(
  query: string,
  retrievedNotes: RetrievedNote[],
  options?: GenerateQAAnswerOptions
): AsyncGenerator<string, void, undefined> {
  if (retrievedNotes.length === 0) {
    yield 'No relevant notes found for your question.'
    return
  }

  // Format notes as context for LLM
  const notesContext = retrievedNotes
    .map((retrieved, index) => {
      const { note } = retrieved
      const timestamp = note.timestamp ? ` (at ${formatTimestamp(note.timestamp)})` : ''
      return `[Note ${index + 1}] ${note.courseId}/${note.videoId}${timestamp}\n${note.content}`
    })
    .join('\n\n---\n\n')

  // System prompt for RAG
  const systemPrompt = `You are a helpful study assistant. Answer questions based ONLY on the provided notes.

Rules:
- Keep answers concise (50-200 words)
- Always cite sources by mentioning the course/video (e.g., "According to your note from 001/001-001...")
- If notes don't contain relevant info, say "I don't have notes covering that topic."
- Focus on key concepts and practical insights
- Do not make up information outside the provided notes`

  const userPrompt = `Context (from user's notes):

${notesContext}

Question: ${query}

Provide a concise answer citing specific notes.`

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  try {
    // Use feature-aware LLM client with automatic model fallback (AC8)
    for await (const chunk of withModelFallback('noteQA', messages, options?.resolved)) {
      yield chunk
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (options?.signal?.aborted) throw error
      throw new Error('Answer generation timed out.')
    }
    throw error
  }
}

/**
 * Extract citations from AI answer
 *
 * MVP: Simple substring matching to identify which notes were cited in answer.
 * Future enhancement: Parse structured citations (e.g., [1], [2]) if we add them.
 *
 * @param answerText - Generated answer text
 * @param retrievedNotes - Notes that were provided as context
 * @returns Array of note IDs that were cited in the answer
 */
export function extractCitations(answerText: string, retrievedNotes: RetrievedNote[]): string[] {
  const citedNoteIds: string[] = []

  for (const { note } of retrievedNotes) {
    // Check if note's course/video is mentioned in answer
    // Example: "001/001-001" or "course 001"
    const courseVideoPattern = `${note.courseId}/${note.videoId}`

    if (answerText.includes(courseVideoPattern) || answerText.includes(note.courseId)) {
      citedNoteIds.push(note.id)
    }
  }

  return citedNoteIds
}

/**
 * Format timestamp (seconds) as MM:SS
 */
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
