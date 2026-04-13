/**
 * useTutor Hook (E57-S02, persistence in S03)
 *
 * React hook for tutor chat with streaming LLM responses.
 * Implements a 6-stage pipeline:
 *   1. Frustration detection (placeholder — S04)
 *   2. Get transcript context
 *   3. Build system prompt
 *   4. Assemble LLM message array (sliding window)
 *   5. Stream LLM response
 *   6. Persist to Dexie
 *
 * Follows useChatQA pattern with AbortController for cleanup.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useTutorStore } from '@/stores/useTutorStore'
import { getTranscriptContext } from '@/ai/tutor/transcriptContext'
import { buildTutorSystemPrompt } from '@/ai/tutor/tutorPromptBuilder'
import { getLLMClient } from '@/ai/llm/factory'
import { mapLLMError } from '@/ai/lib/llmErrorMapper'
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

  // Set lesson context for persistence and load existing conversation
  useEffect(() => {
    let cancelled = false

    store.setLessonContext(courseId, lessonId)

    async function loadExisting() {
      await store.loadConversation(courseId, lessonId)
      if (cancelled) return
    }

    loadExisting()
    return () => {
      cancelled = true
    }
  }, [courseId, lessonId])

  // Load transcript status on mount / lesson change — stored in Zustand for reactive re-renders
  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      try {
        const result = await getTranscriptContext(courseId, lessonId, videoPositionSeconds)
        if (!cancelled) {
          store.setTranscriptStatus(result.status)
        }
      } catch {
        // silent-catch-ok — transcript context is non-critical
        if (!cancelled) {
          store.setTranscriptStatus({
            available: false,
            strategy: 'none',
            label: 'General mode',
          })
        }
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [courseId, lessonId, videoPositionSeconds])

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
      // TODO(E57-S04): frustration detection — result used for Socratic mode in S04
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

        // Stage 6: Persist to Dexie
        await store.persistConversation()
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
    transcriptStatus: store.transcriptStatus,
    sendMessage,
    clearConversation: store.clearConversation,
  }
}
