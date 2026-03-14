/**
 * Q&A Chat State Management (Session-Only)
 *
 * Zustand store for managing chat conversation state.
 * State is NOT persisted - resets on page reload (AC7).
 *
 * Features:
 * - Session-only history (no IndexedDB persistence)
 * - Streaming answer support (incremental updates)
 * - Error state management
 * - Citation tracking for each answer
 *
 * @see docs/implementation-artifacts/9b-2-qa-from-notes-with-vercel-ai-sdk.md
 */

import { create } from 'zustand'
import type { RetrievedNote } from '@/lib/noteQA'

/**
 * Chat message type
 */
export interface ChatMessage {
  id: string
  type: 'question' | 'answer'
  content: string
  timestamp: Date
  citations?: string[] // Note IDs cited in answer
  retrievedNotes?: RetrievedNote[] // Notes that were retrieved for this question
}

/**
 * Q&A Chat Store State
 */
interface QAChatState {
  /** Chat message history (session-only) */
  messages: ChatMessage[]

  /** Is AI currently generating an answer? */
  isGenerating: boolean

  /** Error message (if any) */
  error: string | null

  /**
   * Add user question to chat
   * @param content - Question text
   * @returns Message ID
   */
  addQuestion: (content: string) => string

  /**
   * Add AI answer to chat
   * @param content - Answer text
   * @param citations - Note IDs cited in answer
   * @param retrievedNotes - Notes that were retrieved
   * @returns Message ID
   */
  addAnswer: (content: string, citations: string[], retrievedNotes: RetrievedNote[]) => string

  /**
   * Update answer content (for streaming)
   * @param messageId - Message ID to update
   * @param content - Updated answer text
   */
  updateAnswer: (messageId: string, content: string) => void

  /**
   * Set generating state
   */
  setGenerating: (isGenerating: boolean) => void

  /**
   * Set error state
   */
  setError: (error: string | null) => void

  /**
   * Clear chat history
   */
  clearHistory: () => void
}

/**
 * Q&A Chat Store
 *
 * Session-only state - NOT persisted to IndexedDB.
 * History resets on page reload (per AC7).
 */
export const useQAChatStore = create<QAChatState>(set => ({
  messages: [],
  isGenerating: false,
  error: null,

  addQuestion: (content: string) => {
    const id = crypto.randomUUID()
    const message: ChatMessage = {
      id,
      type: 'question',
      content,
      timestamp: new Date(),
    }

    set(state => ({
      messages: [...state.messages, message],
      error: null, // Clear any previous errors
    }))

    return id
  },

  addAnswer: (content: string, citations: string[], retrievedNotes: RetrievedNote[]) => {
    const id = crypto.randomUUID()
    const message: ChatMessage = {
      id,
      type: 'answer',
      content,
      timestamp: new Date(),
      citations,
      retrievedNotes,
    }

    set(state => ({
      messages: [...state.messages, message],
    }))

    return id
  },

  updateAnswer: (messageId: string, content: string) => {
    set(state => ({
      messages: state.messages.map(msg => (msg.id === messageId ? { ...msg, content } : msg)),
    }))
  },

  setGenerating: (isGenerating: boolean) => {
    set({ isGenerating })
  },

  setError: (error: string | null) => {
    set({ error })
  },

  clearHistory: () => {
    set({
      messages: [],
      error: null,
      isGenerating: false,
    })
  },
}))
