/**
 * TutorChat Orchestrator (E57-S01, wired in S02, persistence in S03)
 *
 * Chat interface for the tutor tab in UnifiedLessonPlayer.
 * Composes TranscriptBadge + MessageList + ChatInput from existing chat components.
 * Uses useTutor hook for streaming LLM responses with Dexie persistence.
 */

import { useState, useCallback } from 'react'
import { Trash2, History } from 'lucide-react'
import { MessageList } from '@/app/components/chat/MessageList'
import { ChatInput } from '@/app/components/chat/ChatInput'
import { TranscriptBadge } from './TranscriptBadge'
import { TutorModeChips } from './TutorModeChips'
import { TutorEmptyState } from './TutorEmptyState'
import { QuizScoreTracker } from './QuizScoreTracker'
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
import { TutorMemoryIndicator } from './TutorMemoryIndicator'
import { ConversationHistorySheet } from './ConversationHistorySheet'
import { ContinueConversationPrompt } from './ContinueConversationPrompt'
import { useConversationHistory } from './useConversationHistory'
import { useTutorKeyboardShortcuts } from './useTutorKeyboardShortcuts'
import { useTutor } from '@/ai/hooks/useTutor'
import { useTutorStore } from '@/stores/useTutorStore'
import { LLM_ERROR_MESSAGES } from '@/ai/lib/llmErrorMapper'
import type { TranscriptStatus, TutorMode } from '@/ai/tutor/types'

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
  const {
    messages,
    isGenerating,
    error,
    transcriptStatus,
    mode,
    sendMessage,
    clearConversation,
    setMode,
  } = useTutor({
    courseId,
    lessonId,
    courseName,
    lessonTitle,
    lessonPosition,
    videoPositionSeconds,
  })

  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const { learnerModel, clearLearnerModel, replaceLearnerModelFields, quizState } = useTutorStore()

  const {
    allConversations,
    historyOpen,
    setHistoryOpen,
    staleConversation,
    conversationsLoaded,
    dismissStalePrompt,
    handleContinueConversation,
    handleDeleteConversation,
  } = useConversationHistory({ courseId, videoId: lessonId, messages })

  // Conversation count for badge
  const conversationCount = allConversations.filter(
    c => c.courseId === courseId
  ).length

  // Determine badge status — use hook's transcriptStatus or fallback
  const badgeStatus: TranscriptStatus = transcriptStatus ?? {
    available: false,
    strategy: 'none',
    label: 'Loading...',
  }

  // Detect offline/unavailable state for the banner using named constants (not fragile string comparison)
  const isOffline = error === LLM_ERROR_MESSAGES.OFFLINE
  const isPremiumGated = error === LLM_ERROR_MESSAGES.PREMIUM

  // Keyboard shortcuts (E73-S05)
  useTutorKeyboardShortcuts({
    onToggleHistory: useCallback(() => setHistoryOpen(prev => !prev), []),
    onToggleMemory: useCallback(() => setMemoryOpen(prev => !prev), []),
    onSwitchMode: useCallback(
      (newMode: TutorMode) => {
        if (!isGenerating && !isOffline && !isPremiumGated) {
          setMode(newMode)
        }
      },
      [isGenerating, isOffline, isPremiumGated, setMode]
    ),
  })

  const handleClear = () => {
    clearConversation()
    setClearDialogOpen(false)
  }

  return (
    <div className="flex flex-col h-[400px]" data-testid="tutor-chat">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <TranscriptBadge
          status={
            isOffline ? { available: false, strategy: 'none', label: 'Offline' } : badgeStatus
          }
        />
        <TutorModeChips
          mode={mode}
          onModeChange={setMode}
          disabled={isGenerating || isOffline || isPremiumGated}
          hasTranscript={badgeStatus.available}
        />
        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 min-h-[44px] min-w-[44px] text-muted-foreground"
              aria-label="Conversation history"
              onClick={() => setHistoryOpen(true)}
              data-testid="history-btn"
            >
              <History className="h-4 w-4" />
            </Button>
            {conversationCount > 1 && (
              <span
                className="absolute -top-1 -right-1 bg-brand text-brand-foreground text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center leading-none"
                aria-label={`${conversationCount} conversations`}
              >
                {conversationCount}
              </span>
            )}
          </div>
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
      <TutorMemoryIndicator
        learnerModel={learnerModel}
        courseId={courseId}
        onClearMemory={clearLearnerModel}
        onUpdateMemory={replaceLearnerModelFields}
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
      />
      <div className="flex-1 overflow-hidden relative">
        {mode === 'quiz' && quizState.totalQuestions > 0 && (
          <div className="absolute top-2 right-2 z-10">
            <QuizScoreTracker
              correct={quizState.correctAnswers}
              total={quizState.totalQuestions}
              lastAnswerCorrect={quizState.lastAnswerCorrect}
            />
          </div>
        )}
        {conversationsLoaded && staleConversation && messages.length === 0 ? (
          <ContinueConversationPrompt
            conversation={staleConversation}
            onContinue={() => handleContinueConversation(staleConversation)}
            onStartFresh={dismissStalePrompt}
          />
        ) : messages.length === 0 ? (
          <TutorEmptyState lessonTitle={lessonTitle} mode={mode} onSendMessage={sendMessage} />
        ) : (
          <MessageList messages={messages} isStreaming={isGenerating} />
        )}
      </div>
      {(isOffline || isPremiumGated) && (
        <div
          role="alert"
          className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-t border-border"
        >
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
      <ConversationHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        conversations={allConversations}
        currentLessonId={lessonId}
        courseId={courseId}
        onContinue={handleContinueConversation}
        onDelete={handleDeleteConversation}
      />
    </div>
  )
}
