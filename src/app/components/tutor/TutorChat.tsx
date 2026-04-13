/**
 * TutorChat Orchestrator (E57-S01, wired in S02)
 *
 * Chat interface for the tutor tab in UnifiedLessonPlayer.
 * Composes TranscriptBadge + MessageList + ChatInput from existing chat components.
 * Uses useTutor hook for streaming LLM responses.
 */

import { MessageList } from '@/app/components/chat/MessageList'
import { ChatInput } from '@/app/components/chat/ChatInput'
import { TranscriptBadge } from './TranscriptBadge'
import { TutorEmptyState } from './TutorEmptyState'
import { useTutor } from '@/ai/hooks/useTutor'
import { LLM_ERROR_MESSAGES } from '@/ai/lib/llmErrorMapper'
import type { TranscriptStatus } from '@/ai/tutor/types'

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
  const { messages, isGenerating, error, transcriptStatus, sendMessage } =
    useTutor({
      courseId,
      lessonId,
      courseName,
      lessonTitle,
      lessonPosition,
      videoPositionSeconds,
    })

  // Determine badge status — use hook's transcriptStatus or fallback
  const badgeStatus: TranscriptStatus = transcriptStatus ?? {
    available: false,
    strategy: 'none',
    label: 'Loading...',
  }

  // Detect offline/unavailable state for the banner using named constants (not fragile string comparison)
  const isOffline = error === LLM_ERROR_MESSAGES.OFFLINE
  const isPremiumGated = error === LLM_ERROR_MESSAGES.PREMIUM

  return (
    <div className="flex flex-col h-[400px]" data-testid="tutor-chat">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <TranscriptBadge
          status={
            isOffline
              ? { available: false, strategy: 'none', label: 'Offline' }
              : badgeStatus
          }
        />
      </div>
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <TutorEmptyState lessonTitle={lessonTitle} />
        ) : (
          <MessageList messages={messages} isStreaming={isGenerating} />
        )}
      </div>
      {(isOffline || isPremiumGated) && (
        <div role="alert" className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-t border-border">
          {isOffline ? LLM_ERROR_MESSAGES.OFFLINE : LLM_ERROR_MESSAGES.PREMIUM}
        </div>
      )}
      {error && !isOffline && !isPremiumGated && (
        <div className="px-4 py-1 text-sm text-destructive">{error}</div>
      )}
      <ChatInput
        onSend={sendMessage}
        isGenerating={isGenerating}
        disabled={isOffline || isPremiumGated}
        placeholder={
          isOffline
            ? 'AI provider offline'
            : isPremiumGated
              ? 'Premium subscription required'
              : 'Ask about this lesson...'
        }
      />
    </div>
  )
}
