/**
 * ConversationHistorySheet (E73-S05)
 *
 * Slide-in Sheet listing past chatConversations from Dexie.
 * Groups conversations by "This Lesson" and "Other Lessons in Course".
 * Provides Continue and Delete actions for each session card.
 */

import { useMemo, useState, useEffect } from 'react'
import { History, MessageSquare } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
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
import { Button } from '@/app/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { toast } from 'sonner'
import { db } from '@/db'
import { MODE_LABELS } from '@/ai/tutor/modeLabels'
import { formatTimestamp, extractTopics, extractModes } from './conversationUtils'
import type { ChatConversation } from '@/data/types'

interface ConversationHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversations: ChatConversation[]
  currentLessonId: string
  courseId: string
  onContinue: (conversation: ChatConversation) => void
  onDelete: (conversationId: string) => void
}

/** Detect if viewport is mobile (<640px) with resize listener */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}


function ConversationSessionCard({
  conversation,
  onContinue,
  onDelete,
}: {
  conversation: ChatConversation
  onContinue: () => void
  onDelete: () => void
}) {
  const topics = useMemo(() => extractTopics(conversation.messages), [conversation.messages])
  const modes = useMemo(() => extractModes(conversation.messages), [conversation.messages])
  const displayTopics = topics.slice(0, 3)
  const extraCount = topics.length - 3

  return (
    <article className="bg-card rounded-xl p-3 border" data-testid="conversation-session-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <time
          dateTime={new Date(conversation.updatedAt).toISOString()}
          className="text-xs text-muted-foreground"
        >
          {formatTimestamp(conversation.updatedAt)}
        </time>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="size-3" aria-hidden="true" />
          <span>{conversation.messages.length}</span>
        </div>
      </div>

      {displayTopics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {displayTopics.map((topic, i) => (
            <span
              key={i}
              className="bg-muted rounded-full px-2 py-0.5 text-xs truncate max-w-[200px]"
            >
              {topic}
            </span>
          ))}
          {extraCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="bg-muted rounded-full px-2 py-0.5 text-xs cursor-default">
                    +{extraCount} more
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {topics.slice(3).map((t, i) => (
                    <div key={i} className="text-xs">{t}</div>
                  ))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {modes.length > 0 && (
        <div className="text-xs text-muted-foreground italic mb-2">
          {modes.map(m => MODE_LABELS[m] ?? m).join(', ')}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="brand"
          size="sm"
          className="min-h-[44px] min-w-[44px]"
          onClick={onContinue}
          data-testid="continue-conversation-btn"
        >
          Continue
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive min-h-[44px] min-w-[44px]"
              data-testid="delete-conversation-btn"
            >
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this conversation. You cannot undo this action.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </article>
  )
}

export function ConversationHistorySheet({
  open,
  onOpenChange,
  conversations,
  currentLessonId,
  courseId,
  onContinue,
  onDelete,
}: ConversationHistorySheetProps) {
  const isMobile = useIsMobile()

  const { thisLesson, otherLessons } = useMemo(() => {
    const thisLesson: ChatConversation[] = []
    const otherLessons: ChatConversation[] = []

    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)

    for (const conv of sorted) {
      if (conv.courseId === courseId && conv.videoId === currentLessonId) {
        thisLesson.push(conv)
      } else if (conv.courseId === courseId) {
        otherLessons.push(conv)
      }
    }

    return { thisLesson, otherLessons }
  }, [conversations, currentLessonId, courseId])

  const handleDelete = async (conversationId: string) => {
    try {
      await db.chatConversations.delete(conversationId)
      onDelete(conversationId)
    } catch {
      toast.error('Failed to delete conversation.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={isMobile ? 'h-[70vh] p-0 bg-card' : 'w-[320px] p-0 bg-card border-l'}
        data-testid="conversation-history-sheet"
      >
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <History className="size-4" aria-hidden="true" />
            Conversation History
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {thisLesson.length === 0 && otherLessons.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No past conversations yet.
            </p>
          )}

          {thisLesson.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                This Lesson
              </h3>
              <div className="space-y-2">
                {thisLesson.map(conv => (
                  <ConversationSessionCard
                    key={conv.id}
                    conversation={conv}
                    onContinue={() => {
                      onContinue(conv)
                      onOpenChange(false)
                    }}
                    onDelete={() => handleDelete(conv.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {otherLessons.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Other Lessons in Course
              </h3>
              <div className="space-y-2">
                {otherLessons.map(conv => (
                  <ConversationSessionCard
                    key={conv.id}
                    conversation={conv}
                    onContinue={() => {
                      onContinue(conv)
                      onOpenChange(false)
                    }}
                    onDelete={() => handleDelete(conv.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
