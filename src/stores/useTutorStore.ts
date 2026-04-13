/**
 * Tutor Chat State Management (Session-Only)
 *
 * Zustand store for managing tutor conversation state, mode, and streaming.
 * State is NOT persisted — resets on page reload. Dexie persistence in S03.
 *
 * @see E57-S02 — Tutor Hook + Streaming
 */

import { create } from 'zustand'
import type { TutorMode } from '@/ai/tutor/types'
import type { ChatMessage } from '@/ai/rag/types'

/** Tutor store state */
interface TutorState {
  /** Conversation messages */
  messages: ChatMessage[]
  /** Current tutor mode */
  mode: TutorMode
  /** Progressive hint level (0 = no hint, 1-3 = increasing directness) */
  hintLevel: number
  /** Whether the LLM is currently generating a response */
  isGenerating: boolean
  /** Current error message, if any */
  error: string | null

  /** Add a message to the conversation */
  addMessage: (message: ChatMessage) => void
  /** Update the last assistant message content (for streaming) */
  updateLastMessage: (content: string) => void
  /** Set the tutor mode */
  setMode: (mode: TutorMode) => void
  /** Set the hint level */
  setHintLevel: (level: number) => void
  /** Set generating state */
  setGenerating: (isGenerating: boolean) => void
  /** Set error state */
  setError: (error: string | null) => void
  /** Clear the conversation */
  clearConversation: () => void
  /** Load a conversation (stub for S03 persistence) */
  loadConversation: (messages: ChatMessage[]) => void
  /** Persist conversation (stub — full Dexie persistence in S03) */
  persistConversation: () => void
}

export const useTutorStore = create<TutorState>(set => ({
  messages: [],
  mode: 'socratic',
  hintLevel: 0,
  isGenerating: false,
  error: null,

  addMessage: (message: ChatMessage) => {
    set(state => ({
      messages: [...state.messages, message],
    }))
  },

  updateLastMessage: (content: string) => {
    set(state => {
      const messages = [...state.messages]
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        messages[messages.length - 1] = { ...lastMsg, content }
      }
      return { messages }
    })
  },

  setMode: (mode: TutorMode) => {
    set({ mode })
  },

  setHintLevel: (level: number) => {
    set({ hintLevel: Math.max(0, Math.min(3, level)) })
  },

  setGenerating: (isGenerating: boolean) => {
    set({ isGenerating })
  },

  setError: (error: string | null) => {
    set({ error })
  },

  clearConversation: () => {
    set({
      messages: [],
      hintLevel: 0,
      error: null,
      isGenerating: false,
    })
  },

  loadConversation: (messages: ChatMessage[]) => {
    set({ messages })
  },

  persistConversation: () => {
    // Stub — full Dexie persistence in S03
    console.debug('[useTutorStore] persistConversation stub (S03)')
  },
}))
