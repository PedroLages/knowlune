/**
 * Chat Q&A Page
 *
 * Chat-style Q&A interface for asking questions about personal notes.
 */

import { MessageList } from '../components/chat/MessageList'
import { ChatInput } from '../components/chat/ChatInput'
import { useChatQA } from '@/ai/hooks/useChatQA'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { AlertCircle, Loader2, Settings } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useNoteQAAvailability } from '@/app/hooks/useNoteQAAvailability'
import { getNoteQAUnavailableCopy } from '@/lib/noteQAAvailabilityCopy'

/**
 * Main chat Q&A page
 *
 * Features:
 * - AI unavailable fallback banner
 * - Message list with auto-scroll
 * - Chat input with keyboard shortcuts
 * - Streaming response visualization
 * - Citation navigation to notes
 */
export function ChatQA() {
  const { messages, isGenerating, sendMessage } = useChatQA()
  const navigate = useNavigate()
  const noteQAAvailability = useNoteQAAvailability()
  const aiChecking = noteQAAvailability.status === 'checking'
  const aiAvailable = noteQAAvailability.status === 'available'
  const unavailableCopy = getNoteQAUnavailableCopy(
    noteQAAvailability.status === 'unavailable' ? noteQAAvailability.availability : null
  )
  const noteCount = useLiveQuery(() => db.notes.count(), []) ?? 0
  const hasNotes = noteCount > 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <h1 className="text-2xl font-semibold text-foreground">Ask Your Notes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Get AI-powered answers from your personal note corpus
        </p>
      </div>

      {/* AI Settings Loading Banner */}
      {aiChecking && (
        <div className="px-6 pt-4" aria-busy="true">
          <Alert variant="default">
            <Loader2 className="size-4 animate-spin" />
            <AlertTitle>Checking AI settings...</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Q&A will be available once your provider settings are verified.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* AI Unavailable Banner */}
      {!aiChecking && !aiAvailable && (
        <div className="px-6 pt-4">
          <Alert variant="default" className="border-warning bg-warning/10">
            <AlertCircle className="size-4 text-warning" />
            <AlertTitle className="text-warning">{unavailableCopy.title}</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              {unavailableCopy.body} You can use manual search from the Notes page in the meantime.
            </AlertDescription>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings?section=integrations')}
                className="border-warning text-warning hover:bg-warning/10"
              >
                <Settings className="size-4 mr-2" />
                Configure AI
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/notes')}>
                Go to Notes
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* No Notes Banner */}
      {aiAvailable && !hasNotes && (
        <div className="px-6 pt-4">
          <Alert variant="default" className="border-warning bg-warning/10">
            <AlertCircle className="size-4 text-warning" />
            <AlertTitle className="text-warning">No Notes Available</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              You haven't created any notes yet. Start taking notes to use Q&A.
            </AlertDescription>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/notes')}
                className="border-warning text-warning hover:bg-warning/10"
              >
                Go to Notes
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isStreaming={isGenerating} />
      </div>

      {/* Chat Input */}
      <ChatInput
        onSend={sendMessage}
        isGenerating={isGenerating || aiChecking || !aiAvailable || !hasNotes}
        placeholder={
          aiChecking
            ? 'Checking AI settings...'
            : !aiAvailable
            ? 'Configure Q&A in Settings to ask questions'
            : !hasNotes
              ? 'Create notes first to use Q&A'
              : 'Ask a question about your notes...'
        }
      />
    </div>
  )
}
