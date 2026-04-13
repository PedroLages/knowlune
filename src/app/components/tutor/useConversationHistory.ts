/**
 * useConversationHistory (E73-S05)
 *
 * Encapsulates conversation history state and logic extracted from TutorChat.
 * Handles preloading conversations from Dexie, stale conversation detection,
 * continue, and delete operations.
 */

import { useState, useCallback, useEffect, type SetStateAction } from 'react'
import { useTutorStore } from '@/stores/useTutorStore'
import { db } from '@/db'
import { isConversationStale } from './ContinueConversationPrompt'
import type { ChatConversation } from '@/data/types'
import type { TutorMode } from '@/ai/tutor/types'
import type { ChatMessage } from '@/ai/rag/types'

interface UseConversationHistoryOptions {
  courseId: string
  videoId: string
  messages: ChatMessage[]
}

interface UseConversationHistoryResult {
  allConversations: ChatConversation[]
  historyOpen: boolean
  setHistoryOpen: (open: SetStateAction<boolean>) => void
  staleConversation: ChatConversation | null
  conversationsLoaded: boolean
  continuePromptDismissed: boolean
  dismissStalePrompt: () => void
  handleContinueConversation: (conv: ChatConversation) => void
  handleDeleteConversation: (conversationId: string) => void
}

export function useConversationHistory({
  courseId,
  videoId,
  messages,
}: UseConversationHistoryOptions): UseConversationHistoryResult {
  const [allConversations, setAllConversations] = useState<ChatConversation[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [continuePromptDismissed, setContinuePromptDismissed] = useState(false)
  const [conversationsLoaded, setConversationsLoaded] = useState(false)

  // Load all conversations for this course when history sheet opens
  useEffect(() => {
    if (!historyOpen) return
    let ignore = false
    db.chatConversations
      .where('courseId')
      .equals(courseId)
      .toArray()
      .then(convs => {
        if (!ignore) setAllConversations(convs)
      })
      .catch(() => {
        // silent-catch-ok — history load failure is non-critical
      })
    return () => {
      ignore = true
    }
  }, [historyOpen, courseId])

  // Preload conversations for continue prompt on mount
  useEffect(() => {
    let ignore = false
    db.chatConversations
      .where('[courseId+videoId]')
      .equals([courseId, videoId])
      .toArray()
      .then(convs => {
        if (!ignore) {
          setAllConversations(prev => {
            const ids = new Set(prev.map(c => c.id))
            return [...prev, ...convs.filter(c => !ids.has(c.id))]
          })
          setConversationsLoaded(true)
        }
      })
      .catch(() => {
        // silent-catch-ok — preload failure is non-critical
        if (!ignore) setConversationsLoaded(true)
      })
    return () => {
      ignore = true
    }
  }, [courseId, videoId])

  // Find the most recent stale conversation for the continue prompt
  const staleConversation =
    conversationsLoaded && !continuePromptDismissed && messages.length === 0
      ? allConversations
          .filter(
            c =>
              c.videoId === videoId &&
              c.courseId === courseId &&
              isConversationStale(c.updatedAt)
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
      : null

  const handleContinueConversation = useCallback(
    (conv: ChatConversation) => {
      // Load conversation messages into the store, preserving original IDs
      const chatMessages = conv.messages.map(msg => ({
        id: crypto.randomUUID(),
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        mode: msg.mode ?? ('socratic' as const),
        debugAssessment: msg.debugAssessment,
      }))
      useTutorStore.setState({
        messages: chatMessages,
        conversationId: conv.id,
        mode: conv.mode as TutorMode,
        hintLevel: 0, // Reset hint ladder per AC
      })
      setContinuePromptDismissed(true)
    },
    []
  )

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      setAllConversations(prev => prev.filter(c => c.id !== conversationId))
    },
    []
  )

  const dismissStalePrompt = useCallback(() => setContinuePromptDismissed(true), [])

  return {
    allConversations,
    historyOpen,
    setHistoryOpen,
    staleConversation,
    conversationsLoaded,
    continuePromptDismissed,
    dismissStalePrompt,
    handleContinueConversation,
    handleDeleteConversation,
  }
}
