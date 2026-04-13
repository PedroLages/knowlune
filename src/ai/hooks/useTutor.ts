/**
 * useTutor Hook (E57-S02)
 *
 * React hook for tutor chat with streaming LLM responses.
 * Implements a 6-stage pipeline:
 *   1. Frustration detection (placeholder — S04)
 *   2. Get transcript context
 *   3. Build system prompt
 *   4. Assemble LLM message array (sliding window)
 *   5. Stream LLM response
 *   6. Persist to store
 *
 * Follows useChatQA pattern with AbortController for cleanup.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useTutorStore } from '@/stores/useTutorStore'
import { getTranscriptContext } from '@/ai/tutor/transcriptContext'
import { buildTutorSystemPrompt } from '@/ai/tutor/tutorPromptBuilder'
import { getLLMClient } from '@/ai/llm/factory'
import { LLMError } from '@/ai/llm/types'
import type { LLMMessage } from '@/ai/llm/types'
import type { TutorContext, TranscriptStatus } from '@/ai/tutor/types'
import type { ChatMessage } from '@/ai/rag/types'

/** Maximum number of past exchanges to include in LLM context */
const MAX_CONTEXT_EXCHANGES = 3
/** Messages per exchange (user + assistant) */
const MESSAGES_PER_EXCHANGE = 2
const MAX_CONTEXT_MESSAGES = MAX_CONTEXT_EXCHANGES * MESSAGES_PER_EXCHANGE

interface UseTutorOptions {
  courseId: string
  lessonId: string
  courseName: string
  lessonTitle: string
  lessonPosition?: string
  videoPositionSeconds?: number
}

interface UseTutorResult {
  /** Conversation messages */
  messages: ChatMessage[]
  /** Whether the LLM is generating */
  isGenerating: boolean
  /** Current error message */
  error: string | null
  /** Transcript status for badge */
  transcriptStatus: TranscriptStatus | null
  /** Send a user message */
  sendMessage: (content: string) => Promise<void>
  /** Clear conversation */
  clearConversation: () => void
}

/**
 * Map LLMError codes to user-friendly messages.
 * Reuses the same error mapping pattern as useChatQA.
 */
function mapLLMError(err: unknown): string {
  if (err instanceof LLMError) {
    switch (err.code) {
      case 'TIMEOUT':
        return 'Request timed out. Please try again.'
      case 'RATE_LIMIT':
      case 'RATE_LIMITED':
        return 'Rate limit exceeded. Please wait a moment before trying again.'
      case 'AUTH_ERROR':
        return 'Authentication failed. Please check your AI provider settings.'
      case 'AUTH_REQUIRED':
        return 'Sign in required. Please sign in to use AI features.'
      case 'ENTITLEMENT_ERROR':
        return 'Premium subscription required. Configure an AI provider in Settings to use tutoring.'
      case 'NETWORK_ERROR':
        return 'AI provider offline. Configure a provider in Settings to use tutoring.'
      default:
        return `AI provider error: ${err.message}`
    }
  }
  return 'Failed to process your request. Please try again.'
}

/**
 * Detect frustration level from user message.
 * Placeholder — full implementation in S04.
 */
function detectFrustration(_message: string): 'none' | 'mild' | 'high' {
  return 'none'
}

export function useTutor(options: UseTutorOptions): UseTutorResult {
  const {
    courseId,
    lessonId,
    courseName,
    lessonTitle,
    lessonPosition,
    videoPositionSeconds = 0,
  } = options

  const store = useTutorStore()
  const abortRef = useRef<AbortController | null>(null)
  const transcriptStatusRef = useRef<TranscriptStatus | null>(null)

  // Load transcript status on mount / lesson change
  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      try {
        const result = await getTranscriptContext(courseId, lessonId, videoPositionSeconds)
        if (!cancelled) {
          transcriptStatusRef.current = result.status
        }
      } catch {
        // silent-catch-ok — transcript context is non-critical
        if (!cancelled) {
          transcriptStatusRef.current = {
            available: false,
            strategy: 'none',
            label: 'General mode',
          }
        }
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [courseId, lessonId, videoPositionSeconds])

  // Clear conversation when lesson changes
  useEffect(() => {
    store.clearConversation()
  }, [lessonId])

  // Abort streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (store.isGenerating) return

      store.setGenerating(true)
      store.setError(null)

      // Abort any previous stream
      abortRef.current?.abort()
      const abortController = new AbortController()
      abortRef.current = abortController

      // Stage 1: Frustration detection (placeholder — S04)
      detectFrustration(content)

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      store.addMessage(userMessage)

      try {
        // Stage 2: Get transcript context with current video position
        const position = Number.isFinite(videoPositionSeconds) ? videoPositionSeconds : 0
        let transcriptResult: Awaited<ReturnType<typeof getTranscriptContext>>
        try {
          transcriptResult = await getTranscriptContext(courseId, lessonId, position)
        } catch {
          // Transcript context is non-critical — continue without it
          transcriptResult = {
            excerpt: '',
            strategy: 'none' as const,
            status: { available: false, strategy: 'none' as const, label: 'General mode' },
          }
        }

        // Stage 3: Build system prompt
        const tutorContext: TutorContext = {
          courseName,
          lessonTitle,
          lessonPosition,
          videoPositionSeconds: position,
          transcriptExcerpt: transcriptResult.excerpt || undefined,
          transcriptStrategy: transcriptResult.strategy,
          chapterTitle: transcriptResult.chapterTitle,
          timeRange: transcriptResult.timeRange,
        }
        const systemPrompt = buildTutorSystemPrompt(tutorContext, store.mode)

        // Stage 4: Build LLM message array with sliding window
        const allMessages = [...store.messages] // includes the user message we just added
        const conversationMessages = allMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-MAX_CONTEXT_MESSAGES)

        const llmMessages: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          ...conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ]

        // Stage 5: Stream LLM response
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        }
        store.addMessage(assistantMessage)

        const llmClient = await getLLMClient('tutor')
        let fullResponse = ''

        for await (const chunk of llmClient.streamCompletion(llmMessages)) {
          if (abortController.signal.aborted) {
            break
          }

          if (chunk.content) {
            fullResponse += chunk.content
            store.updateLastMessage(fullResponse)
          }

          if (chunk.finishReason) {
            break
          }
        }

        // If aborted mid-stream, preserve partial content
        if (abortController.signal.aborted && fullResponse) {
          store.updateLastMessage(fullResponse + ' [Response interrupted]')
        }

        // Stage 6: Persist (stub for S03)
        store.persistConversation()
      } catch (err) {
        if (abortController.signal.aborted) {
          // User-initiated abort — don't show error
          return
        }

        // Preserve partial content on mid-stream failure
        const currentMessages = useTutorStore.getState().messages
        const lastMsg = currentMessages[currentMessages.length - 1]
        if (lastMsg?.role === 'assistant' && lastMsg.content) {
          store.updateLastMessage(lastMsg.content + ' [Response interrupted]')
        }

        const errorMessage = mapLLMError(err)
        store.setError(errorMessage)

        // If the assistant message is empty (error before any streaming), replace it
        const msgs = useTutorStore.getState().messages
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant' && !last.content) {
          store.updateLastMessage(errorMessage)
        }
      } finally {
        store.setGenerating(false)
      }
    },
    [courseId, lessonId, courseName, lessonTitle, lessonPosition, videoPositionSeconds, store.mode]
  )

  return {
    messages: store.messages,
    isGenerating: store.isGenerating,
    error: store.error,
    transcriptStatus: transcriptStatusRef.current,
    sendMessage,
    clearConversation: store.clearConversation,
  }
}
