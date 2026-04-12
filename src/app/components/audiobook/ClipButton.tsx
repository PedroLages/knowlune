/**
 * ClipButton — two-phase clip recording control.
 *
 * Phase 1 (idle): user taps "Start Clip" → captures startTime, enters recording state.
 * Phase 2 (recording): user taps "End Clip" → captures endTime, validates, saves clip.
 *
 * The pulsing red indicator follows the BookmarkButton AnimatePresence pattern.
 *
 * @module ClipButton
 * @since E111-S01
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Scissors } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { useAudioClipStore } from '@/stores/useAudioClipStore'
import { formatAudioTime } from '@/app/hooks/useAudioPlayer'

interface ClipButtonProps {
  bookId: string
  chapterId: string
  chapterIndex: number
  currentTime: number
  onClipCreated?: (id: string) => void
}

export function ClipButton({
  bookId,
  chapterId,
  chapterIndex,
  currentTime,
  onClipCreated,
}: ClipButtonProps) {
  const [pendingStartTime, setPendingStartTime] = useState<number | null>(null)
  const addClip = useAudioClipStore(s => s.addClip)

  const isRecording = pendingStartTime !== null

  const handleClick = async () => {
    if (!isRecording) {
      // Phase 1: capture start time
      const startTime = Math.floor(currentTime)
      setPendingStartTime(startTime)
      toast(`Clip started at ${formatAudioTime(startTime)}`, { duration: 2000 })
      return
    }

    // Phase 2: capture end time and save
    const endTime = Math.floor(currentTime)

    if (endTime <= pendingStartTime) {
      toast.error('End time must be after start time')
      return
    }

    try {
      const id = await addClip({
        bookId,
        chapterId,
        chapterIndex,
        startTime: pendingStartTime,
        endTime,
      })
      setPendingStartTime(null)
      onClipCreated?.(id)
    } catch {
      // silent-catch-ok: error surfaced via toast inside addClip
    }
  }

  const handleCancelRecording = () => {
    setPendingStartTime(null)
    toast('Clip cancelled', { duration: 1500 })
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="min-h-[44px] min-w-[44px] px-3 text-muted-foreground hover:text-foreground relative"
        onClick={handleClick}
        aria-label={isRecording ? 'End Clip' : 'Start Clip'}
        data-testid={isRecording ? 'end-clip-button' : 'start-clip-button'}
      >
        <Scissors
          className={`size-5 ${isRecording ? 'text-destructive' : ''}`}
          aria-hidden="true"
        />

        {/* Pulsing red recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.span
              key="clip-recording-indicator"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive animate-pulse"
              data-testid="clip-recording-indicator"
              aria-label="Recording in progress"
            />
          )}
        </AnimatePresence>
      </Button>

      {/* Cancel recording button — only shown during recording */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleCancelRecording}
              aria-label="Cancel clip recording"
            >
              ✕
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
