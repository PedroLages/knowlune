/**
 * Tutor Chat State Management with Dexie Persistence
 *
 * Zustand store for managing tutor conversation state, mode, and streaming.
 * Persists conversations to Dexie chatConversations table.
 *
 * @see E57-S02 — Tutor Hook + Streaming
 * @see E57-S03 — Conversation Persistence
 */

import { create } from 'zustand'
import { db } from '@/db'
import { toast } from 'sonner'
import type { TutorMode, TranscriptStatus } from '@/ai/tutor/types'
import type { ChatMessage } from '@/ai/rag/types'
import type { ChatConversation, TutorMessage, LearnerModel } from '@/data/types'
import {
  getOrCreateLearnerModel,
  updateLearnerModel as updateLearnerModelService,
  clearLearnerModel as clearLearnerModelService,
} from '@/ai/tutor/learnerModelService'

/** Tutor store state */
interface TutorState {
  /** Conversation messages */
  messages: ChatMessage[]
  /** Current tutor mode */
  mode: TutorMode
  /** Progressive hint level (0 = no hint, 1-4 = increasing directness) */
  hintLevel: number
  /** Consecutive exchanges at the same hint level (for auto-escalation) */
  stuckCount: number
  /** Whether the LLM is currently generating a response */
  isGenerating: boolean
  /** Current error message, if any */
  error: string | null
  /** Transcript status for badge display */
  transcriptStatus: TranscriptStatus | null
  /** Persistent learner model for the current course (E72-S01) */
  learnerModel: LearnerModel | null
  /** Active conversation ID (from Dexie) */
  conversationId: string | null
  /** Current lesson context for persistence */
  _courseId: string | null
  _videoId: string | null

  /** Add a message to the conversation */
  addMessage: (message: ChatMessage) => void
  /** Update the last assistant message content (for streaming) */
  updateLastMessage: (content: string) => void
  /** Finalize the streaming message (alias for updateLastMessage, signals stream end) */
  finalizeStreamingMessage: (content: string) => void
  /** Set the streaming content of the last assistant message */
  setStreamingContent: (content: string) => void
  /** Set the tutor mode */
  setMode: (mode: TutorMode) => void
  /** Set the hint level */
  setHintLevel: (level: number) => void
  /** Set the stuck count for auto-escalation tracking */
  setStuckCount: (count: number) => void
  /** Set generating state (alias: setLoading) */
  setGenerating: (isGenerating: boolean) => void
  /** Set loading state (alias for setGenerating) */
  setLoading: (isLoading: boolean) => void
  /** Set error state */
  setError: (error: string | null) => void
  /** Clear the conversation (and delete from Dexie) */
  clearConversation: () => void
  /** Set transcript status */
  setTranscriptStatus: (status: TranscriptStatus | null) => void
  /** Load conversation from Dexie for courseId+videoId */
  loadConversation: (courseId: string, videoId: string) => Promise<void>
  /** Persist current conversation to Dexie */
  persistConversation: () => Promise<void>
  /** Set lesson context for persistence */
  setLessonContext: (courseId: string, videoId: string) => void
  /** Load or create learner model for a course (E72-S01) */
  loadLearnerModel: (courseId: string) => Promise<void>
  /** Update learner model with additive merge (E72-S01) */
  updateLearnerModel: (courseId: string, updates: Partial<LearnerModel>) => Promise<void>
  /** Clear learner model for a course (E72-S01) */
  clearLearnerModel: (courseId: string) => Promise<void>
}

/** Maximum conversation history to retain (prevents unbounded growth) */
const MAX_HISTORY_MESSAGES = 500

/** Convert ChatMessage to TutorMessage for Dexie storage */
function toTutorMessage(msg: ChatMessage): TutorMessage {
  return {
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    timestamp: msg.timestamp,
  }
}

/** Convert TutorMessage to ChatMessage for display */
function toChatMessage(msg: TutorMessage): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  }
}

