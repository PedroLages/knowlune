/**
 * TutorChat Orchestrator (E57-S01, wired in S02, persistence in S03)
 *
 * Chat interface for the tutor tab in UnifiedLessonPlayer.
 * Composes TranscriptBadge + MessageList + ChatInput from existing chat components.
 * Uses useTutor hook for streaming LLM responses with Dexie persistence.
 */

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { MessageList } from '@/app/components/chat/MessageList'
import { ChatInput } from '@/app/components/chat/ChatInput'
import { TranscriptBadge } from './TranscriptBadge'
import { TutorModeChips } from './TutorModeChips'
import { TutorEmptyState } from './TutorEmptyState'
import { Button } from '@/app/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
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
  const { messages, isGenerating, error, transcriptStatus, mode, sendMessage, clearConversation, setMode } =
    useTutor({
      courseId,
      lessonId,
      courseName,
      lessonTitle,
      lessonPosition,
      videoPositionSeconds,
    })

  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  // Determine badge status — use hook's transcriptStatus or fallback
  const badgeStatus: TranscriptStatus = transcriptStatus ?? {
    available: false,
    strategy: 'none',
    label: 'Loading...',
  }

  // Detect offline/unavailable state for the banner using named constants (not fragile string comparison)
  const isOffline = error === LLM_ERROR_MESSAGES.OFFLINE
  const isPremiumGated = error === LLM_ERROR_MESSAGES.PREMIUM

  const handleClear = () => {
    clearConversation()
    setClearDialogOpen(false)
  }

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
        <TutorModeChips
          mode={mode}
          onModeChange={setMode}
          disabled={isGenerating || isOffline || isPremiumGated}
        />
        <div className="ml-auto">
          {messages.length > 0 && (
            <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                  aria-label="Clear conversation"
                  data-testid="clear-conversation-btn"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this conversation. You cannot undo this action.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClear}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
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
