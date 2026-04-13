/**
 * TutorChat Orchestrator (E57-S01)
 *
 * Chat interface for the tutor tab in UnifiedLessonPlayer.
 * Composes TranscriptBadge + MessageList + ChatInput from existing chat components.
 * Sends messages with transcript context injection (LLM streaming in S02).
 */

import { useState, useEffect, useCallback } from 'react'
import { MessageList } from '@/app/components/chat/MessageList'
import { ChatInput } from '@/app/components/chat/ChatInput'
import { TranscriptBadge } from './TranscriptBadge'
import { TutorEmptyState } from './TutorEmptyState'
import { getTranscriptContext } from '@/ai/tutor/transcriptContext'
import { buildTutorSystemPrompt } from '@/ai/tutor/tutorPromptBuilder'
import type { TranscriptStatus, TutorContext } from '@/ai/tutor/types'
import type { ChatMessage } from '@/ai/rag/types'

interface TutorChatProps {
  courseId: string
  lessonId: string
  courseName: string
  lessonTitle: string
  lessonPosition?: string
  /** Current video playback time in seconds */
  videoPositionSeconds?: number
}

export function TutorChat({
  courseId,
  lessonId,
  courseName,
  lessonTitle,
  lessonPosition,
  videoPositionSeconds = 0,
}: TutorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>({
    available: false,
    strategy: 'none',
    label: 'Loading...',
  })
  // Load transcript context on mount and when lesson changes
  useEffect(() => {
    let cancelled = false

    async function loadContext() {
      try {
        const result = await getTranscriptContext(courseId, lessonId, videoPositionSeconds)
        if (!cancelled) {
          setTranscriptStatus(result.status)
        }
      } catch (error) {
        // silent-catch-ok — transcript context is non-critical; falls back to general mode
        console.error('[TutorChat] Failed to load transcript context:', error)
        if (!cancelled) {
          setTranscriptStatus({
            available: false,
            strategy: 'none',
            label: 'General mode',
          })
        }
      }
    }

    loadContext()
    return () => {
      cancelled = true
    }
  }, [courseId, lessonId]) // videoPositionSeconds excluded intentionally; context re-fetched per message

  // Reset messages when lesson changes
  useEffect(() => {
    setMessages([])
  }, [lessonId])

  // Placeholder send handler — full LLM streaming implementation in S02
  const handleSend = useCallback(
    async (content: string) => {
      // Re-fetch transcript context with current video position
      let currentContext: Awaited<ReturnType<typeof getTranscriptContext>>
      try {
        currentContext = await getTranscriptContext(courseId, lessonId, videoPositionSeconds)
      } catch (error) {
        console.error('[TutorChat] Failed to load lesson context for message:', error)
        // Add error system message but continue — don't block the user
        const errorMessage = {
          id: crypto.randomUUID(),
          role: 'system' as const,
          content: 'Failed to load lesson context. Answering without it.',
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, errorMessage])
        currentContext = {
          excerpt: '',
          strategy: 'none' as const,
          status: { available: false, strategy: 'none' as const, label: 'General mode' },
        }
      }

      // Build tutor context for system prompt
      const tutorContext: TutorContext = {
        courseName,
        lessonTitle,
        lessonPosition,
        videoPositionSeconds,
        transcriptExcerpt: currentContext.excerpt,
        transcriptStrategy: currentContext.strategy,
        chapterTitle: currentContext.chapterTitle,
        timeRange: currentContext.timeRange,
      }

      // Build system prompt — logged for debugging; S02 will wire to LLM streaming
      const systemPrompt = buildTutorSystemPrompt(tutorContext)
      console.debug('[TutorChat] System prompt built:', systemPrompt.length, 'chars')

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }

      // Add placeholder assistant response (S02 will replace with streaming)
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Tutor responses will be available once the streaming hook is implemented (E57-S02). The system prompt has been built with your lesson context.',
        timestamp: Date.now(),
      }

      setMessages(prev => [...prev, userMessage, assistantMessage])
    },
    [courseId, lessonId, courseName, lessonTitle, lessonPosition, videoPositionSeconds]
  )

  return (
    <div className="flex flex-col h-[400px]" data-testid="tutor-chat">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <TranscriptBadge status={transcriptStatus} />
      </div>
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <TutorEmptyState lessonTitle={lessonTitle} />
        ) : (
          <MessageList messages={messages} isStreaming={false} />
        )}
      </div>
      <ChatInput
        onSend={handleSend}
        isGenerating={false}
        placeholder="Ask about this lesson..."
      />
    </div>
  )
}