export const useTutorStore = create<TutorState>((set, get) => ({
  messages: [],
  mode: 'socratic',
  hintLevel: 0,
  stuckCount: 0,
  isGenerating: false,
  error: null,
  transcriptStatus: null,
  learnerModel: null,
  conversationId: null,
  _courseId: null,
  _videoId: null,

  setLessonContext: (courseId: string, videoId: string) => {
    set({ _courseId: courseId, _videoId: videoId })
  },

  addMessage: (message: ChatMessage) => {
    set(state => {
      const messages = [...state.messages, message]
      // Trim to max history to prevent unbounded growth
      const trimmed =
        messages.length > MAX_HISTORY_MESSAGES
          ? messages.slice(messages.length - MAX_HISTORY_MESSAGES)
          : messages
      return { messages: trimmed }
    })
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

  finalizeStreamingMessage: (content: string) => {
    set(state => {
      const messages = [...state.messages]
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        messages[messages.length - 1] = { ...lastMsg, content }
      }
      return { messages }
    })
  },

  setStreamingContent: (content: string) => {
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
    set({ mode, hintLevel: 0, stuckCount: 0 })
  },

  setHintLevel: (level: number) => {
    set({ hintLevel: Math.max(0, Math.min(4, level)) })
  },

  setStuckCount: (count: number) => {
    set({ stuckCount: Math.max(0, count) })
  },

  setGenerating: (isGenerating: boolean) => {
    set({ isGenerating })
  },

  setLoading: (isLoading: boolean) => {
    set({ isGenerating: isLoading })
  },

  setError: (error: string | null) => {
    set({ error })
  },

  clearConversation: () => {
    const { conversationId } = get()
    // Delete from Dexie if we have a persisted conversation
    if (conversationId) {
      db.chatConversations.delete(conversationId).catch((error: unknown) => {
        console.error('Failed to clear conversation from Dexie:', error)
        // silent-catch-ok — clearing UI state is the priority; delete failure is non-blocking
      })
    }
    set({
      messages: [],
      hintLevel: 0,
      stuckCount: 0,
      error: null,
      isGenerating: false,
      conversationId: null,
    })
  },

  setTranscriptStatus: (status: TranscriptStatus | null) => {
    set({ transcriptStatus: status })
  },

  loadConversation: async (courseId: string, videoId: string) => {
    try {
      const conv = await db.chatConversations
        .where('[courseId+videoId]')
        .equals([courseId, videoId])
        .first()

      if (conv) {
        // Validate messages blob (EC-HIGH: corruption guard)
        if (!Array.isArray(conv.messages)) {
          toast.error('Conversation data was corrupted. Starting fresh.')
          await db.chatConversations.delete(conv.id)
          set({ messages: [], conversationId: null })
          return
        }

        const chatMessages = conv.messages.map(toChatMessage)
        set({
          messages: chatMessages,
          conversationId: conv.id,
          mode: conv.mode as TutorMode,
          hintLevel: conv.hintLevel,
        })
      } else {
        set({ messages: [], conversationId: null })
      }
    } catch {
      // silent-catch-ok — load failure is non-critical, start fresh
      set({ messages: [], conversationId: null })
    }
  },

  persistConversation: async () => {
    const { messages, mode, hintLevel, conversationId, _courseId, _videoId } = get()
    if (!_courseId || !_videoId || messages.length === 0) return

    const tutorMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(toTutorMessage)

    const now = Date.now()

    try {
      if (conversationId) {
        // Update existing conversation
        await db.chatConversations.update(conversationId, {
          messages: tutorMessages,
          mode,
          hintLevel,
          updatedAt: now,
        })
      } else {
        // Create new conversation
        const id = crypto.randomUUID()
        const conversation: ChatConversation = {
          id,
          courseId: _courseId,
          videoId: _videoId,
          mode,
          hintLevel,
          messages: tutorMessages,
          createdAt: now,
          updatedAt: now,
        }
        await db.chatConversations.add(conversation)
        set({ conversationId: id })
      }
    } catch {
      toast.error('Failed to save conversation.')
    }
  },

  loadLearnerModel: async (courseId: string) => {
    try {
      const model = await getOrCreateLearnerModel(courseId)
      set({ learnerModel: model })
    } catch {
      toast.error('Failed to load learner model.')
      set({ learnerModel: null })
    }
  },

  updateLearnerModel: async (courseId: string, updates: Partial<LearnerModel>) => {
    try {
      const updated = await updateLearnerModelService(courseId, updates)
      if (updated) {
        set({ learnerModel: updated })
      }
    } catch {
      toast.error('Failed to update learner model.')
    }
  },

  clearLearnerModel: async (courseId: string) => {
    try {
      await clearLearnerModelService(courseId)
      set({ learnerModel: null })
    } catch {
      toast.error('Failed to clear learner model.')
    }
  },
}))
